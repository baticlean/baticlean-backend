const express = require('express');
const router = express.Router();
const { isAuthenticated, isAdmin } = require('../middleware/isAdmin.js');

const User = require('../models/User.model');
const Ticket = require('../models/Ticket.model');
const Booking = require('../models/Booking.model');
const Reclamation = require('../models/Reclamation.model');

// ROUTE 1 : Compter les notifications non lues
router.get('/counts', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const userCount = await User.countDocuments({ isNew: true });
    const ticketCount = await Ticket.countDocuments({ readByAdmin: false });
    const bookingCount = await Booking.countDocuments({ status: 'En attente' });
    const reclamationCount = await Reclamation.countDocuments({ readByAdmin: false });

    res.status(200).json({
      users: userCount,
      tickets: ticketCount,
      bookings: bookingCount,
      reclamations: reclamationCount,
    });
  } catch (error) {
    console.error("Erreur lors du comptage des notifications:", error);
    res.status(500).json({ message: "Erreur interne du serveur." });
  }
});

// ROUTE 2 : Marquer les notifications comme lues
router.patch('/:type/mark-as-read', isAuthenticated, isAdmin, async (req, res) => {
    const { type } = req.params;
    let updatePromise;

    switch (type) {
        case 'users':
            updatePromise = User.updateMany({ isNew: true }, { $set: { isNew: false } });
            break;
        case 'tickets':
            updatePromise = Ticket.updateMany({ readByAdmin: false }, { $set: { readByAdmin: true } });
            break;
        case 'reclamations':
            updatePromise = Reclamation.updateMany({ readByAdmin: false }, { $set: { readByAdmin: true } });
            break;
        case 'bookings':
            updatePromise = Promise.resolve();
            break;
        default:
            return res.status(400).json({ message: 'Type de notification inconnu.' });
    }

    try {
        await updatePromise;
        res.status(200).json({ message: `Notifications de type '${type}' marquées comme lues.` });
    } catch (error) {
        console.error(`Erreur lors de la mise à jour des notifications de type '${type}':`, error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

module.exports = router;