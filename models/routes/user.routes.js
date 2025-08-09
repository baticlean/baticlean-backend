// Fichier : backend/routes/user.routes.js

const express = require('express');
const router = express.Router();
const User = require('../models/User.model.js');
const jwt = require('jsonwebtoken');
const { isAuthenticated } = require('../middleware/isAdmin.js');
const { body, validationResult } = require('express-validator'); // ✅ 1. IMPORTER LES OUTILS

// Fonction pour générer un token
const generateToken = (user) => {
    const { _id, username, email, phoneNumber, role, status, profilePicture } = user;
    const payload = { _id, username, email, phoneNumber, role, status, profilePicture };
    return jwt.sign(payload, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '6h' });
};

// Mettre à jour son propre profil
router.put('/profile', 
    isAuthenticated,
    // ✅ 2. AJOUTER LES RÈGLES DE VALIDATION
    [
        body('username', 'Le nom d\'utilisateur est requis').not().isEmpty().trim().escape(),
        body('email', 'Veuillez fournir un email valide').isEmail().normalizeEmail(),
        body('phoneNumber', 'Le numéro de téléphone est invalide').isMobilePhone('any').trim().escape()
    ],
    async (req, res) => {
        // ✅ 3. VÉRIFIER LES ERREURS DE VALIDATION
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const userId = req.auth._id;
            const { username, email, phoneNumber } = req.body;
            const updatedUser = await User.findByIdAndUpdate(userId, { username, email, phoneNumber }, { new: true }).select('-passwordHash');
            if (!updatedUser) return res.status(404).json({ message: 'Utilisateur non trouvé.' });

            const authToken = generateToken(updatedUser);
            const userSocketId = req.onlineUsers[userId];
            if (userSocketId) {
                 req.io.to(userSocketId).emit('userUpdated', { user: updatedUser, newToken: authToken });
            }

            res.status(200).json({ authToken });
        } catch (error) {
            console.error("Erreur lors de la mise à jour du profil :", error);
            res.status(500).json({ message: 'Erreur interne du serveur.' });
        }
    }
);

// Mettre à jour sa photo de profil
router.put('/profile-picture', 
    isAuthenticated,
    // On peut aussi valider les URL
    [ body('profilePictureUrl', 'URL invalide').isURL() ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const userId = req.auth._id;
            const { profilePictureUrl } = req.body;
            const updatedUser = await User.findByIdAndUpdate(userId, { profilePicture: profilePictureUrl }, { new: true }).select('-passwordHash');
            if (!updatedUser) return res.status(404).json({ message: 'Utilisateur non trouvé.' });

            const authToken = generateToken(updatedUser);
            const userSocketId = req.onlineUsers[userId];
            if (userSocketId) {
                 req.io.to(userSocketId).emit('userUpdated', { user: updatedUser, newToken: authToken });
            }

            res.status(200).json({ authToken });
        } catch (error) {
            console.error("Erreur lors de la mise à jour de la photo :", error);
            res.status(500).json({ message: 'Erreur interne du serveur.' });
        }
    }
);

module.exports = router;