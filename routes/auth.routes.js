const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User.model');

router.post('/register', async (req, res) => {
  try {
    const { username, email, password, phoneNumber } = req.body;
    if (!username || !email || !password || !phoneNumber) {
      return res.status(400).json({ message: 'Tous les champs sont requis.' });
    }
    const userExists = await User.findOne({ $or: [{ email }, { phoneNumber }] });
    if (userExists) {
      return res.status(400).json({ message: 'Email ou numéro de téléphone déjà utilisé.' });
    }
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);
    await User.create({ username, email, passwordHash, phoneNumber });
    res.status(201).json({ message: `Utilisateur créé avec succès !` });
  } catch (error) {
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { login, password } = req.body;
    if (!login || !password) { return res.status(400).json({ message: 'Tous les champs sont requis.' }); }
    const user = await User.findOne({ $or: [{ email: login }, { phoneNumber: login }] });
    if (!user) { return res.status(401).json({ message: 'Identifiant ou mot de passe incorrect.' }); }
    if (user.status !== 'active') {
        return res.status(403).json({ message: 'Votre compte a été suspendu ou banni.' });
    }
    const isPasswordCorrect = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordCorrect) { return res.status(401).json({ message: 'Identifiant ou mot de passe incorrect.' }); }

    const { _id, username, role, email, status, profilePicture } = user;
    const payload = { _id, email, username, role, status, profilePicture }; 
    const authToken = jwt.sign(payload, process.env.JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: '6h',
    });
    res.status(200).json({ authToken });
  } catch (error) {
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

module.exports = router;