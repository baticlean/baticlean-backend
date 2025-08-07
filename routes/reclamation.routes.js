const express = require('express');
const router = express.Router();
const Reclamation = require('../models/Reclamation.model');
const { isAuthenticated, isAdmin } = require('../middleware/isAdmin.js');

// ROUTE POST /api/reclamations - Un utilisateur banni envoie une réclamation
router.post('/', isAuthenticated, async (req, res) => {
  try {
    const { message, screenshots } = req.body;
    const userId = req.auth._id;

    if (!message) {
      return res.status(400).json({ message: 'Le message ne peut pas être vide.' });
    }

    await Reclamation.create({
      user: userId,
      message,
      screenshots,
    });

    // On notifie les admins
    req.io.emit('newNotification');

    res.status(201).json({ message: 'Réclamation envoyée avec succès.' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

// ROUTE GET /api/reclamations - Un admin récupère toutes les réclamations
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

// NOUVELLE ROUTE - Pour supprimer une réclamation
router.delete('/:reclamationId', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { reclamationId } = req.params;
        const deletedReclamation = await Reclamation.findByIdAndDelete(reclamationId);

        if (!deletedReclamation) {
            return res.status(404).json({ message: 'Réclamation non trouvée.' });
        }

        req.io.emit('newNotification');

        res.status(200).json({ message: 'Réclamation supprimée avec succès.' });
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

module.exports = router;