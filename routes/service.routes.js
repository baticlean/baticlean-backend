// baticlean-backend/routes/service.routes.js

const express = require('express');
const router = express.Router();
const Service = require('../models/Service.model');
const jwt = require('jsonwebtoken');
const { isAuthenticated, isAdmin } = require('../middleware/isAdmin.js');

// === GESTION DES SERVICES (Admin - Inchangé) ===
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

// === ✅ MODIFIÉ : AFFICHAGE DES SERVICES AVEC RECHERCHE ET FILTRES (Public) ===
router.get('/', async (req, res) => {
    try {
        const { search, category, sortBy } = req.query;
        let query = {};
        let sortQuery = { createdAt: -1 }; // Tri par défaut : les plus récents

        // 1. Filtre de recherche par mot-clé
        if (search) {
            const regex = new RegExp(search, 'i'); // 'i' pour insensible à la casse
            query.$or = [
                { title: regex },
                { description: regex }
            ];
        }

        // 2. Filtre par catégorie
        if (category) {
            query.category = category;
        }

        // 3. Logique de tri
        if (sortBy === 'popularity') {
            // On trie par le nombre de likes (plus il y en a, plus c'est haut)
            sortQuery = { 'likes.length': -1, createdAt: -1 };
        } else if (sortBy === 'rating') {
            // Pour trier par note, c'est plus complexe. On utilisera l'agrégation.
            // Pour l'instant, on se base sur le tri par défaut.
            // Une version plus avancée pourrait calculer la note moyenne et trier dessus.
        }

        const allServices = await Service.find(query)
            .populate('comments.user', 'username _id profilePicture')
            .populate('reviews.user', 'username profilePicture') // On peuple aussi les avis
            .sort(sortQuery);
            
        res.status(200).json(allServices);
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});


// === GESTION LIKES & COMMENTAIRES (Inchangé) ===
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
        const updatedService = await Service.findById(id).populate('comments.user reviews.user', 'username _id profilePicture');
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
        ).populate('comments.user reviews.user', 'username _id profilePicture');

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
        const updatedService = await Service.findById(serviceId).populate('comments.user reviews.user', 'username _id profilePicture');
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
        const updatedService = await Service.findById(serviceId).populate('comments.user reviews.user', 'username _id profilePicture');
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
        const updatedService = await Service.findById(serviceId).populate('comments.user reviews.user', 'username _id profilePicture');
        req.io.emit('serviceUpdated', updatedService);
        res.status(200).json(updatedService);
    } catch (error) { res.status(500).json({ message: 'Erreur interne du serveur.' }); }
});

module.exports = router;