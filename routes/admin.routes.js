const express = require('express');
const router = express.Router();
const User = require('../models/User.model');
const jwt = require('jsonwebtoken');
const { isAuthenticated, isAdmin, isSuperAdmin } = require('../middleware/isAdmin.js');

// Route pour obtenir tous les utilisateurs
router.get('/users', isAuthenticated, isSuperAdmin, async (req, res) => {
  try {
    const users = await User.find({ role: { $ne: 'superAdmin' } }).select('-passwordHash');
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

    // On envoie la mise à jour à tout le monde. Le frontend saura qui est concerné.
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

    // --- CORRECTION DÉFINITIVE ---
    // Au lieu de cibler un socketId qui peut être introuvable,
    // on envoie l'événement à TOUS les clients connectés.
    // Le GlobalSocketListener sur le frontend vérifiera si le message est pour lui.
    console.log(`[BACKEND] Envoi de l'événement 'userUpdated' à TOUS les clients pour l'utilisateur ${userId}`);
    req.io.emit('userUpdated', { user: updatedUser, newToken: newAuthToken });

    res.status(200).json(updatedUser);
  } catch (error) {
    console.error("Erreur lors de la mise à jour du statut:", error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

module.exports = router;