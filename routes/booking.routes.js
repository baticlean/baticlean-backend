const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking.model');
const { isAuthenticated, isAdmin } = require('../middleware/isAdmin.js');
const { broadcastNotificationCountsToAdmins } = require('../utils/notifications.js');

router.post('/', isAuthenticated, async (req, res) => {
  try {
    const { serviceId, bookingDate, bookingTime, address, phoneNumber, notes } = req.body;
    const userId = req.auth._id;
    if (!serviceId || !bookingDate || !bookingTime || !address || !phoneNumber) {
      return res.status(400).json({ message: 'Tous les champs sont requis.' });
    }
    const newBooking = await Booking.create({ service: serviceId, user: userId, bookingDate, bookingTime, address, phoneNumber, notes });

    req.io.emit('newBooking', newBooking);
    broadcastNotificationCountsToAdmins(req.io, req.onlineUsers);

    res.status(201).json(newBooking);
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
    const updatedBooking = await Booking.findByIdAndUpdate(bookingId, { status, $push: { timeline: { status } } }, { new: true }).populate('user', 'username').populate('service', 'title');
    if (!updatedBooking) {
      return res.status(404).json({ message: 'Réservation non trouvée.' });
    }
    const userSocketId = req.onlineUsers[updatedBooking.user._id.toString()];
    if (userSocketId) {
      req.io.to(userSocketId).emit('bookingUpdated', updatedBooking);
    }
    broadcastNotificationCountsToAdmins(req.io, req.onlineUsers);
    res.status(200).json(updatedBooking);
  } catch (error) {
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

router.patch('/:bookingId/cancel', isAuthenticated, async (req, res) => {
    try {
        const { bookingId } = req.params;
        const userId = req.auth._id;
        const booking = await Booking.findById(bookingId);
        if (!booking) return res.status(404).json({ message: 'Réservation non trouvée.' });
        if (booking.user.toString() !== userId) return res.status(403).json({ message: 'Action non autorisée.' });
        if (booking.status !== 'En attente') return res.status(400).json({ message: 'Vous ne pouvez plus annuler cette réservation.' });

        booking.status = 'Annulée';
        booking.timeline.push({ status: 'Annulée' });
        await booking.save();

        const updatedBooking = await Booking.findById(bookingId).populate('service', 'title');
        const userSocketId = req.onlineUsers[userId];
        if (userSocketId) {
            req.io.to(userSocketId).emit('bookingUpdated', updatedBooking);
        }
        broadcastNotificationCountsToAdmins(req.io, req.onlineUsers);
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
        broadcastNotificationCountsToAdmins(req.io, req.onlineUsers);
        res.status(200).json({ message: 'Réservation supprimée avec succès.' });
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

module.exports = router;