const express = require('express');
const router = express.Router();
const User = require('../models/User.model');
const jwt = require('jsonwebtoken');
const { isAuthenticated, isAdmin } = require('../middleware/isAdmin.js');

// La route est maintenant protégée par 'isAdmin', qui laisse passer les admins ET les superAdmins
router.get('/users', isAuthenticated, isAdmin, async (req, res) => {
  try {
    // La logique pour ne pas afficher le superAdmin est toujours là
    const users = await User.find({ role: { $ne: 'superAdmin' } }).select('-passwordHash');
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

// Les autres actions (modifier rôle/statut) sont aussi protégées par 'isAdmin'
router.patch('/users/:userId/role', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) { return res.status(400).json({ message: 'Rôle invalide.' }); }

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
      req.io.to(userSocket-Id).emit('userUpdated', { user: updatedUserForAdmins, newToken: newAuthToken });
    }

    res.status(200).json(updatedUserForAdmins);
  } catch (error) {
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

router.patch('/users/:userId/status', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.body;
    const updatedUser = await User.findByIdAndUpdate(userId, { status }, { new: true }).select('-passwordHash');
    if (!updatedUser) { return res.status(404).json({ message: 'Utilisateur non trouvé.' }); }

    const userSocketId = req.onlineUsers[userId];
    if (userSocketId) {
      req.io.to(userSocketId).emit('userUpdated', { user: updatedUser });
    }

    res.status(200).json(updatedUser);
  } catch (error) {
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

module.exports = router;