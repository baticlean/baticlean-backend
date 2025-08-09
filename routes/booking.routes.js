// Fichier : backend/routes/booking.routes.js
const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking.model');
const { isAuthenticated, isAdmin } = require('../middleware/isAdmin.js');
const { broadcastNotificationCounts } = require('../utils/notifications.js');

// === ROUTES POUR LES CLIENTS ===

// ✅ MODIFIÉ : Obtenir ses propres réservations (actives ou masquées)
router.get('/my-bookings', isAuthenticated, async (req, res) => {
    try {
        const userId = req.auth._id;
        // On vérifie si le client veut voir ses réservations masquées
        const showHidden = req.query.hidden === 'true';

        const userBookings = await Booking.find({ 
            user: userId,
            hiddenForUser: showHidden // On filtre selon le statut de masquage
        }).populate('service', 'title images price').sort({ bookingDate: -1 });

        res.status(200).json(userBookings);
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

// ✅ NOUVELLE ROUTE : Masquer ou afficher une réservation pour le client
router.patch('/:bookingId/toggle-hide', isAuthenticated, async (req, res) => {
    try {
        const { bookingId } = req.params;
        const userId = req.auth._id;
        const { hide } = req.body; // Un booléen : true pour masquer, false pour afficher

        // On vérifie que la réservation appartient bien à l'utilisateur
        const booking = await Booking.findOne({ _id: bookingId, user: userId });
        if (!booking) {
            return res.status(404).json({ message: 'Réservation non trouvée ou non autorisée.' });
        }

        booking.hiddenForUser = hide;
        await booking.save();

        res.status(200).json(booking);

    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});


// Route pour compter les notifications non lues (inchangée)
router.get('/my-unread-count', isAuthenticated, async (req, res) => {
    try {
        const userId = req.auth._id;
        const count = await Booking.countDocuments({ user: userId, isReadByUser: false });
        res.status(200).json({ count });
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

// Route pour marquer comme lues (inchangée)
router.patch('/mark-all-as-read', isAuthenticated, async (req, res) => {
    try {
        const userId = req.auth._id;
        await Booking.updateMany({ user: userId, isReadByUser: false }, { isReadByUser: true });
        res.status(200).json({ message: 'Notifications marquées comme lues.' });
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});


// === ROUTES POUR LES ADMINS (INCHANGÉES) ===

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

router.get('/', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const allBookings = await Booking.find().populate('user', 'username email').populate('service', 'title').sort({ bookingDate: -1 });
        res.status(200).json(allBookings);
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

router.patch('/:bookingId/status', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { status } = req.body;
        const adminId = req.auth._id;

        if (!['Confirmée', 'Terminée', 'Annulée'].includes(status)) {
            return res.status(400).json({ message: 'Statut invalide.' });
        }

        const updateQuery = { 
            status, 
            $push: { timeline: { status } },
            $addToSet: { readByAdmins: adminId },
            isReadByUser: false
        };

        const updatedBooking = await Booking.findByIdAndUpdate(bookingId, updateQuery, { new: true })
            .populate('user', 'username')
            .populate('service', 'title');

        if (!updatedBooking) {
            return res.status(404).json({ message: 'Réservation non trouvée.' });
        }

        const userId = updatedBooking.user._id.toString();
        const userSocketId = req.onlineUsers[userId];

        if (userSocketId) {
            const notificationPayload = {
                message: `Votre réservation #${updatedBooking._id.toString().slice(-6)} a été ${status.toLowerCase()}.`,
                booking: updatedBooking
            };
            req.io.to(userSocketId).emit('bookingStatusChanged', notificationPayload);
        }

        await broadcastNotificationCounts(req);
        res.status(200).json(updatedBooking);
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

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
