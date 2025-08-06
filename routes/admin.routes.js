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
    if (userSocketId) {
      req.io.to(userSocketId).emit('userUpdated', { user: updatedUserForAdmins, newToken: newAuthToken });
    }
    res.status(200).json(updatedUserForAdmins);
  } catch (error) {
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

router.patch('/users/:userId/status', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.body; // 'banned', 'suspended', ou 'active'

    const userToUpdate = await User.findByIdAndUpdate(userId, { status }, { new: true });
    if (!userToUpdate) { return res.status(404).json({ message: 'Utilisateur non trouvé.' }); }

    const { _id, username, email, role, profilePicture } = userToUpdate;
    const io = req.app.get('socketio');
    const userSocketId = req.onlineUsers[userId];

    if (status === 'banned' || status === 'suspended') {
        // SCÉNARIO 1 : L'utilisateur est banni
        const payload = { _id, email, username, role, status, profilePicture };
        const bannedToken = jwt.sign(payload, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '6h' });

        if (userSocketId) {
            // On envoie un ordre explicite de bannissement
            io.to(userSocketId).emit('forceBan', { bannedToken });
        }
    } else if (status === 'active') {
        // SCÉNARIO 2 : L'utilisateur est réactivé
        const payload = { _id, email, username, role, status, profilePicture };
        const newToken = jwt.sign(payload, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '6h' });

        if (userSocketId) {
            // On envoie un ordre explicite de réactivation
            io.to(userSocketId).emit('accountReactivated', { newToken });
        }
    }

    const updatedUserForAdmins = await User.findById(userId).select('-passwordHash');
    res.status(200).json(updatedUserForAdmins);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

module.exports = router;