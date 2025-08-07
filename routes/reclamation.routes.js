const express = require('express');
const router = express.Router();
const Reclamation = require('../models/Reclamation.model');
const { isAuthenticated, isAdmin } = require('../middleware/isAdmin.js');
// On importe la fonction pour notifier les admins
const { broadcastNotificationCountsToAdmins } = require('../utils/notifications.js');

// Un utilisateur banni envoie une réclamation
router.post('/', isAuthenticated, async (req, res) => {
  try {
    const { message, screenshots } = req.body;
    const userId = req.auth._id;
    if (!message) {
      return res.status(400).json({ message: 'Le message ne peut pas être vide.' });
    }
    const newReclamation = await Reclamation.create({
      user: userId,
      message,
      screenshots,
    });

    // On notifie les admins pour la mise à jour de la liste
    req.io.emit('newReclamation', newReclamation);

    // --- CORRECTION AJOUTÉE ICI ---
    // On envoie la mise à jour des compteurs à tous les admins en ligne
    broadcastNotificationCountsToAdmins(req.io, req.onlineUsers);

    res.status(201).json(newReclamation);
  } catch (error) {
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

// Un admin récupère toutes les réclamations
router.get('/', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const reclamations = await Reclamation.find()
            .populate('user', 'username email status')
            .sort({ createdAt: -1 });
        res.status(200).json(reclamations);
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

// Un admin supprime une réclamation
router.delete('/:reclamationId', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { reclamationId } = req.params;
        const deletedReclamation = await Reclamation.findByIdAndDelete(reclamationId);
        if (!deletedReclamation) {
            return res.status(404).json({ message: 'Réclamation non trouvée.' });
        }
        // On notifie les admins que la réclamation a été supprimée
        req.io.emit('reclamationDeleted', { _id: reclamationId });

        // On met aussi à jour les compteurs après la suppression
        broadcastNotificationCountsToAdmins(req.io, req.onlineUsers);

        res.status(200).json({ message: 'Réclamation supprimée avec succès.' });
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

module.exports = router;