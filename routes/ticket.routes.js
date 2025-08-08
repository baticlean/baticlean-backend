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


// ✅ CORRECTION FINALE POUR LA LOGIQUE ADMIN / SUPERADMIN
// Route pour qu'un admin "réclame" un ticket
router.patch('/:ticketId/claim', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { ticketId } = req.params;
        const adminId = req.auth._id;
        const adminRole = req.auth.role;

        let findQuery = { _id: ticketId };

        // Un admin normal ne peut prendre qu'un ticket non assigné.
        if (adminRole === 'admin') {
            findQuery.assignedAdmin = null;
        }
        // Un superAdmin n'a pas cette restriction et peut réclamer n'importe quel ticket.

        const updatedTicket = await Ticket.findOneAndUpdate(
            findQuery,
            { 
                assignedAdmin: adminId, 
                status: 'Pris en charge',
                $addToSet: { readByAdmins: adminId }
            },
            { new: true }
        ).populate('user', 'username').populate('assignedAdmin', 'username');

        if (!updatedTicket) {
             return res.status(404).json({ message: 'Ticket non trouvé ou déjà pris en charge par un autre administrateur.' });
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

// Route pour ajouter un message à un ticket existant
router.post('/:ticketId/messages', isAuthenticated, async (req, res) => {
    try {
        const { ticketId } = req.params;
        const { text } = req.body;
        const senderId = req.auth._id;
        // La méthode .includes() gère bien les cas 'admin' et 'superAdmin'
        const isSenderAdmin = req.auth.role.includes('admin');

        const newMessage = { sender: senderId, text, senderType: isSenderAdmin ? 'admin' : 'user' };
        let updateQuery;

        if (isSenderAdmin) {
            // Un admin ou superAdmin répond
            updateQuery = {
                $push: { messages: newMessage },
                $set: { isReadByUser: false },
                $addToSet: { readByAdmins: senderId }
            };
        } else {
            // Un client répond
            updateQuery = {
                $push: { messages: newMessage },
                $set: { readByAdmins: [] }
            };
        }

        const ticketAfterUpdate = await Ticket.findByIdAndUpdate(ticketId, updateQuery, { new: true });

        if (!ticketAfterUpdate) {
            return res.status(404).json({ message: 'Ticket non trouvé.' });
        }

        const populatedTicket = await Ticket.findById(ticketAfterUpdate._id)
            .populate('user', 'username')
            .populate('messages.sender', 'username profilePicture')
            .populate('assignedAdmin', 'username');

        req.io.emit('ticketUpdated', populatedTicket);
        await broadcastNotificationCounts(req);

        res.status(200).json(populatedTicket);

    } catch (error) {
        console.error("Erreur lors de l'ajout d'un message:", error);
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