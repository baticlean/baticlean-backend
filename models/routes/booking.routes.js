// Fichier : backend/routes/booking.routes.js (Version Finale Complète)
const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking.model');
const { isAuthenticated, isAdmin } = require('../middleware/isAdmin.js');
const { broadcastNotificationCounts } = require('../utils/notifications.js');

// === ROUTES POUR LES CLIENTS (Logique existante conservée) ===

// Obtenir ses propres réservations (actives ou masquées)
router.get('/my-bookings', isAuthenticated, async (req, res) => {
    try {
        const userId = req.auth._id;
        const showHidden = req.query.hidden === 'true';
        const userBookings = await Booking.find({ 
            user: userId,
            hiddenForUser: showHidden
        }).populate('service', 'title images price').sort({ bookingDate: -1 });
        res.status(200).json(userBookings);
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

// Pour que l'utilisateur annule sa réservation
router.patch('/:bookingId/cancel', isAuthenticated, async (req, res) => {
    try {
        const { bookingId } = req.params;
        const userId = req.auth._id;
        const booking = await Booking.findOne({ _id: bookingId, user: userId });
        if (!booking) {
            return res.status(404).json({ message: 'Réservation non trouvée ou action non autorisée.' });
        }
        if (booking.status !== 'En attente') {
            return res.status(400).json({ message: 'Cette réservation ne peut plus être annulée.' });
        }
        booking.status = 'Annulée';
        booking.timeline.push({ status: 'Annulée' });
        booking.readByAdmins = []; // Notifie les admins
        await booking.save();
        const populatedBooking = await Booking.findById(booking._id).populate('service', 'title').populate('user', 'username');
        req.io.emit('bookingUpdated', populatedBooking);
        await broadcastNotificationCounts(req);
        res.status(200).json(populatedBooking);
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

// Masquer ou afficher une réservation pour le client
router.patch('/:bookingId/toggle-hide', isAuthenticated, async (req, res) => {
    try {
        const { bookingId } = req.params;
        const userId = req.auth._id;
        const { hide } = req.body;
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

// Compter les notifications non lues
router.get('/my-unread-count', isAuthenticated, async (req, res) => {
    try {
        const userId = req.auth._id;
        const count = await Booking.countDocuments({ user: userId, isReadByUser: false });
        res.status(200).json({ count });
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

// Marquer comme lues
router.patch('/mark-all-as-read', isAuthenticated, async (req, res) => {
    try {
        const userId = req.auth._id;
        await Booking.updateMany({ user: userId, isReadByUser: false }, { isReadByUser: true });
        res.status(200).json({ message: 'Notifications marquées comme lues.' });
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});


// === ROUTES POUR LES ADMINS (Logique mise à jour) ===

// Créer une réservation (pourrait être restreint aux admins si nécessaire)
router.post('/', isAuthenticated, async (req, res) => {
    try {
        const { serviceId, bookingDate, bookingTime, address, phoneNumber, notes } = req.body;
        const userId = req.auth._id; // Ou un ID d'utilisateur fourni dans le corps si un admin crée pour un client
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

// Récupère les réservations actives ou masquées pour l'admin
router.get('/', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const showHidden = req.query.hidden === 'true';
        const query = {
            hiddenForAdmins: { [showHidden ? '$in' : '$ne']: req.auth._id }
        };
        const allBookings = await Booking.find(query)
            .populate('user', 'username email')
            .populate('service', 'title')
            .sort({ bookingDate: -1 });
        res.status(200).json(allBookings);
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

// Empêche l'action si la réservation est déjà annulée
router.patch('/:bookingId/status', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { status } = req.body;
        const adminId = req.auth._id;

        const bookingToUpdate = await Booking.findById(bookingId);
        if (!bookingToUpdate) {
            return res.status(404).json({ message: 'Réservation non trouvée.' });
        }

        if (bookingToUpdate.status === 'Annulée') {
            return res.status(400).json({ message: 'Cette réservation a été annulée par le client et ne peut plus être modifiée.' });
        }

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
            .populate('user', 'username').populate('service', 'title');

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

// Remplace la suppression par un masquage
router.patch('/:bookingId/hide', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { bookingId } = req.params;
        await Booking.findByIdAndUpdate(bookingId, { $addToSet: { hiddenForAdmins: req.auth._id } });
        res.status(200).json({ message: 'Réservation masquée avec succès.' });
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

// Pour restaurer une réservation masquée
router.patch('/:bookingId/unhide', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { bookingId } = req.params;
        await Booking.findByIdAndUpdate(bookingId, { $pull: { hiddenForAdmins: req.auth._id } });
        res.status(200).json({ message: 'Réservation restaurée avec succès.' });
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

module.exports = router;
