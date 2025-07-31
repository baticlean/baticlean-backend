// routes/user.routes.js
const express = require('express');
const router = express.Router();
const User = require('../models/User.model.js');
const { isAuthenticated } = require('../middleware/isAdmin.js');

// ROUTE PUT /api/user/profile - Met à jour les infos de l'utilisateur connecté
router.put('/profile', isAuthenticated, async (req, res) => {
  try {
    const userId = req.auth._id;
    const { username, email, phoneNumber } = req.body;

    // On vérifie que les champs ne sont pas vides
    if (!username || !email || !phoneNumber) {
      return res.status(400).json({ message: 'Tous les champs sont requis.' });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { username, email, phoneNumber },
      { new: true }
    ).select('-passwordHash');

    if (!updatedUser) {
      return res.status(404).json({ message: 'Utilisateur non trouvé.' });
    }

    res.status(200).json(updatedUser);
  } catch (error) {
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

// ROUTE PUT /api/user/profile-picture - Met à jour la photo de profil
router.put('/profile-picture', isAuthenticated, async (req, res) => {
  try {
    const userId = req.auth._id;
    const { profilePictureUrl } = req.body; // On attend l'URL de l'image de Cloudinary

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { profilePicture: profilePictureUrl },
      { new: true }
    ).select('-passwordHash');

    if (!updatedUser) {
      return res.status(404).json({ message: 'Utilisateur non trouvé.' });
    }

    res.status(200).json(updatedUser);
  } catch (error) {
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

module.exports = router;