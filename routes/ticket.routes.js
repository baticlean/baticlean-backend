const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket.model');
const { isAuthenticated, isAdmin } = require('../middleware/isAdmin.js');
const { broadcastNotificationCountsToAdmins } = require('../utils/notifications.js');

// Créer un nouveau ticket depuis le chatbot
router.post('/', isAuthenticated, async (req, res) => {
  try {
    const { messages } = req.body;
    const userId = req.auth._id;
    if (!messages || messages.length === 0) {
      return res.status(400).json({ message: 'Impossible de créer un ticket vide.' });
    }

    const formattedMessages = messages.map(msg => ({
        sender: msg.sender === 'user' ? userId : null,
        senderType: msg.sender,
        text: msg.text
    }));

    const newTicket = await Ticket.create({ user: userId, messages: formattedMessages });

    const populatedTicket = await Ticket.findById(newTicket._id).populate('user', 'username email');
    req.io.emit('newTicket', populatedTicket);

    // --- CORRECTION AJOUTÉE ICI ---
    // On envoie la mise à jour des compteurs à tous les admins en ligne
    broadcastNotificationCountsToAdmins(req.io, req.onlineUsers);

    res.status(201).json(newTicket);
  } catch (error) {
    console.error("Erreur lors de la création du ticket:", error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

// Obtenir tous les tickets d'un utilisateur
router.get('/my-tickets', isAuthenticated, async (req, res) => {
    try {
        const tickets = await Ticket.find({ user: req.auth._id }).populate('messages.sender', 'username profilePicture').sort({ updatedAt: -1 });
        res.status(200).json(tickets);
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

// Obtenir tous les tickets (pour les admins)
router.get('/', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const tickets = await Ticket.find().populate('user', 'username email').populate('messages.sender', 'username profilePicture').sort({ updatedAt: -1 });
        res.status(200).json(tickets);
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

// Ajouter un message à un ticket
router.post('/:ticketId/messages', isAuthenticated, async (req, res) => {
    try {
        const { ticketId } = req.params;
        const { text } = req.body;
        const ticket = await Ticket.findById(ticketId);
        if (!ticket) return res.status(404).json({ message: 'Ticket non trouvé.' });

        const senderRole = req.auth.role.includes('admin') ? 'admin' : 'user';
        ticket.messages.push({ sender: req.auth._id, text, senderType: senderRole });

        if (senderRole === 'admin') {
            ticket.isReadByUser = false;
            ticket.status = 'En attente de réponse';
        } else {
            ticket.isReadByAdmin = false;
            ticket.status = 'Ouvert';
        }

        await ticket.save();
        const updatedTicket = await Ticket.findById(ticketId).populate('user', 'username').populate('messages.sender', 'username profilePicture');

        req.io.emit('ticketUpdated', updatedTicket);
        broadcastNotificationCountsToAdmins(req.io, req.onlineUsers);
        res.status(200).json(updatedTicket);
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

// Marquer un ticket comme lu
router.patch('/:ticketId/mark-as-read', isAuthenticated, async (req, res) => {
    try {
        const { ticketId } = req.params;
        const ticket = await Ticket.findById(ticketId);
        if (!ticket) return res.status(404).json({ message: 'Ticket non trouvé.' });

        if (req.auth.role.includes('admin')) {
            ticket.isReadByAdmin = true;
        } else {
            ticket.isReadByUser = true;
        }
        await ticket.save();

        const updatedTicket = await Ticket.findById(ticketId).populate('user', 'username').populate('messages.sender', 'username profilePicture');
        req.io.emit('ticketUpdated', updatedTicket);
        broadcastNotificationCountsToAdmins(req.io, req.onlineUsers);
        res.status(200).json(updatedTicket);
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

// Supprimer un ticket
router.delete('/:ticketId', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { ticketId } = req.params;
        const deletedTicket = await Ticket.findByIdAndDelete(ticketId);
        if (!deletedTicket) return res.status(404).json({ message: 'Ticket non trouvé.' });

        req.io.emit('ticketDeleted', { _id: ticketId });
        broadcastNotificationCountsToAdmins(req.io, req.onlineUsers);
        res.status(200).json({ message: 'Ticket supprimé avec succès.' });
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

module.exports = router;