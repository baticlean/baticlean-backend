const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket.model');
const { isAuthenticated, isAdmin } = require('../middleware/isAdmin.js');

// ROUTE POST /api/tickets - Un utilisateur crée un ticket
router.post('/', isAuthenticated, async (req, res) => {
  try {
    const { messages } = req.body;
    const userId = req.auth._id;

    if (!messages || messages.length === 0) {
      return res.status(400).json({ message: 'Impossible de créer un ticket vide.' });
    }

    const newTicket = await Ticket.create({ user: userId, messages });

    // On notifie les admins qu'un nouveau ticket a été créé
    req.io.emit('newNotification');

    res.status(201).json(newTicket);
  } catch (error) {
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

// ROUTE GET /api/tickets - Un admin récupère tous les tickets
router.get('/', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const tickets = await Ticket.find().populate('user', 'username email').sort({ createdAt: -1 });
        res.status(200).json(tickets);
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

// NOUVELLE ROUTE - Pour supprimer un ticket
router.delete('/:ticketId', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { ticketId } = req.params;
        const deletedTicket = await Ticket.findByIdAndDelete(ticketId);

        if (!deletedTicket) {
            return res.status(404).json({ message: 'Ticket non trouvé.' });
        }

        req.io.emit('newNotification');

        res.status(200).json({ message: 'Ticket supprimé avec succès.' });
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

module.exports = router;