// Fichier : backend/routes/ticket.routes.js
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
        const newTicket = await Ticket.create({ user: userId, messages: messages, isReadByAdmin: false });
        const populatedTicket = await Ticket.findById(newTicket._id).populate('user', 'username email');

        req.io.emit('newTicket', populatedTicket);
        await broadcastNotificationCounts(req); // CORRECTION ICI

        res.status(201).json(populatedTicket);
    } catch (error) {
        console.error("Erreur lors de la création du ticket:", error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

router.patch('/:ticketId/claim', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { ticketId } = req.params;
        const adminId = req.auth._id;
        const ticket = await Ticket.findById(ticketId);
        if (!ticket) return res.status(404).json({ message: 'Ticket non trouvé.' });
        if (ticket.assignedAdmin) return res.status(400).json({ message: 'Ce ticket est déjà pris en charge.' });

        ticket.assignedAdmin = adminId;
        ticket.status = 'Pris en charge';
        await ticket.save();
        const updatedTicket = await Ticket.findById(ticketId).populate('user', 'username').populate('assignedAdmin', 'username');
        req.io.emit('ticketUpdated', updatedTicket);
        res.status(200).json(updatedTicket);
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

router.get('/my-tickets', isAuthenticated, async (req, res) => {
    try {
        const tickets = await Ticket.find({ user: req.auth._id }).populate('messages.sender', 'username profilePicture').sort({ updatedAt: -1 });
        res.status(200).json(tickets);
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

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

router.post('/:ticketId/messages', isAuthenticated, async (req, res) => {
    try {
        const { ticketId } = req.params;
        const { text } = req.body;
        const ticket = await Ticket.findById(ticketId);
        if (!ticket) return res.status(404).json({ message: 'Ticket non trouvé.' });

        const senderRole = req.auth.role.includes('admin') ? 'admin' : 'user';
        ticket.messages.push({ sender: req.auth._id, text, senderType: senderRole });

        if (senderRole === 'admin') ticket.isReadByUser = false;
        else ticket.isReadByAdmin = false;

        await ticket.save();
        const updatedTicket = await Ticket.findById(ticketId).populate('user', 'username').populate('messages.sender', 'username profilePicture').populate('assignedAdmin', 'username');

        req.io.emit('ticketUpdated', updatedTicket);
        await broadcastNotificationCounts(req); // CORRECTION ICI
        res.status(200).json(updatedTicket);
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

router.patch('/:ticketId/mark-as-read', isAuthenticated, async (req, res) => {
    try {
        const { ticketId } = req.params;
        const ticket = await Ticket.findById(ticketId);
        if (!ticket) return res.status(404).json({ message: 'Ticket non trouvé.' });

        if (req.auth.role.includes('admin')) ticket.isReadByAdmin = true;
        else ticket.isReadByUser = true;

        await ticket.save();
        const updatedTicket = await Ticket.findById(ticketId).populate('user', 'username').populate('messages.sender', 'username profilePicture').populate('assignedAdmin', 'username');

        req.io.emit('ticketUpdated', updatedTicket);
        await broadcastNotificationCounts(req); // CORRECTION ICI
        res.status(200).json(updatedTicket);
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

router.patch('/:ticketId/hide', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { ticketId } = req.params;
        const adminId = req.auth._id;
        const updatedTicket = await Ticket.findByIdAndUpdate(ticketId, { $addToSet: { hiddenForAdmins: adminId } }, { new: true });
        if (!updatedTicket) {
            return res.status(404).json({ message: 'Ticket non trouvé.' });
        }
        res.status(200).json({ message: 'Ticket masqué avec succès.' });
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

module.exports = router;