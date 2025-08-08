// Fichier : backend/routes/booking.routes.js (Version finale avec notifications client)
const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking.model');
const { isAuthenticated, isAdmin } = require('../middleware/isAdmin.js');
const { broadcastNotificationCounts } = require('../utils/notifications.js');

// === ROUTES POUR LES CLIENTS ===

// Obtenir ses propres réservations (inchangé)
router.get('/my-bookings', isAuthenticated, async (req, res) => {
    try {
        const userId = req.auth._id;
        const userBookings = await Booking.find({ user: userId }).populate('service', 'title images price').sort({ bookingDate: -1 });
        res.status(200).json(userBookings);
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

// ✅ NOUVELLE ROUTE : Compter les notifications de réservation non lues pour le client
router.get('/my-unread-count', isAuthenticated, async (req, res) => {
    try {
        const userId = req.auth._id;
        const count = await Booking.countDocuments({ user: userId, isReadByUser: false });
        res.status(200).json({ count });
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

// ✅ NOUVELLE ROUTE : Marquer toutes ses notifications de réservation comme lues
router.patch('/mark-all-as-read', isAuthenticated, async (req, res) => {
    try {
        const userId = req.auth._id;
        await Booking.updateMany({ user: userId, isReadByUser: false }, { isReadByUser: true });
        res.status(200).json({ message: 'Notifications marquées comme lues.' });
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});


// === ROUTES POUR LES ADMINS ===

// Créer une réservation (inchangé)
router.post('/', isAuthenticated, async (req, res) => {
    try {
        const { serviceId, bookingDate, bookingTime, address, phoneNumber, notes } = req.body;
        const userId = req.auth._id;
        if (!serviceId || !bookingDate || !bookingTime || !address || !phoneNumber) {
            return res.status(400).json({ message: 'Tous les champs sont requis.' });
        }
        const newBooking = await Booking.create({ service: serviceId, user: userId, bookingDate, bookingTime, address, phoneNumber, notes, readByAdmins: [] });
        const populatedBooking = await Booking.findById(newBooking._id).populate('user', 'username email').populate('service', 'title');
        req.io.emit('newBooking', populatedBooking);
        await broadcastNotificationCounts(req);
        res.status(201).json(populatedBooking);
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

// Obtenir toutes les réservations (inchangé)
router.get('/', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const allBookings = await Booking.find().populate('user', 'username email').populate('service', 'title').sort({ bookingDate: -1 });
        res.status(200).json(allBookings);
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

// Mettre à jour le statut d'une réservation par un admin
router.patch('/:bookingId/status', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { status } = req.body;
        const adminId = req.auth._id;

        if (!['Confirmée', 'Terminée', 'Annulée'].includes(status)) {
            return res.status(400).json({ message: 'Statut invalide.' });
        }

        // On marque la notif admin comme lue ET la notif client comme non lue
        const updateQuery = { 
            status, 
            $push: { timeline: { status } },
            $addToSet: { readByAdmins: adminId },
            isReadByUser: false // ✅ Le client doit être notifié !
        };

        const updatedBooking = await Booking.findByIdAndUpdate(bookingId, updateQuery, { new: true })
            .populate('user', 'username')
            .populate('service', 'title');

        if (!updatedBooking) {
            return res.status(404).json({ message: 'Réservation non trouvée.' });
        }

        // --- LOGIQUE D'ENVOI DE NOTIFICATION AU CLIENT ---
        const userId = updatedBooking.user._id.toString();
        const userSocketId = req.onlineUsers[userId];

        if (userSocketId) {
            const notificationPayload = {
                message: `Votre réservation #${updatedBooking._id.toString().slice(-6)} a été ${status.toLowerCase()}.`,
                booking: updatedBooking
            };
            req.io.to(userSocketId).emit('bookingStatusChanged', notificationPayload);
            console.log(`✅ Notification envoyée au client ${userId} sur le socket ${userSocketId}`);
        }
        // --- FIN DE LA LOGIQUE D'ENVOI ---

        await broadcastNotificationCounts(req); // Met à jour les compteurs admin
        res.status(200).json(updatedBooking);
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

// Supprimer une réservation (inchangé)
router.delete('/:bookingId', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { bookingId } = req.params;
        const deletedBooking = await Booking.findByIdAndDelete(bookingId);
        if (!deletedBooking) {
            return res.status(404).json({ message: 'Réservation non trouvée.' });
        }
        req.io.emit('bookingDeleted', { _id: bookingId });
        await broadcastNotificationCounts(req);
        res.status(200).json({ message: 'Réservation supprimée avec succès.' });
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

module.exports = router;