const express = require('express');
const router = express.Router();
const User = require('../models/User.model');
const jwt = require('jsonwebtoken');
const { isAuthenticated, isAdmin, isSuperAdmin } = require('../middleware/isAdmin.js');

// Route pour obtenir tous les utilisateurs (pour les super-admins)
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

    // On met à jour l'utilisateur et on récupère la version mise à jour
    const updatedUser = await User.findByIdAndUpdate(userId, { role }, { new: true }).select('-passwordHash');

    if (!updatedUser) {
      return res.status(404).json({ message: 'Utilisateur non trouvé.' });
    }

    // On crée le payload pour le nouveau token AVEC les données à jour
    const payload = {
      _id: updatedUser._id,
      email: updatedUser.email,
      username: updatedUser.username,
      role: updatedUser.role, // Le nouveau rôle
      status: updatedUser.status,
      profilePicture: updatedUser.profilePicture
    };
    const newAuthToken = jwt.sign(payload, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '6h' });

    // On notifie l'utilisateur concerné via socket
    const userSocketId = req.onlineUsers[userId];
    if (userSocketId) {
      req.io.to(userSocketId).emit('userUpdated', { user: updatedUser, newToken: newAuthToken });
    }

    // On renvoie l'utilisateur mis à jour à l'admin qui a fait l'action
    res.status(200).json(updatedUser);
  } catch (error) {
    console.error("Erreur lors de la mise à jour du rôle:", error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

// Route pour mettre à jour le STATUT d'un utilisateur (Bannir/Réactiver)
// C'EST ICI QUE LA CORRECTION PRINCIPALE A ÉTÉ APPORTÉE
router.patch('/users/:userId/status', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.body; // ex: 'active' ou 'banned'

    // --- CORRECTION MAJEURE ---
    // 1. On met à jour l'utilisateur D'ABORD et on attend que ce soit terminé.
    // L'option { new: true } nous assure que 'updatedUser' contient les nouvelles données.
    const updatedUser = await User.findByIdAndUpdate(userId, { status }, { new: true }).select('-passwordHash');

    if (!updatedUser) {
      return res.status(404).json({ message: 'Utilisateur non trouvé.' });
    }

    // 2. MAINTENANT, on crée le payload pour le token avec le statut correct.
    const payload = {
      _id: updatedUser._id,
      email: updatedUser.email,
      username: updatedUser.username,
      role: updatedUser.role,
      status: updatedUser.status, // Contient maintenant 'active'
      profilePicture: updatedUser.profilePicture
    };
    const newAuthToken = jwt.sign(payload, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '6h' });

    // 3. On envoie l'événement socket avec l'utilisateur et le token mis à jour.
    const userSocketId = req.onlineUsers[userId];
    if (userSocketId) {
      // Le frontend recevra un utilisateur avec status: 'active' ET un token avec status: 'active'
      req.io.to(userSocketId).emit('userUpdated', { user: updatedUser, newToken: newAuthToken });
    }

    // 4. On renvoie la confirmation à l'interface d'administration.
    res.status(200).json(updatedUser);
  } catch (error) {
    console.error("Erreur lors de la mise à jour du statut:", error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});


// Cette route semble redondante maintenant que la logique est dans /status.
// Vous pouvez la garder si vous en avez un autre usage, sinon la supprimer.
router.post('/users/:userId/notify-restored', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const userSocketId = req.onlineUsers[userId];
    if (userSocketId) {
      // L'événement 'userUpdated' est plus complet que 'accountRestored'
      // req.io.to(userSocketId).emit('accountRestored');
    }
    res.status(200).json({ message: 'Notification envoyée (logique maintenant dans PATCH /status).' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});


module.exports = router;
