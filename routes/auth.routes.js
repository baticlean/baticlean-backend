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

    const newUser = await User.create({ username, email, passwordHash, phoneNumber });

    // --- CORRECTION : NOTIFICATION CIBLÉE ---
    // 1. On récupère les IDs de tous les utilisateurs qui sont admin ou superAdmin.
    const admins = await User.find({ role: { $in: ['admin', 'superAdmin'] } }).select('_id');
    const adminIds = admins.map(admin => admin._id.toString());

    // 2. On récupère la liste des utilisateurs actuellement en ligne.
    const onlineUserIds = Object.keys(req.onlineUsers);

    // 3. On filtre pour ne garder que les admins qui sont en ligne.
    const onlineAdmins = adminIds.filter(id => onlineUserIds.includes(id));

    // 4. On envoie la notification uniquement aux sockets de ces admins.
    if (onlineAdmins.length > 0) {
      const messagePayload = { username: newUser.username };
      onlineAdmins.forEach(adminId => {
        const socketId = req.onlineUsers[adminId];
        req.io.to(socketId).emit('newUserRegistered', messagePayload);
      });
    }

    res.status(201).json({ message: `Utilisateur créé avec succès !` });
  } catch (error) {
    console.error("Erreur lors de l'inscription:", error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { login, password } = req.body;
    if (!login || !password) { return res.status(400).json({ message: 'Tous les champs sont requis.' }); }

    const user = await User.findOne({ $or: [{ email: login }, { phoneNumber: login }] });
    if (!user) { return res.status(401).json({ message: 'Identifiant ou mot de passe incorrect.' }); }

    const isPasswordCorrect = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordCorrect) { return res.status(401).json({ message: 'Identifiant ou mot de passe incorrect.' }); }

    // --- CORRECTION ICI ---
    // On ajoute 'phoneNumber' à la liste des informations extraites de l'utilisateur
    const { _id, username, role, email, status, profilePicture, isNew, phoneNumber } = user;
    // On ajoute 'phoneNumber' au payload du token
    const payload = { _id, email, username, role, status, profilePicture, isNew, phoneNumber };

    const authToken = jwt.sign(payload, process.env.JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: '6h',
    });

    if (user.status !== 'active') {
        return res.status(403).json({ 
            message: 'Votre compte a été suspendu ou banni.',
            authToken: authToken
        });
    }

    res.status(200).json({ authToken });
  } catch (error) {
    console.error("Erreur lors de la connexion:", error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

module.exports = router;