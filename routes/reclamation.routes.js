// Fichier : backend/routes/reclamation.routes.js
const express = require('express');
const router = express.Router();
const Reclamation = require('../models/Reclamation.model');
const { isAuthenticated, isAdmin } = require('../middleware/isAdmin.js');
const { broadcastNotificationCounts } = require('../utils/notifications.js');

router.post('/', isAuthenticated, async (req, res) => {
    try {
        const { message, screenshots } = req.body;
        if (!message) {
            return res.status(400).json({ message: 'Le message ne peut pas être vide.' });
        }
        const newReclamation = await Reclamation.create({ user: req.auth._id, message, screenshots, isHandled: false });
        const populatedReclamation = await Reclamation.findById(newReclamation._id).populate('user', 'username email status');

        req.io.emit('newReclamation', populatedReclamation);
        await broadcastNotificationCounts(req); // CORRECTION ICI

        res.status(201).json(populatedReclamation);
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

router.get('/', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const reclamations = await Reclamation.find({ hiddenForAdmins: { $ne: req.auth._id } })
            .populate('user', 'username email status')
            .sort({ createdAt: -1 });
        res.status(200).json(reclamations);
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

router.patch('/:reclamationId/hide', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { reclamationId } = req.params;
        const adminId = req.auth._id;
        const updatedReclamation = await Reclamation.findByIdAndUpdate(reclamationId, { $addToSet: { hiddenForAdmins: adminId } }, { new: true });
        if (!updatedReclamation) {
            return res.status(404).json({ message: 'Réclamation non trouvée.' });
        }
        await broadcastNotificationCounts(req); // CORRECTION ICI
        res.status(200).json({ message: 'Réclamation masquée avec succès.' });
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

router.patch('/:reclamationId/handle', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { reclamationId } = req.params;
        const updatedReclamation = await Reclamation.findByIdAndUpdate(reclamationId, { isHandled: true }, { new: true });
        if (!updatedReclamation) {
            return res.status(404).json({ message: 'Réclamation non trouvée.' });
        }
        await broadcastNotificationCounts(req); // CORRECTION ICI
        res.status(200).json(updatedReclamation);
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

module.exports = router;