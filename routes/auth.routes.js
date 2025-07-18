// routes/auth.routes.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User.model');

// Le "sel" pour le hachage du mot de passe. 12 est un bon niveau de sécurité.
const saltRounds = 12;

// ROUTE POST /api/register (Inscription)
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Tous les champs sont requis.' });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'Cet email est déjà utilisé.' });
    }

    const salt = await bcrypt.genSalt(saltRounds);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      username,
      email,
      passwordHash,
    });

    res.status(201).json({ 
        message: `Utilisateur ${newUser.username} créé avec succès !`,
        userId: newUser._id
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

// ROUTE POST /api/login (Connexion) - NOUVEAU
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Tous les champs sont requis.' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'Email ou mot de passe incorrect.' });
        }

        const isPasswordCorrect = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordCorrect) {
            return res.status(401).json({ message: 'Email ou mot de passe incorrect.' });
        }

        // Créer un token JWT
        const { _id, username, role } = user;
        const payload = { _id, email, username, role };

        // On signe le token avec un secret (à mettre dans les variables d'environnement plus tard)
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