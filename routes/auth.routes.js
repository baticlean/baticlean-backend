// routes/auth.routes.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User.model');

// --- ROUTE D'INSCRIPTION MISE À JOUR ---
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, phoneNumber } = req.body;

    if (!username || !email || !password || !phoneNumber) {
      return res.status(400).json({ message: 'Tous les champs sont requis.' });
    }

    const emailExists = await User.findOne({ email });
    if (emailExists) {
      return res.status(400).json({ message: 'Cet email est déjà utilisé.' });
    }

    const phoneExists = await User.findOne({ phoneNumber });
    if (phoneExists) {
      return res.status(400).json({ message: 'Ce numéro de téléphone est déjà utilisé.' });
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = await User.create({ username, email, passwordHash, phoneNumber });
    res.status(201).json({ message: `Utilisateur ${newUser.username} créé avec succès !` });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

// --- ROUTE DE CONNEXION MISE À JOUR ---
router.post('/login', async (req, res) => {
  try {
    const { login, password } = req.body; // 'login' peut être un email ou un téléphone

    if (!login || !password) {
      return res.status(400).json({ message: 'Tous les champs sont requis.' });
    }

    // On cherche un utilisateur par son email OU son numéro de téléphone
    const user = await User.findOne({ $or: [{ email: login }, { phoneNumber: login }] });
    if (!user) {
      return res.status(401).json({ message: 'Identifiant ou mot de passe incorrect.' });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordCorrect) {
      return res.status(401).json({ message: 'Identifiant ou mot de passe incorrect.' });
    }

    const { _id, username, role, email } = user;
    const payload = { _id, email, username, role };

    const authToken = jwt.sign(payload, process.env.JWT_SECRET || 'super-secret', {
      algorithm: 'HS256',
      expiresIn: '6h',
    });

    res.status(200).json({ authToken: authToken });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

module.exports = router;