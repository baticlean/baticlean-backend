// routes/service.routes.js
const express = require('express');
const router = express.Router();
const Service = require('../models/Service.model');
const { isAuthenticated, isAdmin } = require('../middleware/isAdmin.js');

// --- GESTION DES SERVICES (Admin) ---
// ... (vos routes POST, PUT, DELETE pour les services restent ici)

// --- AFFICHAGE DES SERVICES (Public) ---
router.get('/', /* ... */);

// --- GESTION DES LIKES & COMMENTAIRES (Utilisateur connecté) ---

// Liker un service (inchangé)
router.patch('/:id/like', isAuthenticated, /* ... */);

// Commenter un service (inchangé)
router.post('/:id/comment', isAuthenticated, /* ... */);

// --- NOUVELLES ROUTES ---

// Modifier son propre commentaire
router.put('/:serviceId/comments/:commentId', isAuthenticated, async (req, res) => {
  try {
    const { serviceId, commentId } = req.params;
    const { text } = req.body;
    const userId = req.auth._id;

    const service = await Service.findById(serviceId);
    const comment = service.comments.id(commentId);

    if (!comment) return res.status(404).json({ message: "Commentaire non trouvé." });
    if (comment.user.toString() !== userId) return res.status(403).json({ message: "Action non autorisée." });

    comment.text = text;
    await service.save();
    res.status(200).json(service);
  } catch (error) { res.status(500).json({ message: 'Erreur interne du serveur.' }); }
});

// Supprimer son propre commentaire
router.delete('/:serviceId/comments/:commentId', isAuthenticated, async (req, res) => {
  try {
    const { serviceId, commentId } = req.params;
    const userId = req.auth._id;

    const service = await Service.findById(serviceId);
    const comment = service.comments.id(commentId);

    if (!comment) return res.status(404).json({ message: "Commentaire non trouvé." });
    if (comment.user.toString() !== userId && req.auth.role !== 'superAdmin') {
      return res.status(403).json({ message: "Action non autorisée." });
    }

    comment.remove();
    await service.save();
    res.status(200).json(service);
  } catch (error) { res.status(500).json({ message: 'Erreur interne du serveur.' }); }
});

// Liker un commentaire
router.patch('/:serviceId/comments/:commentId/like', isAuthenticated, async (req, res) => {
  try {
    const { serviceId, commentId } = req.params;
    const userId = req.auth._id;

    const service = await Service.findById(serviceId);
    const comment = service.comments.id(commentId);

    if (!comment) return res.status(404).json({ message: "Commentaire non trouvé." });

    const hasLiked = comment.likes.includes(userId);
    if (hasLiked) {
      comment.likes.pull(userId);
    } else {
      comment.likes.push(userId);
    }

    await service.save();
    res.status(200).json(service);
  } catch (error) { res.status(500).json({ message: 'Erreur interne du serveur.' }); }
});

module.exports = router;