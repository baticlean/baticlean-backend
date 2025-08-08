// Fichier : backend/routes/booking.routes.js (Version avec notifications individuelles)
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

        const newBooking = await Booking.create({ 
            service: serviceId, 
            user: userId, 
            bookingDate, 
            bookingTime, 
            address, 
            phoneNumber, 
            notes,
            readByAdmins: [] // La liste est vide, donc non lue pour tous les admins
        });

        const populatedBooking = await Booking.findById(newBooking._id).populate('user', 'username email').populate('service', 'title');

        req.io.emit('newBooking', populatedBooking);
        await broadcastNotificationCounts(req);

        res.status(201).json(populatedBooking);
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

// ... les routes GET restent identiques ...
router.get('/my-bookings', isAuthenticated, /* ... */);
router.get('/', isAuthenticated, isAdmin, /* ... */);


router.patch('/:bookingId/status', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { status } = req.body;
        const adminId = req.auth._id; // On récupère l'ID de l'admin qui fait l'action

        if (!['Confirmée', 'Terminée', 'Annulée'].includes(status)) {
            return res.status(400).json({ message: 'Statut invalide.' });
        }

        // ✅ MODIFICATION : On ajoute l'ID de l'admin à la liste des lecteurs
        const updateQuery = { 
            status, 
            $addToSet: { 
                readByAdmins: adminId,
                timeline: { status } 
            } 
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

// ... la route DELETE reste identique ...
router.delete('/:bookingId', isAuthenticated, isAdmin, /* ... */);

module.exports = router;