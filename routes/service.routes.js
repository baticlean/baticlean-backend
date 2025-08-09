// baticlean-backend/routes/service.routes.js

const express = require('express');
const router = express.Router();
const Service = require('../models/Service.model');
const jwt = require('jsonwebtoken');
const { isAuthenticated, isAdmin } = require('../middleware/isAdmin.js');

// === GESTION DES SERVICES (Nécessite d'être Admin) ===
router.post('/', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const newService = await Service.create(req.body);
    const populatedService = await Service.findById(newService._id).populate('comments.user', 'username _id profilePicture');
    req.io.emit('serviceUpdated', populatedService);
    res.status(201).json(populatedService);
  } catch (error) {
    res.status(400).json({ message: 'Erreur lors de la création du service.' });
  }
});

router.put('/:id', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const updatedService = await Service.findByIdAndUpdate(req.params.id, req.body, { new: true }).populate('comments.user', 'username _id profilePicture');
    if (!updatedService) return res.status(404).json({ message: 'Service non trouvé.' });
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

// === AFFICHAGE DES SERVICES AVEC RECHERCHE ET FILTRES (Public) ===
router.get('/', async (req, res) => {
    try {
        const { search, category, sortBy } = req.query;
        let query = {};
        let sortQuery = { createdAt: -1 }; 

        if (search) {
            const regex = new RegExp(search, 'i');
            query.$or = [
                { title: regex },
                { description: regex }
            ];
        }

        if (category) {
            query.category = category;
        }

        if (sortBy === 'popularity') {
            sortQuery = { 'likes.length': -1, createdAt: -1 };
        } else if (sortBy === 'rating') {
            // Logique de tri par note à implémenter si besoin
        }

        const allServices = await Service.find(query)
            .populate('comments.user', 'username _id profilePicture')
            .populate('reviews.user', 'username profilePicture')
            .sort(sortQuery);
            
        res.status(200).json(allServices);
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});


// === GESTION LIKES & COMMENTAIRES ===
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
    const updatedService = await Service.findById(id).populate('comments.user', 'username _id profilePicture');
    req.io.emit('serviceUpdated', updatedService);
    res.status(200).json(updatedService);
  } catch (error) {
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});


// ====================================================================
// ✅ LA CORRECTION EST ICI
// ====================================================================
router.post('/:id/comment', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    // 1. On récupère `parentId` en plus de `text` depuis le corps de la requête
    const { text, parentId } = req.body;
    const { _id: userId, username } = req.auth;

    if (!text) { return res.status(400).json({ message: 'Le commentaire ne peut pas être vide.' }); }

    // 2. On crée l'objet commentaire en incluant la propriété `parent`
    //    Si `parentId` n'est pas fourni (commentaire de 1er niveau), sa valeur sera `null`.
    const newComment = { 
      user: userId, 
      username, 
      text,
      parent: parentId || null 
    };

    // 3. La suite de la logique est la même, elle pousse le nouvel objet (maintenant complet) dans le tableau.
    const updatedService = await Service.findByIdAndUpdate(
      id,
      { $push: { comments: { $each: [newComment], $position: 0 } } },
      { new: true }
    ).populate('comments.user', 'username _id profilePicture');

    if (!updatedService) { return res.status(404).json({ message: 'Service non trouvé.' }); }
    
    req.io.emit('serviceUpdated', updatedService);
    res.status(200).json(updatedService);
  } catch (error) {
    console.error(error); // Affiche l'erreur dans la console du serveur pour le débogage
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});
// ====================================================================


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
    const updatedService = await Service.findById(serviceId).populate('comments.user', 'username _id profilePicture');
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
    
    // Plutôt que de supprimer le commentaire, on pourrait aussi supprimer toutes ses réponses.
    // Pour l'instant, la suppression simple suffit.
    await comment.deleteOne();
    await service.save();
    const updatedService = await Service.findById(serviceId).populate('comments.user', 'username _id profilePicture');
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
    const updatedService = await Service.findById(serviceId).populate('comments.user', 'username _id profilePicture');
    req.io.emit('serviceUpdated', updatedService);
    res.status(200).json(updatedService);
  } catch (error) { res.status(500).json({ message: 'Erreur interne du serveur.' }); }
});

module.exports = router;

