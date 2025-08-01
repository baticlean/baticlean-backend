const express = require('express');
const router = express.Router();
const User = require('../models/User.model');
const jwt = require('jsonwebtoken');

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
  if (req.auth.role !== 'admin' && req.auth.role !== 'superAdmin') {
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
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé.' });
    user.role = role;
    await user.save();

    const payload = { _id: user._id, email: user.email, username: user.username, role, status: user.status, profilePicture: user.profilePicture };
    const newAuthToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '6h' });

    const updatedUserForAdmins = await User.findById(userId).select('-passwordHash');
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
    if (!updatedUser) return res.status(404).json({ message: 'Utilisateur non trouvé.' });
    res.status(200).json(updatedUser);
  } catch (error) {
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

module.exports = router;