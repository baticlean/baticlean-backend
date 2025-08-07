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
    const payload = { _id: updatedUser._id, email: updatedUser.email, username: updatedUser.username, role: updatedUser.role, status: updatedUser.status, profilePicture: updatedUser.profilePicture };
    const newAuthToken = jwt.sign(payload, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '6h' });
    const userSocketId = req.onlineUsers[userId];
    if (userSocketId) {
      req.io.to(userSocketId).emit('userUpdated', { user: updatedUser, newToken: newAuthToken });
    }
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

    console.log(`[BACKEND] 1. Reçu la requête pour changer le statut de ${userId} en '${status}'`);

    const updatedUser = await User.findByIdAndUpdate(userId, { status }, { new: true }).select('-passwordHash');
    if (!updatedUser) {
      return res.status(404).json({ message: 'Utilisateur non trouvé.' });
    }

    console.log(`[BACKEND] 2. Statut de l'utilisateur mis à jour dans la DB. Nouveau statut: '${updatedUser.status}'`);

    const payload = { _id: updatedUser._id, email: updatedUser.email, username: updatedUser.username, role: updatedUser.role, status: updatedUser.status, profilePicture: updatedUser.profilePicture };
    const newAuthToken = jwt.sign(payload, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '6h' });

    console.log(`[BACKEND] 3. Nouveau token créé avec le statut: '${jwt.decode(newAuthToken).status}'`);

    const userSocketId = req.onlineUsers[userId];
    if (userSocketId) {
      console.log(`[BACKEND] 4. Envoi de l'événement 'userUpdated' au socketId ${userSocketId}`);
      req.io.to(userSocketId).emit('userUpdated', { user: updatedUser, newToken: newAuthToken });
    } else {
      console.log(`[BACKEND] 4. Utilisateur ${userId} non trouvé dans les utilisateurs en ligne.`);
    }

    res.status(200).json(updatedUser);
  } catch (error) {
    console.error("Erreur lors de la mise à jour du statut:", error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

module.exports = router;