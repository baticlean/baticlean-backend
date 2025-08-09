// Fichier : backend/routes/reclamation.routes.js (Version avec archivage)
const express = require('express');
const router = express.Router();
const Reclamation = require('../models/Reclamation.model');
const { isAuthenticated, isAdmin } = require('../middleware/isAdmin.js');
const { broadcastNotificationCounts } = require('../utils/notifications.js');
// Route pour créer une réclamation (inchangée)
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
// ✅ MODIFIÉ : Route pour obtenir les réclamations (actives ou archivées)
router.get('/', isAuthenticated, isAdmin, async (req, res) => {
    try {
        // On vérifie si on doit afficher les archives via un paramètre de requête
        const showArchived = req.query.archived === 'true';

        // La requête change en fonction de `showArchived`
        // Si true: on cherche les réclamations où l'admin EST dans la liste `hiddenForAdmins`
        // Si false: on cherche celles où l'admin N'EST PAS dans la liste
        const query = {
            hiddenForAdmins: { [showArchived ? '$in' : '$ne']: req.auth._id }
        };
        const reclamations = await Reclamation.find(query)
            .populate('user', 'username email status')
            .sort({ createdAt: -1 });

        res.status(200).json(reclamations);
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});
// Route pour archiver (anciennement "masquer") une réclamation (inchangée)
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
// ✅ NOUVEAU : Route pour restaurer une réclamation
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

// Route pour marquer comme "En cours" (inchangée)
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