// routes/booking.routes.js
const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking.model');
const { isAuthenticated, isAdmin } = require('../middleware/isAdmin.js');

// ROUTE POST /api/bookings - Un utilisateur crée une réservation
router.post('/', isAuthenticated, async (req, res) => {
  try {
    const { serviceId, bookingDate, notes } = req.body;
    const userId = req.auth._id;

    if (!serviceId || !bookingDate) {
      return res.status(400).json({ message: 'Le service et la date sont requis.' });
    }

    const newBooking = await Booking.create({
      service: serviceId,
      user: userId,
      bookingDate,
      notes,
    });
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
            .sort({ bookingDate: -1 });
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
            .sort({ bookingDate: -1 });
        res.status(200).json(allBookings);
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

module.exports = router;