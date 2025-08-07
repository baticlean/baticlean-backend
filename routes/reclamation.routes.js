// routes/reclamation.routes.js
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

    const newReclamation = await Reclamation.create({
      user: userId,
      message,
      screenshots,
    });

    res.status(201).json(newReclamation);
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

module.exports = router;