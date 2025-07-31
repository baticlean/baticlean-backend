// routes/service.routes.js
const express = require('express');
const router = express.Router();
const Service = require('../models/Service.model');
const { isAuthenticated, isAdmin } = require('../middleware/isAdmin.js');

// === GESTION DES SERVICES (Admin) ===
// CREATE
router.post('/', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { title, description, images, price, category } = req.body;
    if (!title || !description || !price || !category) {
      return res.status(400).json({ message: 'Tous les champs sont requis.' });
    }
    const newService = await Service.create({ title, description, images, price, category });
    res.status(201).json(newService);
  } catch (error) {
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

// UPDATE
router.put('/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const updatedService = await Service.findByIdAndUpdate(id, req.body, { new: true });
        if (!updatedService) { return res.status(404).json({ message: 'Service non trouvé.' }); }
        res.status(200).json(updatedService);
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

// DELETE
router.delete('/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const deletedService = await Service.findByIdAndDelete(id);
        if (!deletedService) { return res.status(404).json({ message: 'Service non trouvé.' }); }
        res.status(200).json({ message: 'Service supprimé avec succès.' });
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});


// === AFFICHAGE DES SERVICES (Public) ===
// GET ALL
router.get('/', async (req, res) => {
  try {
    const allServices = await Service.find().populate('comments.user', 'username').sort({ createdAt: -1 });
    res.status(200).json(allServices);
  } catch (error) {
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});


// === GESTION LIKES & COMMENTAIRES (Utilisateur connecté) ===
// LIKE/UNLIKE SERVICE
router.patch('/:id/like', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.auth._id;
    const service = await Service.findById(id);
    if (!service) { return res.status(404).json({ message: 'Service non trouvé.' }); }
    const hasLiked = service.likes.includes(userId);
    if (hasLiked) {
      service.likes.pull(userId);
    } else {
      service.likes.push(userId);
    }
    await service.save();
    res.status(200).json(service);
  } catch (error) {
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

// ADD COMMENT
router.post('/:id/comment', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;
    const { _id: userId, username } = req.auth;
    if (!text) { return res.status(400).json({ message: 'Le commentaire ne peut pas être vide.' }); }

    const newComment = { user: userId, username, text };
    const updatedService = await Service.findByIdAndUpdate(
      id,
      { $push: { comments: { $each: [newComment], $position: 0 } } },
      { new: true }
    ).populate('comments.user', 'username');

    if (!updatedService) { return res.status(404).json({ message: 'Service non trouvé.' }); }
    res.status(200).json(updatedService);
  } catch (error) {
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

// UPDATE OWN COMMENT
router.put('/:serviceId/comments/:commentId', isAuthenticated, async (req, res) => {
  try {
    const { serviceId, commentId } = req.params;
    const { text } = req.body;
    const userId = req.auth._id;

    const service = await Service.findById(serviceId);
    const comment = service.comments.id(commentId);
    if (!comment) { return res.status(404).json({ message: "Commentaire non trouvé." }); }
    if (comment.user.toString() !== userId) { return res.status(403).json({ message: "Action non autorisée." }); }

    comment.text = text;
    await service.save();
    res.status(200).json(service);
  } catch (error) { res.status(500).json({ message: 'Erreur interne du serveur.' }); }
});

// DELETE OWN COMMENT
router.delete('/:serviceId/comments/:commentId', isAuthenticated, async (req, res) => {
  try {
    const { serviceId, commentId } = req.params;
    const userId = req.auth._id;

    const service = await Service.findById(serviceId);
    const comment = service.comments.id(commentId);
    if (!comment) { return res.status(404).json({ message: "Commentaire non trouvé." }); }
    if (comment.user.toString() !== userId && req.auth.role !== 'superAdmin') {
      return res.status(403).json({ message: "Action non autorisée." });
    }

    await comment.deleteOne(); // Mongoose v6+ uses deleteOne() for subdocuments
    await service.save();
    res.status(200).json(service);
  } catch (error) { res.status(500).json({ message: 'Erreur interne du serveur.' }); }
});

// LIKE/UNLIKE COMMENT
router.patch('/:serviceId/comments/:commentId/like', isAuthenticated, async (req, res) => {
  try {
    const { serviceId, commentId } = req.params;
    const userId = req.auth._id;

    const service = await Service.findById(serviceId);
    const comment = service.comments.id(commentId);
    if (!comment) { return res.status(404).json({ message: "Commentaire non trouvé." }); }

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