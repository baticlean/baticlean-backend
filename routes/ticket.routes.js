// baticlean/baticlean-backend/routes/ticket.routes.js

const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket.model');
const { isAuthenticated, isAdmin } = require('../middleware/isAdmin.js');
const { broadcastNotificationCounts } = require('../utils/notifications.js');

// NOUVEAU : On importe notre configuration d'upload de fichiers
const uploader = require('../config/cloudinary.config.js');


// Route pour créer un nouveau ticket (inchangée)
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


// Route pour qu'un admin "réclame" un ticket (inchangée)
router.patch('/:ticketId/claim', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { ticketId } = req.params;
        const adminId = req.auth._id;
        const adminRole = req.auth.role;

        let findQuery = { _id: ticketId };

        if (adminRole === 'admin') {
            findQuery.assignedAdmin = null;
        }

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


// Route pour obtenir les tickets d'un utilisateur (inchangée)
router.get('/my-tickets', isAuthenticated, async (req, res) => {
    try {
        const showArchived = req.query.archived === 'true';
        const tickets = await Ticket.find({ 
            user: req.auth._id,
            archivedByUser: showArchived 
        }).populate('messages.sender', 'username profilePicture').sort({ updatedAt: -1 });
        res.status(200).json(tickets);
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

// Route pour obtenir tous les tickets (admins, inchangée)
router.get('/', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const showArchived = req.query.archived === 'true';
        const tickets = await Ticket.find({ 
            hiddenForAdmins: { $ne: req.auth._id },
            archivedByAdmin: showArchived
        })
            .populate('user', 'username email')
            .populate('messages.sender', 'username profilePicture')
            .populate('assignedAdmin', 'username')
            .sort({ updatedAt: -1 });
        res.status(200).json(tickets);
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});


// ✅ MODIFIÉ : Route pour ajouter un message, gère maintenant les fichiers
router.post('/:ticketId/messages', isAuthenticated, uploader.array('files', 5), async (req, res) => {
    try {
        const { ticketId } = req.params;
        const { text } = req.body;
        const senderId = req.auth._id;
        const isSenderAdmin = (req.auth.role === 'admin' || req.auth.role === 'superAdmin');

        // On vérifie qu'il y a au moins du texte ou un fichier
        if (!text && (!req.files || req.files.length === 0)) {
            return res.status(400).json({ message: 'Un message ne peut être vide (texte ou fichier requis).' });
        }

        // On formate les fichiers reçus pour les ajouter au message
        const attachments = req.files ? req.files.map(file => ({
            url: file.path,
            fileName: file.originalname,
            fileType: file.mimetype
        })) : [];

        const newMessage = { 
            sender: senderId, 
            text: text || '', // Le texte est maintenant optionnel
            senderType: isSenderAdmin ? 'admin' : 'user',
            attachments // On ajoute les pièces jointes
        };

        let updateQuery;
        if (isSenderAdmin) {
            updateQuery = {
                $push: { messages: newMessage },
                $set: { isReadByUser: false },
                $addToSet: { readByAdmins: senderId }
            };
        } else {
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

// Route pour marquer un ticket comme lu (inchangée)
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

// Route pour archiver ou désarchiver un ticket (inchangée)
router.patch('/:ticketId/archive', isAuthenticated, async (req, res) => {
    try {
        const { ticketId } = req.params;
        const { archive } = req.body;
        const user = req.auth;

        const ticket = await Ticket.findById(ticketId);
        if (!ticket) return res.status(404).json({ message: 'Ticket non trouvé.' });

        let updateData = {};
        const isAdminRequest = user.role === 'admin' || user.role === 'superAdmin';

        if (isAdminRequest) {
            updateData.archivedByAdmin = archive;
        } else if (ticket.user.toString() === user._id) {
            updateData.archivedByUser = archive;
        } else {
            return res.status(403).json({ message: 'Action non autorisée.' });
        }

        const updatedTicket = await Ticket.findByIdAndUpdate(ticketId, updateData, { new: true });

        req.io.emit('ticketArchived', { _id: updatedTicket._id, ...updateData });

        res.status(200).json(updatedTicket);
    } catch (error) {
        console.error("Erreur lors de l'archivage du ticket:", error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});


// Route pour masquer un ticket pour un admin (inchangée)
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