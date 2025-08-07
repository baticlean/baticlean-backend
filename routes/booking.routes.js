const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking.model');
const { isAuthenticated, isAdmin } = require('../middleware/isAdmin.js');

// ROUTE POST /api/bookings - Un utilisateur crée une réservation
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
    });

    req.io.emit('newNotification');
    res.status(201).json(newBooking);
  } catch (error) {
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

// ROUTE GET /api/bookings/my-bookings - Un utilisateur voit ses propres réservations
router.get('/my-bookings', isAuthenticated, async (req, res) => {
    try {
        const userId = req.auth._id;
        const userBookings = await Booking.find({ user: userId })
            .populate('service', 'title images price')
            .sort({ createdAt: -1 });
        res.status(200).json(userBookings);
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

// ROUTE GET /api/bookings - Un admin récupère toutes les réservations
router.get('/', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const allBookings = await Booking.find()
            .populate('user', 'username email')
            .populate('service', 'title')
            .sort({ createdAt: -1 });
        res.status(200).json(allBookings);
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

// ROUTE PATCH /api/bookings/:bookingId/status - Un admin met à jour le statut
router.patch('/:bookingId/status', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { status } = req.body;

    if (!['Confirmée', 'Terminée', 'Annulée'].includes(status)) {
      return res.status(400).json({ message: 'Statut invalide.' });
    }

    const updatedBooking = await Booking.findByIdAndUpdate(
      bookingId,
      { 
        status,
        readByClient: false,
        $push: { timeline: { status } }
      },
      { new: true }
    ).populate('user', 'username').populate('service', 'title');

    if (!updatedBooking) {
      return res.status(404).json({ message: 'Réservation non trouvée.' });
    }
    const userSocketId = req.onlineUsers[updatedBooking.user._id.toString()];
    if (userSocketId) {
      req.io.to(userSocketId).emit('bookingUpdated', updatedBooking);
    }
    res.status(200).json(updatedBooking);
  } catch (error) {
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

// ROUTE PATCH /api/bookings/:bookingId/cancel - Un utilisateur annule sa réservation
router.patch('/:bookingId/cancel', isAuthenticated, async (req, res) => {
    try {
        const { bookingId } = req.params;
        const userId = req.auth._id;
        const booking = await Booking.findById(bookingId);
        if (!booking) { return res.status(404).json({ message: 'Réservation non trouvée.' }); }
        if (booking.user.toString() !== userId) { return res.status(403).json({ message: 'Action non autorisée.' }); }
        if (booking.status !== 'En attente') { return res.status(400).json({ message: 'Vous ne pouvez plus annuler cette réservation.' }); }

        booking.status = 'Annulée';
        booking.timeline.push({ status: 'Annulée' });
        await booking.save();

        const updatedBooking = await Booking.findById(bookingId).populate('service', 'title');

        const userSocketId = req.onlineUsers[userId];
        if (userSocketId) {
            req.io.to(userSocketId).emit('bookingUpdated', updatedBooking);
        }

        req.io.emit('newNotification');

        res.status(200).json(updatedBooking);
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

// --- NOUVELLE ROUTE ---
// ROUTE DELETE /api/bookings/:bookingId - Pour supprimer une réservation
router.delete('/:bookingId', isAuthenticated, async (req, res) => {
    try {
        const { bookingId } = req.params;
        const userRole = req.auth.role;
        const userId = req.auth._id;

        const bookingToDelete = await Booking.findById(bookingId);
        if (!bookingToDelete) {
            return res.status(404).json({ message: 'Réservation non trouvée.' });
        }

        // Seul un admin ou l'utilisateur lui-même peut supprimer
        if (userRole !== 'admin' && userRole !== 'superAdmin' && bookingToDelete.user.toString() !== userId) {
            return res.status(403).json({ message: 'Action non autorisée.' });
        }

        await Booking.findByIdAndDelete(bookingId);

        req.io.emit('newNotification'); // Notifie les admins

        res.status(200).json({ message: 'Réservation supprimée avec succès.' });
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

module.exports = router;