// Fichier : backend/routes/ticket.routes.js

const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket.model');
const { isAuthenticated, isAdmin } = require('../middleware/isAdmin.js');
const { broadcastNotificationCounts } = require('../utils/notifications.js');

// Route pour créer un nouveau ticket
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

        const newTicket = await Ticket.create({
            user: userId,
            messages: formattedMessages,
            readByAdmins: []
        });

        const populatedTicket = await Ticket.findById(newTicket._id).populate('user', 'username email');

        req.io.emit('newTicket', populatedTicket);
        await broadcastNotificationCounts(req);

        res.status(201).json(populatedTicket);
    } catch (error) {
        console.error("Erreur détaillée lors de la création du ticket:", error);
        res.status(500).json({ message: 'Erreur interne du serveur lors de la création du ticket.' });
    }
});


// Route pour qu'un admin "réclame" un ticket
router.patch('/:ticketId/claim', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { ticketId } = req.params;
        const adminId = req.auth._id;

        const updatedTicket = await Ticket.findOneAndUpdate(
            { _id: ticketId, assignedAdmin: null },
            { 
                assignedAdmin: adminId, 
                status: 'Pris en charge',
                $addToSet: { readByAdmins: adminId }
            },
            { new: true }
        ).populate('user', 'username').populate('assignedAdmin', 'username');

        if (!updatedTicket) {
             return res.status(404).json({ message: 'Ticket non trouvé ou déjà pris en charge.' });
        }

        req.io.emit('ticketUpdated', updatedTicket);
        await broadcastNotificationCounts(req);

        res.status(200).json(updatedTicket);
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

// Route pour obtenir les tickets d'un utilisateur
router.get('/my-tickets', isAuthenticated, async (req, res) => {
    try {
        const tickets = await Ticket.find({ user: req.auth._id }).populate('messages.sender', 'username profilePicture').sort({ updatedAt: -1 });
        res.status(200).json(tickets);
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

// Route pour obtenir tous les tickets (admins)
router.get('/', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const tickets = await Ticket.find({ hiddenForAdmins: { $ne: req.auth._id } })
            .populate('user', 'username email')
            .populate('messages.sender', 'username profilePicture')
            .populate('assignedAdmin', 'username')
            .sort({ updatedAt: -1 });
        res.status(200).json(tickets);
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

// ✅✅✅ CORRECTION PRINCIPALE ET FINALE ✅✅✅
// Route pour ajouter un message à un ticket existant (version atomique)
router.post('/:ticketId/messages', isAuthenticated, async (req, res) => {
    try {
        const { ticketId } = req.params;
        const { text } = req.body;
        const senderId = req.auth._id;
        const senderRole = req.auth.role.includes('admin') ? 'admin' : 'user';

        const newMessage = { sender: senderId, text, senderType: senderRole };

        let updateQuery;

        if (senderRole === 'admin') {
            // Si l'admin répond :
            // 1. Ajoute le message
            // 2. Met le ticket en "non lu" pour le CLIENT
            // 3. S'assure que l'admin actuel est dans la liste des lecteurs (pour ne pas se notifier lui-même)
            updateQuery = {
                $push: { messages: newMessage },
                $set: { isReadByUser: false },
                $addToSet: { readByAdmins: senderId }
            };
        } else {
            // Si le client répond :
            // 1. Ajoute le message
            // 2. Vide la liste des lecteurs admin pour que TOUS les admins soient notifiés
            updateQuery = {
                $push: { messages: newMessage },
                $set: { readByAdmins: [] }
            };
        }

        // On exécute la mise à jour atomique
        const ticketAfterUpdate = await Ticket.findByIdAndUpdate(ticketId, updateQuery, { new: true });

        if (!ticketAfterUpdate) {
            return res.status(404).json({ message: 'Ticket non trouvé.' });
        }

        // On peuple le ticket mis à jour pour l'envoyer au frontend
        const populatedTicket = await Ticket.findById(ticketAfterUpdate._id)
            .populate('user', 'username')
            .populate('messages.sender', 'username profilePicture')
            .populate('assignedAdmin', 'username');

        // On notifie les clients
        req.io.emit('ticketUpdated', populatedTicket);
        await broadcastNotificationCounts(req);

        res.status(200).json(populatedTicket);

    } catch (error) {
        console.error("Erreur en ajoutant un message:", error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});


// Route pour marquer un ticket comme lu
router.patch('/:ticketId/mark-as-read', isAuthenticated, async (req, res) => {
    try {
        const { ticketId } = req.params;
        const user = req.auth;

        let updateQuery = {};
        if (user.role.includes('admin')) {
            updateQuery = { $addToSet: { readByAdmins: user._id } };
        } else {
            updateQuery = { isReadByUser: true };
        }

        const updatedTicket = await Ticket.findByIdAndUpdate(ticketId, updateQuery, { new: true })
            .populate('user', 'username').populate('messages.sender', 'username profilePicture').populate('assignedAdmin', 'username');

        if (!updatedTicket) return res.status(404).json({ message: 'Ticket non trouvé.' });

        req.io.emit('ticketUpdated', updatedTicket);
        await broadcastNotificationCounts(req);
        res.status(200).json(updatedTicket);
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

// Route pour masquer un ticket pour un admin
router.patch('/:ticketId/hide', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { ticketId } = req.params;
        const adminId = req.auth._id;
        await Ticket.findByIdAndUpdate(ticketId, { $addToSet: { hiddenForAdmins: adminId } });
        res.status(200).json({ message: 'Ticket masqué avec succès.' });
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

module.exports = router;