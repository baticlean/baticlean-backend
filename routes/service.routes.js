const express = require('express');
const router = express.Router();
const Service = require('../models/Service.model');
const jwt = require('jsonwebtoken');
const { isAuthenticated, isAdmin } = require('../middleware/isAdmin.js');

// === GESTION DES SERVICES (Admin) ===
router.post('/', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const newService = await Service.create(req.body);
    req.io.emit('serviceUpdated', newService);
    res.status(201).json(newService);
  } catch (error) {
    res.status(400).json({ message: 'Erreur lors de la création du service.' });
  }
});
router.put('/:id', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const updatedService = await Service.findByIdAndUpdate(req.params.id, req.body, { new: true });
    req.io.emit('serviceUpdated', updatedService);
    res.status(200).json(updatedService);
  } catch (error) {
    res.status(400).json({ message: 'Erreur lors de la mise à jour du service.' });
  }
});
router.delete('/:id', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const deletedService = await Service.findByIdAndDelete(id);
    if (!deletedService) { return res.status(404).json({ message: 'Service non trouvé.' }); }
    req.io.emit('serviceDeleted', { _id: id });
    res.status(200).json({ message: 'Service supprimé avec succès.' });
  } catch (error) {
    res.status(400).json({ message: 'Erreur lors de la suppression du service.' });
  }
});

// === AFFICHAGE DES SERVICES (Public) ===
router.get('/', async (req, res) => {
  try {
    const allServices = await Service.find()
      .populate('comments.user', 'username _id') // On ajoute '_id' ici
      .sort({ createdAt: -1 });
    res.status(200).json(allServices);
  } catch (error) {
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

// === GESTION LIKES & COMMENTAIRES (Utilisateur connecté) ===
router.patch('/:id/like', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.auth._id;
    let service = await Service.findById(id);
    if (!service) { return res.status(404).json({ message: 'Service non trouvé.' }); }
    const hasLiked = service.likes.includes(userId);
    if (hasLiked) {
      service.likes.pull(userId);
    } else {
      service.likes.push(userId);
    }
    await service.save();
    const updatedService = await Service.findById(id).populate('comments.user', 'username _id');
    req.io.emit('serviceUpdated', updatedService);
    res.status(200).json(updatedService);
  } catch (error) {
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

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
    ).populate('comments.user', 'username _id'); // On ajoute '_id' ici
    if (!updatedService) { return res.status(404).json({ message: 'Service non trouvé.' }); }
    req.io.emit('serviceUpdated', updatedService);
    res.status(200).json(updatedService);
  } catch (error) {
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

router.put('/:serviceId/comments/:commentId', isAuthenticated, async (req, res) => {
  try {
    const { serviceId, commentId } = req.params;
    const { text } = req.body;
    const userId = req.auth._id;
    let service = await Service.findById(serviceId);
    const comment = service.comments.id(commentId);
    if (!comment) { return res.status(404).json({ message: "Commentaire non trouvé." }); }
    if (comment.user.toString() !== userId) { return res.status(403).json({ message: "Action non autorisée." }); }
    comment.text = text;
    await service.save();
    const updatedService = await Service.findById(serviceId).populate('comments.user', 'username _id');
    req.io.emit('serviceUpdated', updatedService);
    res.status(200).json(updatedService);
  } catch (error) { res.status(500).json({ message: 'Erreur interne du serveur.' }); }
});

router.delete('/:serviceId/comments/:commentId', isAuthenticated, async (req, res) => {
  try {
    const { serviceId, commentId } = req.params;
    const userId = req.auth._id;
    let service = await Service.findById(serviceId);
    const comment = service.comments.id(commentId);
    if (!comment) { return res.status(404).json({ message: "Commentaire non trouvé." }); }
    if (comment.user.toString() !== userId && req.auth.role !== 'superAdmin') {
      return res.status(403).json({ message: "Action non autorisée." });
    }
    await comment.deleteOne();
    await service.save();
    const updatedService = await Service.findById(serviceId).populate('comments.user', 'username _id');
    req.io.emit('serviceUpdated', updatedService);
    res.status(200).json(updatedService);
  } catch (error) { res.status(500).json({ message: 'Erreur interne du serveur.' }); }
});

router.patch('/:serviceId/comments/:commentId/like', isAuthenticated, async (req, res) => {
  try {
    const { serviceId, commentId } = req.params;
    const userId = req.auth._id;
    let service = await Service.findById(serviceId);
    const comment = service.comments.id(commentId);
    if (!comment) { return res.status(404).json({ message: "Commentaire non trouvé." }); }
    const hasLiked = comment.likes.includes(userId);
    if (hasLiked) {
      comment.likes.pull(userId);
    } else {
      comment.likes.push(userId);
    }
    await service.save();
    const updatedService = await Service.findById(serviceId).populate('comments.user', 'username _id');
    req.io.emit('serviceUpdated', updatedService);
    res.status(200).json(updatedService);
  } catch (error) { res.status(500).json({ message: 'Erreur interne du serveur.' }); }
});

module.exports = router;