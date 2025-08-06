// routes/notification.routes.js
const express = require('express');
const router = express.Router();
const User = require('../models/User.model');
const Ticket = require('../models/Ticket.model');
const Booking = require('../models/Booking.model');
const Reclamation = require('../models/Reclamation.model');
const { isAuthenticated, isAdmin } = require('../middleware/isAdmin.js');

// ROUTE GET /api/notifications/counts - Récupère tous les compteurs
router.get('/counts', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const unreadUsers = await User.countDocuments({ readByAdmin: false, role: { $ne: 'superAdmin' } });
    const unreadTickets = await Ticket.countDocuments({ readByAdmin: false });
    const unreadBookings = await Booking.countDocuments({ readByAdmin: false });
    const unreadReclamations = await Reclamation.countDocuments({ readByAdmin: false });

    res.status(200).json({
      users: unreadUsers,
      tickets: unreadTickets,
      bookings: unreadBookings,
      reclamations: unreadReclamations,
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

// ROUTE PATCH /api/notifications/:type/mark-as-read - Met un compteur à zéro
router.patch('/:type/mark-as-read', isAuthenticated, isAdmin, async (req, res) => {
    const { type } = req.params;
    let Model;

    switch (type) {
        case 'users': Model = User; break;
        case 'tickets': Model = Ticket; break;
        case 'bookings': Model = Booking; break;
        case 'reclamations': Model = Reclamation; break;
        default: return res.status(400).json({ message: 'Type invalide.' });
    }

    try {
        await Model.updateMany({ readByAdmin: false }, { $set: { readByAdmin: true } });
        res.status(200).json({ message: `${type} marqués comme lus.` });
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

module.exports = router;