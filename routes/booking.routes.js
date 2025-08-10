// backend/routes/booking.routes.js (Mis à jour)

const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking.model');
const Service = require('../models/Service.model');
const User = require('../models/User.model'); // AJOUTÉ : On a besoin du modèle User
const { isAuthenticated, isAdmin } = require('../middleware/isAdmin.js');
const { broadcastNotificationCounts } = require('../utils/notifications.js');
// AJOUTÉ : On importe nos nouvelles fonctions d'email
const { 
    sendBookingConfirmationEmail, 
    sendStatusUpdateEmail, 
    sendCancellationEmail, 
    sendReviewRequestEmail 
} = require('../utils/email.js');

// --- ROUTES CLIENTS ---

// Créer une réservation
router.post('/', isAuthenticated, async (req, res) => {
    try {
        const { serviceId, bookingDate, bookingTime, address, phoneNumber, notes } = req.body;
        const userId = req.auth._id;

        if (!serviceId || !bookingDate || !bookingTime || !address || !phoneNumber) {
            return res.status(400).json({ message: 'Tous les champs sont requis.' });
        }

        const newBooking = await Booking.create({ service: serviceId, user: userId, bookingDate, bookingTime, address, phoneNumber, notes, readByAdmins: [] });
        
        // On récupère les informations complètes pour l'email et les sockets
        const populatedBooking = await Booking.findById(newBooking._id).populate('user').populate('service');

        // AJOUTÉ : Envoi de l'email de confirmation au client
        await sendBookingConfirmationEmail(populatedBooking.user, populatedBooking, populatedBooking.service);

        req.io.emit('newBooking', populatedBooking);
        await broadcastNotificationCounts(req);
        res.status(201).json(populatedBooking);
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

// Annuler sa propre réservation
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
        booking.readByAdmins = [];
        await booking.save();
        
        const populatedBooking = await Booking.findById(booking._id).populate('user').populate('service');

        // AJOUTÉ : Envoi de l'email d'annulation
        await sendCancellationEmail(populatedBooking.user, populatedBooking, populatedBooking.service);

        req.io.emit('bookingUpdated', populatedBooking);
        await broadcastNotificationCounts(req);
        res.status(200).json(populatedBooking);
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});


// --- ROUTES ADMINS ---

// Mettre à jour le statut d'une réservation
router.patch('/:bookingId/status', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { status } = req.body;
        const adminId = req.auth._id;

        const bookingToUpdate = await Booking.findById(bookingId);
        if (!bookingToUpdate) {
            return res.status(404).json({ message: 'Réservation non trouvée.' });
        }
        if (bookingToUpdate.status === 'Annulée' && status !== 'Annulée') {
            return res.status(400).json({ message: 'Cette réservation a été annulée par le client et ne peut plus être modifiée.' });
        }
        if (!['En attente', 'Confirmée', 'Terminée', 'Annulée'].includes(status)) {
            return res.status(400).json({ message: 'Statut invalide.' });
        }

        const updateQuery = { 
            status, 
            $push: { timeline: { status } },
            $addToSet: { readByAdmins: adminId },
            isReadByUser: false
        };
        
        const updatedBooking = await Booking.findByIdAndUpdate(bookingId, updateQuery, { new: true })
            .populate('user').populate('service');

        // AJOUTÉ : Logique d'envoi d'email en fonction du nouveau statut
        if (status === 'Terminée') {
            await sendReviewRequestEmail(updatedBooking.user, updatedBooking, updatedBooking.service);
        } else {
            await sendStatusUpdateEmail(updatedBooking.user, updatedBooking, updatedBooking.service);
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


// ... (Le reste de vos routes de booking.routes.js reste inchangé)
// J'inclus le reste du fichier pour que vous puissiez tout copier-coller

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

router.get('/my-unread-count', isAuthenticated, async (req, res) => {
    try {
        const userId = req.auth._id;
        const count = await Booking.countDocuments({ user: userId, isReadByUser: false });
        res.status(200).json({ count });
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

router.patch('/mark-all-as-read', isAuthenticated, async (req, res) => {
    try {
        const userId = req.auth._id;
        await Booking.updateMany({ user: userId, isReadByUser: false }, { isReadByUser: true });
        res.status(200).json({ message: 'Notifications marquées comme lues.' });
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

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

router.patch('/:bookingId/hide', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { bookingId } = req.params;
        await Booking.findByIdAndUpdate(bookingId, { $addToSet: { hiddenForAdmins: req.auth._id } });
        res.status(200).json({ message: 'Réservation masquée avec succès.' });
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

router.patch('/:bookingId/unhide', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { bookingId } = req.params;
        await Booking.findByIdAndUpdate(bookingId, { $pull: { hiddenForAdmins: req.auth._id } });
        res.status(200).json({ message: 'Réservation restaurée avec succès.' });
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

router.post('/:bookingId/review', isAuthenticated, async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { rating, comment } = req.body;
        const user = req.auth;
        if (!rating || !comment) {
            return res.status(400).json({ message: 'Une note et un commentaire sont requis.' });
        }
        const booking = await Booking.findOne({ _id: bookingId, user: user._id });
        if (!booking) return res.status(404).json({ message: 'Réservation non trouvée.' });
        if (booking.status !== 'Terminée') return res.status(403).json({ message: 'Vous ne pouvez laisser un avis que sur une prestation terminée.' });
        if (booking.hasBeenReviewed) return res.status(403).json({ message: 'Vous avez déjà laissé un avis pour cette prestation.' });
        const newReview = {
            user: user._id,
            username: user.username,
            profilePicture: user.profilePicture,
            rating,
            comment,
            booking: bookingId
        };
        await Service.findByIdAndUpdate(booking.service, {
            $push: { reviews: { $each: [newReview], $position: 0 } }
        });
        booking.hasBeenReviewed = true;
        await booking.save();
        const updatedService = await Service.findById(booking.service)
            .populate('comments.user', 'username profilePicture')
            .populate('reviews.user', 'username profilePicture');
        req.io.emit('serviceUpdated', updatedService);
        res.status(201).json({ message: 'Merci pour votre avis !' });
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

module.exports = router;