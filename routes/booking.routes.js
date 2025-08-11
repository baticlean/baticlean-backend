// backend/routes/booking.routes.js

const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking.model');
const Service = require('../models/Service.model');
const User = require('../models/User.model');
const { isAuthenticated, isAdmin } = require('../middleware/isAdmin.js');
const { broadcastNotificationCounts } = require('../utils/notifications.js');
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

        const newBooking = await Booking.create({ 
            service: serviceId, 
            user: userId, 
            bookingDate, 
            bookingTime, 
            address, 
            phoneNumber, 
            notes, 
            readByAdmins: [],
            timeline: [{ status: 'En attente', eventDate: new Date() }]
        });
        
        const populatedBooking = await Booking.findById(newBooking._id).populate('user').populate('service');

        await sendBookingConfirmationEmail(populatedBooking.user, populatedBooking, populatedBooking.service);

        req.io.emit('newBooking', populatedBooking);
        await broadcastNotificationCounts(req);
        res.status(201).json(populatedBooking);
    } catch (error) {
        console.error("Erreur lors de la création de la réservation:", error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

// Annuler sa propre réservation
router.patch('/:bookingId/cancel', isAuthenticated, async (req, res) => {
    try {
        const { bookingId } = req.params;
        const userId = req.auth._id;
        let booking = await Booking.findOne({ _id: bookingId, user: userId });
        if (!booking) {
            return res.status(404).json({ message: 'Réservation non trouvée.' });
        }
        if (booking.status !== 'En attente') {
            return res.status(400).json({ message: 'Cette réservation ne peut plus être annulée.' });
        }
        booking.status = 'Annulée';
        booking.timeline.push({ status: 'Annulée', eventDate: new Date() });
        booking.readByAdmins = [];
        const updatedBooking = await booking.save();
        
        const populatedBooking = await Booking.findById(updatedBooking._id).populate('user').populate('service');

        await sendCancellationEmail(populatedBooking.user, populatedBooking, populatedBooking.service);

        req.io.emit('bookingUpdated', populatedBooking);
        await broadcastNotificationCounts(req);
        res.status(200).json(populatedBooking);
    } catch (error) {
        console.error("Erreur lors de l'annulation de la réservation:", error);
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
        
        // ✅ SÉCURITÉ AJOUTÉE : On bloque la modification si la réservation est déjà dans un état final.
        if (bookingToUpdate.status === 'Annulée' || bookingToUpdate.status === 'Terminée') {
            return res.status(400).json({ 
                message: `Impossible de modifier une réservation qui est déjà '${bookingToUpdate.status}'.` 
            });
        }
        
        // Le reste de la logique ne s'exécute que si la garde passe
        bookingToUpdate.status = status;
        bookingToUpdate.timeline.push({ status, eventDate: new Date() });
        bookingToUpdate.readByAdmins.addToSet(adminId);
        bookingToUpdate.isReadByUser = false;

        await bookingToUpdate.save();
        
        const populatedBooking = await Booking.findById(bookingId).populate('user').populate('service');

        console.log(`[Email Log] Tentative d'envoi pour le statut : ${status}`);
        console.log(`[Email Log] Données utilisateur :`, populatedBooking.user ? populatedBooking.user.email : "Utilisateur non trouvé");
        console.log(`[Email Log] Données service :`, populatedBooking.service ? populatedBooking.service.title : "Service non trouvé");

        if (!populatedBooking.user || !populatedBooking.service) {
            throw new Error("Impossible de trouver les données de l'utilisateur ou du service pour l'envoi de l'email.");
        }

        if (status === 'Terminée') {
            await sendReviewRequestEmail(populatedBooking.user, populatedBooking, populatedBooking.service);
        } else {
            await sendStatusUpdateEmail(populatedBooking.user, populatedBooking, populatedBooking.service);
        }
        console.log(`[Email Log] Email pour le statut '${status}' envoyé avec succès à ${populatedBooking.user.email}`);

        const userId = populatedBooking.user._id.toString();
        const userSocketId = req.onlineUsers[userId];
        if (userSocketId) {
            req.io.to(userSocketId).emit('bookingStatusChanged', {
                message: `Votre réservation #${populatedBooking._id.toString().slice(-6)} a été ${status.toLowerCase()}.`,
                booking: populatedBooking
            });
        }
        
        await broadcastNotificationCounts(req);
        res.status(200).json(populatedBooking);
    } catch (error) {
        console.error("ERREUR LORS DE LA MISE À JOUR DU STATUT :", error);
        res.status(500).json({ message: 'Erreur interne du serveur lors de la mise à jour du statut.' });
    }
});

// --- AUTRES ROUTES ---

router.get('/my-bookings', isAuthenticated, async (req, res) => {
    try {
        const userId = req.auth._id;
        const showHidden = req.query.hidden === 'true';

        const allUserBookings = await Booking.find({ 
            user: userId,
            hiddenForUser: showHidden
        }).populate('service', 'title images price').sort({ bookingDate: -1 });

        const validUserBookings = allUserBookings.filter(booking => booking.service !== null);

        res.status(200).json(validUserBookings);
    } catch (error) {
        console.error("Erreur dans /my-bookings:", error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

router.patch('/:bookingId/toggle-hide', isAuthenticated, async (req, res) => {
    try {
        const { bookingId } = req.params;
        const userId = req.auth._id;
        const { hide } = req.body;
        const booking = await Booking.findOne({ _id: bookingId, user: userId });
        if (!booking) return res.status(404).json({ message: 'Réservation non trouvée ou non autorisée.' });
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

        const validBookings = allBookings.filter(b => b.user && b.service);
            
        res.status(200).json(validBookings);
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
        
        const serviceExists = await Service.findById(booking.service);
        if (!serviceExists) {
            return res.status(404).json({ message: 'Le service associé à cette réservation n\'existe plus.' });
        }

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