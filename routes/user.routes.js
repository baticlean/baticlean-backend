// routes/user.routes.js
const express = require('express');
const router = express.Router();
const User = require('../models/User.model.js');
const jwt = require('jsonwebtoken'); // Importer jwt
const { isAuthenticated } = require('../middleware/isAdmin.js');

// Crée et renvoie un nouveau token pour un utilisateur
const generateToken = (user) => {
  const { _id, username, email, phoneNumber, role, status, profilePicture } = user;
  const payload = { _id, username, email, phoneNumber, role, status, profilePicture };
  return jwt.sign(payload, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: '6h',
  });
};

router.put('/profile', isAuthenticated, async (req, res) => {
  try {
    const userId = req.auth._id;
    const { username, email, phoneNumber } = req.body;
    if (!username || !email || !phoneNumber) {
      return res.status(400).json({ message: 'Tous les champs sont requis.' });
    }
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { username, email, phoneNumber },
      { new: true }
    ).select('-passwordHash');

    if (!updatedUser) { return res.status(404).json({ message: 'Utilisateur non trouvé.' }); }

    const authToken = generateToken(updatedUser);
    res.status(200).json({ authToken });
  } catch (error) {
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

router.put('/profile-picture', isAuthenticated, async (req, res) => {
  try {
    const userId = req.auth._id;
    const { profilePictureUrl } = req.body;
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { profilePicture: profilePictureUrl },
      { new: true }
    ).select('-passwordHash');
    if (!updatedUser) { return res.status(404).json({ message: 'Utilisateur non trouvé.' }); }

    const authToken = generateToken(updatedUser);
    res.status(200).json({ authToken });
  } catch (error) {
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

module.exports = router;