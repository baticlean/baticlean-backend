const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket.model');
const { isAuthenticated, isAdmin } = require('../middleware/isAdmin.js');
const { broadcastNotificationCountsToAdmins } = require('../utils/notifications.js');

// --- ROUTES POUR LES UTILISATEURS ---

// Obtenir tous les tickets d'un utilisateur
router.get('/my-tickets', isAuthenticated, async (req, res) => {
    try {
        const tickets = await Ticket.find({ user: req.auth._id }).sort({ updatedAt: -1 });
        res.status(200).json(tickets);
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

// Créer un nouveau ticket
router.post('/', isAuthenticated, async (req, res) => {
  try {
    const { subject, message, attachments } = req.body;
    const newMessage = { sender: req.auth._id, text: message, attachments: attachments || [] };
    const newTicket = await Ticket.create({ user: req.auth._id, subject, messages: [newMessage] });

    req.io.emit('newTicket', newTicket);
    broadcastNotificationCountsToAdmins(req.io, req.onlineUsers);
    res.status(201).json(newTicket);
  } catch (error) {
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

// Ajouter un message à un ticket existant (par l'utilisateur ou l'admin)
router.post('/:ticketId/messages', isAuthenticated, async (req, res) => {
    try {
        const { ticketId } = req.params;
        const { text, attachments } = req.body;
        const ticket = await Ticket.findById(ticketId);
        if (!ticket) return res.status(404).json({ message: 'Ticket non trouvé.' });

        const newMessage = { sender: req.auth._id, text, attachments: attachments || [] };
        ticket.messages.push(newMessage);

        // Mise à jour des statuts de lecture et du statut du ticket
        if (req.auth.role.includes('admin')) {
            ticket.isReadByUser = false;
            ticket.status = 'En attente de réponse';
            ticket.assignedAdmin = req.auth._id; // On assigne l'admin qui a répondu
        } else {
            ticket.isReadByAdmin = false;
            ticket.status = 'Ouvert';
        }

        await ticket.save();
        const updatedTicket = await Ticket.findById(ticketId).populate('messages.sender', 'username profilePicture');

        // Notifier l'autre partie en temps réel
        req.io.emit('ticketMessageAdded', updatedTicket);
        broadcastNotificationCountsToAdmins(req.io, req.onlineUsers);

        res.status(200).json(updatedTicket);
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

// --- ROUTES POUR LES ADMINS ---

// Obtenir tous les tickets
router.get('/', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const tickets = await Ticket.find().populate('user', 'username email').sort({ updatedAt: -1 });
        res.status(200).json(tickets);
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

// Marquer un ticket comme lu (quand un utilisateur ou un admin ouvre la conversation)
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
        broadcastNotificationCountsToAdmins(req.io, req.onlineUsers);
        res.status(200).json({ message: 'Ticket marqué comme lu.' });
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

module.exports = router;