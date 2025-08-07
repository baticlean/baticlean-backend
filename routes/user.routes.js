// Fichier : backend/routes/user.routes.js

const express = require('express');
const router = express.Router();
const User = require('../models/User.model.js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { isAuthenticated, isAdmin } = require('../middleware/isAdmin.js');
const { broadcastToAdmins, broadcastNotificationCounts } = require('../utils/notifications.js');

const generateToken = (user) => {
    const { _id, username, email, phoneNumber, role, status, profilePicture } = user;
    const payload = { _id, username, email, phoneNumber, role, status, profilePicture };
    return jwt.sign(payload, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '6h' });
};

router.post('/register', async (req, res) => {
    try {
        const { username, email, password, phoneNumber } = req.body;
        if (!username || !email || !password || !phoneNumber) {
            return res.status(400).json({ message: 'Tous les champs sont requis.' });
        }
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'Cet email est déjà utilisé.' });
        }
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);
        const newUser = await User.create({ username, email, passwordHash, phoneNumber, isVerified: false });

        // CORRECTION : On passe l'objet `req` en entier
        await broadcastToAdmins(req, 'newUserRegistered', { _id: newUser._id, username: newUser.username });
        await broadcastNotificationCounts(req);

        res.status(201).json({ message: "Inscription réussie ! Veuillez vous connecter." });
    } catch (error) {
        console.error("Erreur d'inscription:", error);
        res.status(500).json({ message: "Erreur interne du serveur" });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'Email ou mot de passe incorrect.' });
        }
        if (user.status !== 'active') {
             return res.status(403).json({ message: `Votre compte est ${user.status}. Veuillez contacter le support.`, authToken: generateToken(user) });
        }
        const isPasswordCorrect = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordCorrect) {
            return res.status(401).json({ message: 'Email ou mot de passe incorrect.' });
        }
        const authToken = generateToken(user);
        res.status(200).json({ authToken });
    } catch (error) {
        console.error("Erreur de connexion:", error);
        res.status(500).json({ message: "Erreur interne du serveur" });
    }
});

router.patch('/admin/update/:userId', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const { role, status } = req.body;
        const userToUpdate = await User.findById(userId);
        if (!userToUpdate) return res.status(404).json({ message: 'Utilisateur non trouvé.' });
        if (role) userToUpdate.role = role;
        if (status) userToUpdate.status = status;
        await userToUpdate.save();
        const updatedUser = await User.findById(userId).select('-passwordHash');

        // CORRECTION : On utilise `req.onlineUsers` au lieu de `getUserSocket`
        const userSocketId = req.onlineUsers[userId];
        if (userSocketId) {
            const newToken = generateToken(updatedUser);
            req.io.to(userSocketId).emit('userUpdated', { user: updatedUser, newToken });
        }
        res.status(200).json(updatedUser);
    } catch (error) {
        console.error("Erreur lors de la mise à jour admin :", error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

router.put('/profile', isAuthenticated, async (req, res) => {
    try {
        const userId = req.auth._id;
        const { username, email, phoneNumber } = req.body;
        const updatedUser = await User.findByIdAndUpdate(userId, { username, email, phoneNumber }, { new: true }).select('-passwordHash');
        if (!updatedUser) return res.status(404).json({ message: 'Utilisateur non trouvé.' });
        const authToken = generateToken(updatedUser);

        // CORRECTION : On utilise `req.onlineUsers` au lieu de `getUserSocket`
        const userSocketId = req.onlineUsers[userId];
        if (userSocketId) {
             req.io.to(userSocketId).emit('userUpdated', { user: updatedUser, newToken: authToken });
        }
        res.status(200).json({ authToken });
    } catch (error) {
        console.error("Erreur lors de la mise à jour du profil :", error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

router.put('/profile-picture', isAuthenticated, async (req, res) => {
    try {
        const userId = req.auth._id;
        const { profilePictureUrl } = req.body;
        const updatedUser = await User.findByIdAndUpdate(userId, { profilePicture: profilePictureUrl }, { new: true }).select('-passwordHash');
        if (!updatedUser) return res.status(404).json({ message: 'Utilisateur non trouvé.' });
        const authToken = generateToken(updatedUser);

        // CORRECTION : On utilise `req.onlineUsers` au lieu de `getUserSocket`
        const userSocketId = req.onlineUsers[userId];
        if (userSocketId) {
             req.io.to(userSocketId).emit('userUpdated', { user: updatedUser, newToken: authToken });
        }
        res.status(200).json({ authToken });
    } catch (error) {
        console.error("Erreur lors de la mise à jour de la photo :", error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

router.get('/admin/users', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const users = await User.find().select('-passwordHash').sort({ createdAt: -1 });
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

module.exports = router;