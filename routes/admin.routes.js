// admin.routes.js
const express = require('express');
const router = express.Router();
const User = require('../models/User.model');
const jwt = require('jsonwebtoken');

// --- Middlewares intégrés ---

const isAuthenticated = (req, res, next) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Aucun token fourni.' });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.auth = payload;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token invalide.' });
  }
};

const isAdmin = (req, res, next) => {
  if (!['admin', 'superAdmin'].includes(req.auth.role)) {
    return res.status(403).json({ message: 'Accès refusé. Droits administrateur requis.' });
  }
  next();
};

const isSuperAdmin = (req, res, next) => {
  if (req.auth.role !== 'superAdmin') {
    return res.status(403).json({ message: 'Accès refusé. Droits Super Administrateur requis.' });
  }
  next();
};

// --- Routes ---

// Liste des utilisateurs (Super Admin uniquement)
router.get('/users', isAuthenticated, isSuperAdmin, async (req, res) => {
  try {
    const users = await User.find({ role: { $ne: 'superAdmin' } }).select('-passwordHash');
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

// Modifier le rôle (Admin ou Super Admin)
router.patch('/users/:userId/role', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé.' });

    user.role = role;
    await user.save();

    const payload = {
      _id: user._id,
      email: user.email,
      username: user.username,
      role: user.role,
      status: user.status,
      profilePicture: user.profilePicture,
    };

    const newToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '6h' });

    const socketId = req.onlineUsers[userId];
    if (socketId) {
      console.log(`🚀 Envoi userUpdate à ${userId}`);
      req.io.to(socketId).emit('userUpdate', { user, newToken });
    }

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

// Modifier le statut (Admin ou Super Admin)
router.patch('/users/:userId/status', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.body;

    const user = await User.findByIdAndUpdate(userId, { status }, { new: true }).select('-passwordHash');
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé.' });

    const payload = {
      _id: user._id,
      email: user.email,
      username: user.username,
      role: user.role,
      status: user.status,
      profilePicture: user.profilePicture,
    };

    const newToken = status === 'active' ? jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '6h' }) : null;

    const socketId = req.onlineUsers[userId];
    if (socketId) {
      console.log(`🚀 Envoi userUpdate à ${userId}`);
      req.io.to(socketId).emit('userUpdate', { user, newToken });
    }

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

module.exports = router;