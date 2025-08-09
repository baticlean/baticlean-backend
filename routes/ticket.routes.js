// baticlean-backend/routes/ticket.routes.js

const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket.model');
const { isAuthenticated, isAdmin } = require('../middleware/isAdmin.js');
const { broadcastNotificationCounts } = require('../utils/notifications.js');
const uploader = require('../config/cloudinary.config.js');

// Fonction helper pour peupler un ticket avec toutes les informations nécessaires
const populateTicket = (ticketId) => {
    return Ticket.findById(ticketId)
        .populate('user', 'username email')
        .populate('messages.sender', 'username profilePicture')
        .populate('assignedAdmin', 'username');
};

router.post('/', isAuthenticated, async (req, res) => {
    try {
        const { messages } = req.body;
        const userId = req.auth._id;
        if (!messages || messages.length === 0) return res.status(400).json({ message: 'Impossible de créer un ticket vide.' });

        const formattedMessages = messages.map(msg => ({ sender: msg.sender === 'user' ? userId : null, senderType: msg.sender, text: msg.text }));
        const newTicket = await Ticket.create({ user: userId, messages: formattedMessages, readByAdmins: [] });

        const populatedTicket = await populateTicket(newTicket._id);
        req.io.emit('newTicket', populatedTicket);
        await broadcastNotificationCounts(req);
        res.status(201).json(populatedTicket);
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

router.post('/:ticketId/messages', isAuthenticated, uploader.array('files', 5), async (req, res) => {
    try {
        const { ticketId } = req.params;
        const { text } = req.body;
        const senderId = req.auth._id;
        const isSenderAdmin = ['admin', 'superAdmin'].includes(req.auth.role);

        if (!text && (!req.files || req.files.length === 0)) {
            return res.status(400).json({ message: 'Un message ne peut être vide.' });
        }

        const attachments = req.files ? req.files.map(file => ({ url: file.path, fileName: file.originalname, fileType: file.mimetype })) : [];
        const newMessage = { sender: senderId, text: text || '', senderType: isSenderAdmin ? 'admin' : 'user', attachments };

        const updateQuery = isSenderAdmin
            ? { $push: { messages: newMessage }, $set: { isReadByUser: false, status: 'En attente de réponse' }, $addToSet: { readByAdmins: senderId } }
            : { $push: { messages: newMessage }, $set: { readByAdmins: [], status: 'Ouvert' } };

        const ticket = await Ticket.findByIdAndUpdate(ticketId, updateQuery, { new: true });
        if (!ticket) return res.status(404).json({ message: 'Ticket non trouvé.' });

        const populatedTicket = await populateTicket(ticket._id);
        req.io.emit('ticketUpdated', populatedTicket);
        if (!isSenderAdmin) {
            await broadcastNotificationCounts(req);
        }
        res.status(200).json(populatedTicket);
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

// ... (le reste de vos routes reste inchangé, mais est inclus ci-dessous pour un copier-coller complet)

router.patch('/:ticketId/claim', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { ticketId } = req.params;
        const adminId = req.auth._id;
        let findQuery = { _id: ticketId };
        if (req.auth.role === 'admin') findQuery.assignedAdmin = null;

        const ticket = await Ticket.findOneAndUpdate(findQuery, { assignedAdmin: adminId, status: 'Pris en charge', $addToSet: { readByAdmins: adminId } }, { new: true });
        if (!ticket) return res.status(404).json({ message: 'Ticket non trouvé ou déjà pris.' });

        const populatedTicket = await populateTicket(ticket._id);
        req.io.emit('ticketUpdated', populatedTicket);
        await broadcastNotificationCounts(req);
        res.status(200).json(populatedTicket);
    } catch (error) { res.status(500).json({ message: 'Erreur interne.' }); }
});
router.get('/my-tickets', isAuthenticated, async (req, res) => {
    try {
        const showArchived = req.query.archived === 'true';
        const tickets = await Ticket.find({ user: req.auth._id, archivedByUser: showArchived }).populate('messages.sender', 'username profilePicture').sort({ updatedAt: -1 });
        res.status(200).json(tickets);
    } catch (error) { res.status(500).json({ message: 'Erreur interne.' }); }
});
router.get('/', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const showArchived = req.query.archived === 'true';
        const tickets = await Ticket.find({ hiddenForAdmins: { $ne: req.auth._id }, archivedByAdmin: showArchived })
            .populate('user', 'username email').populate('messages.sender', 'username profilePicture').populate('assignedAdmin', 'username').sort({ updatedAt: -1 });
        res.status(200).json(tickets);
    } catch (error) { res.status(500).json({ message: 'Erreur interne.' }); }
});
router.patch('/:ticketId/mark-as-read', isAuthenticated, async (req, res) => {
    try {
        const { ticketId } = req.params;
        const user = req.auth;
        const updateQuery = user.role.includes('admin') ? { $addToSet: { readByAdmins: user._id } } : { isReadByUser: true };

        const ticket = await Ticket.findByIdAndUpdate(ticketId, updateQuery, { new: true });
        if (!ticket) return res.status(404).json({ message: 'Ticket non trouvé.' });

        const populatedTicket = await populateTicket(ticket._id);
        req.io.emit('ticketUpdated', populatedTicket);
        if (user.role.includes('admin')) await broadcastNotificationCounts(req);
        res.status(200).json(populatedTicket);
    } catch (error) { res.status(500).json({ message: 'Erreur interne.' }); }
});
router.patch('/:ticketId/archive', isAuthenticated, async (req, res) => {
    try {
        const { ticketId } = req.params;
        const { archive } = req.body;
        const user = req.auth;
        const ticket = await Ticket.findById(ticketId);
        if (!ticket) return res.status(404).json({ message: 'Ticket non trouvé.' });
        let updateData = {};
        if (['admin', 'superAdmin'].includes(user.role)) {
            updateData.archivedByAdmin = archive;
        } else if (ticket.user.toString() === user._id) {
            updateData.archivedByUser = archive;
        } else {
            return res.status(403).json({ message: 'Action non autorisée.' });
        }
        const updatedTicket = await Ticket.findByIdAndUpdate(ticketId, updateData, { new: true });
        req.io.emit('ticketArchived', { _id: updatedTicket._id, ...updateData });
        res.status(200).json(updatedTicket);
    } catch (error) { res.status(500).json({ message: 'Erreur interne.' }); }
});
router.patch('/:ticketId/hide', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { ticketId } = req.params;
        await Ticket.findByIdAndUpdate(ticketId, { $addToSet: { hiddenForAdmins: req.auth._id } });
        res.status(200).json({ message: 'Ticket masqué.' });
    } catch (error) { res.status(500).json({ message: 'Erreur interne.' }); }
});
router.patch('/:ticketId/messages/:messageId/edit', isAuthenticated, async (req, res) => {
    try {
        const { ticketId, messageId } = req.params;
        const { text } = req.body;
        const userId = req.auth._id;
        const ticket = await Ticket.findById(ticketId);
        const message = ticket.messages.id(messageId);
        if (!message) return res.status(404).json({ message: 'Message non trouvé.' });
        if (message.sender.toString() !== userId) return res.status(403).json({ message: 'Action non autorisée.' });
        message.text = text;
        message.isEdited = true;
        await ticket.save();
        const populatedTicket = await populateTicket(ticket._id);
        req.io.emit('ticketUpdated', populatedTicket);
        res.status(200).json(populatedTicket);
    } catch (error) { res.status(500).json({ message: 'Erreur interne.' }); }
});
router.delete('/:ticketId/messages/:messageId', isAuthenticated, async (req, res) => {
    try {
        const { ticketId, messageId } = req.params;
        const userId = req.auth._id;
        const ticket = await Ticket.findById(ticketId);
        const message = ticket.messages.id(messageId);
        if (!message) return res.status(404).json({ message: 'Message non trouvé.' });
        if (message.sender.toString() !== userId) return res.status(403).json({ message: 'Action non autorisée.' });
        message.isDeleted = true;
        message.text = '';
        message.attachments = [];
        await ticket.save();
        const populatedTicket = await populateTicket(ticket._id);
        req.io.emit('ticketUpdated', populatedTicket);
        res.status(200).json(populatedTicket);
    } catch (error) { res.status(500).json({ message: 'Erreur interne.' }); }
});
router.patch('/:ticketId/messages/:messageId/react', isAuthenticated, async (req, res) => {
    try {
        const { ticketId, messageId } = req.params;
        const { emoji } = req.body;
        const userId = req.auth._id;
        const ticket = await Ticket.findById(ticketId);
        const message = ticket.messages.id(messageId);
        if (!message || message.isDeleted) return res.status(404).json({ message: 'Message non trouvé.' });
        const reactionIndex = message.reactions.findIndex(r => r.emoji === emoji);
        if (reactionIndex > -1) {
            const userIndex = message.reactions[reactionIndex].users.indexOf(userId);
            if (userIndex > -1) {
                message.reactions[reactionIndex].users.splice(userIndex, 1);
                if (message.reactions[reactionIndex].users.length === 0) {
                    message.reactions.splice(reactionIndex, 1);
                }
            } else {
                message.reactions[reactionIndex].users.push(userId);
            }
        } else {
            message.reactions.push({ emoji, users: [userId] });
        }
        await ticket.save();
        const populatedTicket = await populateTicket(ticket._id);
        req.io.emit('ticketUpdated', populatedTicket);
        res.status(200).json(populatedTicket);
    } catch (error) { res.status(500).json({ message: 'Erreur interne.' }); }
});

module.exports = router;