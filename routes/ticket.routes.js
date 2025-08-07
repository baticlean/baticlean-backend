const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket.model');
const { isAuthenticated, isAdmin } = require('../middleware/isAdmin.js');
const { broadcastNotificationCounts } = require('../utils/notifications.js');

router.post('/', isAuthenticated, async (req, res) => {
  try {
    const { messages } = req.body;
    const userId = req.auth._id;
    if (!messages || messages.length === 0) {
      return res.status(400).json({ message: 'Impossible de créer un ticket vide.' });
    }
    const newTicket = await Ticket.create({ user: userId, messages });

    req.io.emit('newTicket', newTicket);
    broadcastNotificationCounts(req.io); // Met à jour les compteurs

    res.status(201).json(newTicket);
  } catch (error) {
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

router.get('/', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const tickets = await Ticket.find().populate('user', 'username email').sort({ createdAt: -1 });
        res.status(200).json(tickets);
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

router.delete('/:ticketId', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { ticketId } = req.params;
        const deletedTicket = await Ticket.findByIdAndDelete(ticketId);
        if (!deletedTicket) {
            return res.status(404).json({ message: 'Ticket non trouvé.' });
        }
        req.io.emit('ticketDeleted', { _id: ticketId });
        broadcastNotificationCounts(req.io); // Met à jour les compteurs
        res.status(200).json({ message: 'Ticket supprimé avec succès.' });
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

module.exports = router;