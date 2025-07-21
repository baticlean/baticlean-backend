// routes/service.routes.js
const express = require('express');
const router = express.Router();
const Service = require('../models/Service.model');
const { isAuthenticated, isAdmin } = require('../middleware/isAdmin.js');

// --- ROUTES ADMIN (inchangées) ---
router.post('/', isAuthenticated, isAdmin, async (req, res) => { /* ... */ });
router.put('/:id', isAuthenticated, isAdmin, async (req, res) => { /* ... */ });
router.delete('/:id', isAuthenticated, isAdmin, async (req, res) => { /* ... */ });

// --- ROUTE PUBLIQUE (inchangée) ---
router.get('/', async (req, res) => { /* ... */ });


// --- NOUVELLE ROUTE ---
// PATCH /api/services/:id/like - Pour liker ou unliker un service
router.patch('/:id/like', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.auth._id; // ID de l'utilisateur connecté

    const service = await Service.findById(id);
    if (!service) {
      return res.status(404).json({ message: 'Service non trouvé.' });
    }

    const hasLiked = service.likes.includes(userId);

    if (hasLiked) {
      // Si l'utilisateur a déjà liké, on retire son like (unlike)
      service.likes.pull(userId);
    } else {
      // Sinon, on ajoute son like
      service.likes.push(userId);
    }

    await service.save();
    res.status(200).json(service);
  } catch (error) {
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

// --- NOUVELLE ROUTE ---
// POST /api/services/:id/comment - Pour ajouter un commentaire
router.post('/:id/comment', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;
    const { _id: userId, username } = req.auth; // Infos de l'utilisateur connecté

    if (!text) {
      return res.status(400).json({ message: 'Le commentaire ne peut pas être vide.' });
    }

    const newComment = { user: userId, username, text };

    const updatedService = await Service.findByIdAndUpdate(
      id,
      { $push: { comments: newComment } }, // On ajoute le commentaire à la liste
      { new: true }
    );

    if (!updatedService) {
      return res.status(404).json({ message: 'Service non trouvé.' });
    }

    res.status(200).json(updatedService);
  } catch (error) {
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});


module.exports = router;