const express = require('express');
const router = express.Router();
const User = require('../models/User.model');
const jwt = require('jsonwebtoken');
const { isAuthenticated, isAdmin, isSuperAdmin } = require('../middleware/isAdmin.js');

router.get('/users', isAuthenticated, isSuperAdmin, async (req, res) => {
  try {
    const users = await User.find({ role: { $ne: 'superAdmin' } }).select('-passwordHash');
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

// Cette route gère maintenant le bannissement ET la réactivation de manière sécurisée
router.patch('/users/:userId/status', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.body;

    const userToUpdate = await User.findByIdAndUpdate(userId, { status }, { new: true });
    if (!userToUpdate) { return res.status(404).json({ message: 'Utilisateur non trouvé.' }); }

    const userSocketId = req.onlineUsers[userId];
    const bannedSocketId = req.bannedSockets[userId];

    if ((status === 'banned' || status === 'suspended') && userSocketId && req.io) {
      // SCÉNARIO 1 : L'utilisateur est en ligne et se fait bannir
      req.bannedSockets[userId] = userSocketId; // On ajoute son navigateur à la "mémoire des bannis"
      delete req.onlineUsers[userId]; // On le retire des utilisateurs actifs

      const payload = { _id: userId, status };
      const bannedToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '6h' });
      req.io.to(userSocketId).emit('userUpdated', { user: userToUpdate, newToken: bannedToken });
    } 
    else if (status === 'active' && req.io) {
      // SCÉNARIO 2 : L'utilisateur est réactivé (qu'il soit en ligne ou déconnecté)
      const targetSocketId = userSocketId || bannedSocketId;

      if (targetSocketId) {
        const { _id, username, email, role, profilePicture } = userToUpdate;
        const payload = { _id, username, email, role, status, profilePicture };
        const newToken = jwt.sign(payload, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '6h' });

        // On envoie un message privé SEULEMENT au bon navigateur
        req.io.to(targetSocketId).emit('accountReactivated', { newToken });

        // On nettoie la mémoire des bannis pour cet utilisateur
        if (req.bannedSockets[userId]) {
            delete req.bannedSockets[userId];
        }
      }
    }

    res.status(200).json(userToUpdate);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});


router.patch('/users/:userId/role', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    const userToUpdate = await User.findById(userId);
    if (!userToUpdate) { return res.status(404).json({ message: 'Utilisateur non trouvé.' }); }

    userToUpdate.role = role;
    await userToUpdate.save();

    const { _id, username, email, status, profilePicture } = userToUpdate;
    const payload = { _id, email, username, role, status, profilePicture };
    const newAuthToken = jwt.sign(payload, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '6h' });

    const updatedUserForAdmins = await User.findById(userId).select('-passwordHash');
    const userSocketId = req.onlineUsers[userId];
    if (userSocketId && req.io) {
      req.io.to(userSocketId).emit('userUpdated', { user: updatedUserForAdmins, newToken: newAuthToken });
    }
    res.status(200).json(updatedUserForAdmins);
  } catch (error) {
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});


module.exports = router;