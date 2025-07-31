// routes/admin.routes.js
const express = require('express');
const router = express.Router();
const User = require('../models/User.model');
const { isAuthenticated, isAdmin } = require('../middleware/isAdmin.js');

// GET /api/admin/users (inchangé)
router.get('/users', isAuthenticated, isAdmin, async (req, res) => { /* ... */ });

// PATCH /api/admin/users/:userId/role
router.patch('/users/:userId/role', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Rôle invalide.' });
    }
    const updatedUser = await User.findByIdAndUpdate(userId, { role }, { new: true }).select('-passwordHash');
    if (!updatedUser) {
      return res.status(404).json({ message: 'Utilisateur non trouvé.' });
    }

    // --- NOTIFICATION WEBSOCKET ---
    const userSocketId = req.onlineUsers[userId];
    if (userSocketId) {
      req.io.to(userSocketId).emit('userUpdated', updatedUser);
    }
    // ----------------------------

    res.status(200).json(updatedUser);
  } catch (error) {
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

// PATCH /api/admin/users/:userId/status
router.patch('/users/:userId/status', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.body;
    if (!['active', 'suspended', 'banned'].includes(status)) {
      return res.status(400).json({ message: 'Statut invalide.' });
    }
    const updatedUser = await User.findByIdAndUpdate(userId, { status }, { new: true }).select('-passwordHash');
    if (!updatedUser) {
      return res.status(404).json({ message: 'Utilisateur non trouvé.' });
    }

    // --- NOTIFICATION WEBSOCKET ---
    const userSocketId = req.onlineUsers[userId];
    if (userSocketId) {
      req.io.to(userSocketId).emit('userUpdated', updatedUser);
    }
    // ----------------------------

    res.status(200).json(updatedUser);
  } catch (error) {
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

module.exports = router;