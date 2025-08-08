// Fichier : backend/routes/booking.routes.js (Version Finale Complétée)
const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking.model');
const { isAuthenticated, isAdmin } = require('../middleware/isAdmin.js');
const { broadcastNotificationCounts } = require('../utils/notifications.js');

router.post('/', isAuthenticated, async (req, res) => {
    try {
        const { serviceId, bookingDate, bookingTime, address, phoneNumber, notes } = req.body;
        const userId = req.auth._id;
        if (!serviceId || !bookingDate || !bookingTime || !address || !phoneNumber) {
            return res.status(400).json({ message: 'Tous les champs sont requis.' });
        }

        // ✅ AJOUT : Marquer la nouvelle réservation comme non lue par l'admin
        const newBooking = await Booking.create({ 
            service: serviceId, 
            user: userId, 
            bookingDate, 
            bookingTime, 
            address, 
            phoneNumber, 
            notes,
            readByAdmin: false 
        });

        const populatedBooking = await Booking.findById(newBooking._id).populate('user', 'username email').populate('service', 'title');

        req.io.emit('newBooking', populatedBooking);
        await broadcastNotificationCounts(req);

        res.status(201).json(populatedBooking);
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

router.get('/my-bookings', isAuthenticated, async (req, res) => {
    try {
        const userId = req.auth._id;
        const userBookings = await Booking.find({ user: userId }).populate('service', 'title images price').sort({ bookingDate: -1 });
        res.status(200).json(userBookings);
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
        if (!['Confirmée', 'Terminée', 'Annulée'].includes(status)) {
            return res.status(400).json({ message: 'Statut invalide.' });
        }

        // ✅ AJOUT : Marquer comme lue quand l'admin change le statut
        const updateQuery = { 
            status, 
            readByAdmin: true, 
            $push: { timeline: { status } } 
        };

        const updatedBooking = await Booking.findByIdAndUpdate(bookingId, updateQuery, { new: true }).populate('user', 'username').populate('service', 'title');

        if (!updatedBooking) {
            return res.status(404).json({ message: 'Réservation non trouvée.' });
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