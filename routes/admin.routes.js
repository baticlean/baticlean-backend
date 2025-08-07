const express = require('express');
const router = express.Router();
const User = require('../models/User.model');
const jwt = require('jsonwebtoken');
const { isAuthenticated, isAdmin, isSuperAdmin } = require('../middleware/isAdmin.js');

// Route pour obtenir tous les utilisateurs (maintenant avec recherche)
router.get('/users', isAuthenticated, isSuperAdmin, async (req, res) => {
  try {
    const { search } = req.query; // On récupère le terme de recherche depuis l'URL
    let query = { role: { $ne: 'superAdmin' } };

    // Si un terme de recherche est fourni, on construit la requête de filtre
    if (search) {
      const regex = new RegExp(search, 'i'); // 'i' pour une recherche insensible à la casse
      query.$or = [
        { username: regex },
        { email: regex },
        { phoneNumber: regex }
      ];
    }

    const users = await User.find(query)
        .sort({ createdAt: -1 }) // On garde le tri pour avoir les plus récents en premier
        .select('-passwordHash');

    res.status(200).json(users);
  } catch (error) {
    console.error("Erreur lors de la récupération des utilisateurs:", error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

// Route pour mettre à jour le RÔLE d'un utilisateur
router.patch('/users/:userId/role', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    const updatedUser = await User.findByIdAndUpdate(userId, { role }, { new: true }).select('-passwordHash');
    if (!updatedUser) {
      return res.status(404).json({ message: 'Utilisateur non trouvé.' });
    }
    const payload = { _id: updatedUser._id, email: updatedUser.email, username: updatedUser.username, role: updatedUser.role, status: updatedUser.status, profilePicture: updatedUser.profilePicture, isNew: updatedUser.isNew };
    const newAuthToken = jwt.sign(payload, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '6h' });

    req.io.emit('userUpdated', { user: updatedUser, newToken: newAuthToken });

    res.status(200).json(updatedUser);
  } catch (error) {
    console.error("Erreur lors de la mise à jour du rôle:", error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

// Route pour mettre à jour le STATUT d'un utilisateur
router.patch('/users/:userId/status', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.body;

    const updatedUser = await User.findByIdAndUpdate(userId, { status }, { new: true }).select('-passwordHash');
    if (!updatedUser) {
      return res.status(404).json({ message: 'Utilisateur non trouvé.' });
    }

    const payload = { _id: updatedUser._id, email: updatedUser.email, username: updatedUser.username, role: updatedUser.role, status: updatedUser.status, profilePicture: updatedUser.profilePicture, isNew: updatedUser.isNew };
    const newAuthToken = jwt.sign(payload, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '6h' });

    console.log(`[BACKEND] Envoi de l'événement 'userUpdated' à TOUS les clients pour l'utilisateur ${userId}`);
    req.io.emit('userUpdated', { user: updatedUser, newToken: newAuthToken });

    res.status(200).json(updatedUser);
  } catch (error) {
    console.error("Erreur lors de la mise à jour du statut:", error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

module.exports = router;