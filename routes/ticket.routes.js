const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket.model');
const { isAuthenticated, isAdmin } = require('../middleware/isAdmin.js');
const { broadcastNotificationCountsToAdmins } = require('../utils/notifications.js');

// Créer un nouveau ticket
router.post('/', isAuthenticated, async (req, res) => {
  try {
    // --- ESPION 1 ---
    console.log("--- ESPION : REQUÊTE REÇUE POUR CRÉER UN TICKET ---");
    console.log("Contenu reçu (req.body):", JSON.stringify(req.body, null, 2));

    const { messages } = req.body;
    const userId = req.auth._id;

    if (!messages || messages.length === 0) {
      return res.status(400).json({ message: 'Impossible de créer un ticket vide.' });
    }

    const newTicket = await Ticket.create({
      user: userId,
      subject: "Conversation avec l'assistant IA",
      messages: messages 
    });

    // --- ESPION 2 ---
    console.log("--- ESPION : TICKET CRÉÉ AVEC SUCCÈS ---");

    req.io.emit('newTicket', newTicket);
    broadcastNotificationCountsToAdmins(req.io, req.onlineUsers);

    res.status(201).json(newTicket);
  } catch (error) {
    // --- ESPION 3 (LE PLUS IMPORTANT) ---
    console.error("--- ESPION : ERREUR LORS DE LA CRÉATION DU TICKET ---");
    console.error(error); // Affiche l'erreur complète de la base de données
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

// Obtenir tous les tickets d'un utilisateur
router.get('/my-tickets', isAuthenticated, async (req, res) => {
    try {
        const tickets = await Ticket.find({ user: req.auth._id }).sort({ updatedAt: -1 });
        res.status(200).json(tickets);
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

// Obtenir tous les tickets (pour les admins)
router.get('/', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const tickets = await Ticket.find().populate('user', 'username email').sort({ createdAt: -1 });
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
        if (!deletedTicket) {
            return res.status(404).json({ message: 'Ticket non trouvé.' });
        }
        req.io.emit('ticketDeleted', { _id: ticketId });
        broadcastNotificationCountsToAdmins(req.io, req.onlineUsers);
        res.status(200).json({ message: 'Ticket supprimé avec succès.' });
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
        broadcastNotificationCountsToAdmins(req.io, req.onlineUsers);
        res.status(200).json({ message: 'Ticket marqué comme lu.' });
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

// Ajouter un message à un ticket
router.post('/:ticketId/messages', isAuthenticated, async (req, res) => {
    try {
        const { ticketId } = req.params;
        const { text, attachments } = req.body;
        const ticket = await Ticket.findById(ticketId);
        if (!ticket) return res.status(404).json({ message: 'Ticket non trouvé.' });

        // Note: Cette partie devra être adaptée pour la messagerie complète plus tard
        const newMessage = { sender: 'user', text }; // Simplifié pour l'instant
        ticket.messages.push(newMessage);

        await ticket.save();
        const updatedTicket = await Ticket.findById(ticketId);

        req.io.emit('ticketMessageAdded', updatedTicket);
        broadcastNotificationCountsToAdmins(req.io, req.onlineUsers);

        res.status(200).json(updatedTicket);
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

module.exports = router;