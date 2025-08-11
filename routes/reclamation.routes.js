// backend/routes/reclamation.routes.js (Corrigé)

const express = require('express');
const router = express.Router();
const Reclamation = require('../models/Reclamation.model');
const { isAuthenticated, isAdmin } = require('../middleware/isAdmin.js');
const { broadcastNotificationCounts } = require('../utils/notifications.js');

// ... (la route POST reste identique)
router.post('/', isAuthenticated, async (req, res) => {
    try {
        const { message, screenshots } = req.body;
        if (!message) {
            return res.status(400).json({ message: 'Le message ne peut pas être vide.' });
        }
        const newReclamation = await Reclamation.create({ 
            user: req.auth._id, 
            message, 
            screenshots,
            readByAdmins: []
        });
        const populatedReclamation = await Reclamation.findById(newReclamation._id).populate('user', 'username email status');
        req.io.emit('newReclamation', populatedReclamation);
        await broadcastNotificationCounts(req);
        res.status(201).json(populatedReclamation);
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});


router.get('/', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const showArchived = req.query.archived === 'true';
        const query = {
            hiddenForAdmins: { [showArchived ? '$in' : '$ne']: req.auth._id }
        };

        const reclamations = await Reclamation.find(query)
            .populate('user', 'username email status')
            .sort({ createdAt: -1 });

        // ✅ SÉCURITÉ : On filtre les réclamations dont l'utilisateur a été supprimé.
        const validReclamations = reclamations.filter(reclamation => reclamation.user);

        res.status(200).json(validReclamations);
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

// ... (le reste des routes hide, unhide, handle reste identique)
router.patch('/:reclamationId/hide', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { reclamationId } = req.params;
        const adminId = req.auth._id;
        const updatedReclamation = await Reclamation.findByIdAndUpdate(reclamationId, { $addToSet: { hiddenForAdmins: adminId } }, { new: true });
        if (!updatedReclamation) {
            return res.status(404).json({ message: 'Réclamation non trouvée.' });
        }
        await broadcastNotificationCounts(req);
        res.status(200).json({ message: 'Réclamation archivée avec succès.' });
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});
router.patch('/:reclamationId/unhide', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { reclamationId } = req.params;
        const adminId = req.auth._id;
        const updatedReclamation = await Reclamation.findByIdAndUpdate(reclamationId, { $pull: { hiddenForAdmins: adminId } }, { new: true });
         if (!updatedReclamation) {
            return res.status(404).json({ message: 'Réclamation non trouvée.' });
        }
        res.status(200).json({ message: 'Réclamation restaurée avec succès.' });
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});
router.patch('/:reclamationId/handle', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { reclamationId } = req.params;
        const adminId = req.auth._id;
        const updateQuery = { 
            status: 'En cours',
            $addToSet: { readByAdmins: adminId }
        };
        const updatedReclamation = await Reclamation.findByIdAndUpdate(reclamationId, updateQuery, { new: true });
        if (!updatedReclamation) {
            return res.status(404).json({ message: 'Réclamation non trouvée.' });
        }
        await broadcastNotificationCounts(req);
        res.status(200).json(updatedReclamation);
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});


module.exports = router;