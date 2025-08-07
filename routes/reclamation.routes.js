const express = require('express');
const router = express.Router();
const Reclamation = require('../models/Reclamation.model');
const { isAuthenticated, isAdmin } = require('../middleware/isAdmin.js');
const { broadcastNotificationCounts } = require('../utils/notifications.js');

router.post('/', isAuthenticated, async (req, res) => {
  try {
    const { message, screenshots } = req.body;
    const userId = req.auth._id;
    if (!message) {
      return res.status(400).json({ message: 'Le message ne peut pas être vide.' });
    }
    const newReclamation = await Reclamation.create({ user: userId, message, screenshots });

    req.io.emit('newReclamation', newReclamation);
    broadcastNotificationCounts(req.io); // Met à jour les compteurs

    res.status(201).json(newReclamation);
  } catch (error) {
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

router.get('/', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const reclamations = await Reclamation.find().populate('user', 'username email status').sort({ createdAt: -1 });
        res.status(200).json(reclamations);
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

router.delete('/:reclamationId', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { reclamationId } = req.params;
        const deletedReclamation = await Reclamation.findByIdAndDelete(reclamationId);
        if (!deletedReclamation) {
            return res.status(404).json({ message: 'Réclamation non trouvée.' });
        }
        req.io.emit('reclamationDeleted', { _id: reclamationId });
        broadcastNotificationCounts(req.io); // Met à jour les compteurs
        res.status(200).json({ message: 'Réclamation supprimée avec succès.' });
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

module.exports = router;