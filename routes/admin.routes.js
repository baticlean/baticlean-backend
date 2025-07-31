// routes/admin.routes.js
const express = require('express');
const router = express.Router();
const User = require('../models/User.model');
const jwt = require('jsonwebtoken');
const { isAuthenticated, isAdmin } = require('../middleware/isAdmin.js');

// ROUTE GET /api/admin/users - Récupère tous les utilisateurs
router.get('/users', isAuthenticated, isAdmin, async (req, res) => {
  try {
    // Méthode corrigée : on récupère tout, puis on filtre.
    const allUsers = await User.find().select('-passwordHash');
    const filteredUsers = allUsers.filter(user => user.role !== 'superAdmin');

    res.status(200).json(filteredUsers);
  } catch (error) {
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

// ROUTE PATCH /api/admin/users/:userId/role - Modifie le rôle
router.patch('/users/:userId/role', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) { return res.status(400).json({ message: 'Rôle invalide.' }); }

    const userToUpdate = await User.findById(userId);
    if (!userToUpdate) { return res.status(404).json({ message: 'Utilisateur non trouvé.' }); }

    userToUpdate.role = role;
    await userToUpdate.save();

    const { _id, username, email, status } = userToUpdate;
    const payload = { _id, email, username, role, status };
    const newAuthToken = jwt.sign(payload, process.env.JWT_SECRET || 'super-secret', {
      algorithm: 'HS256',
      expiresIn: '6h',
    });

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

// ROUTE PATCH /api/admin/users/:userId/status - Modifie le statut
router.patch('/users/:userId/status', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.body;
    if (!['active', 'suspended', 'banned'].includes(status)) { return res.status(400).json({ message: 'Statut invalide.' }); }
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