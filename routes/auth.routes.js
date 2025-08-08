// Fichier : backend/routes/auth.routes.js

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User.model');
const { broadcastToAdmins, broadcastNotificationCounts } = require('../utils/notifications.js');
const rateLimit = require('express-rate-limit');
const SibApiV3Sdk = require('sib-api-v3-sdk');

// CONFIGURATION DE BREVO
let defaultClient = SibApiV3Sdk.ApiClient.instance;
let apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = process.env.BREVO_API_KEY;
const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

// LIMITEUR DE REQUÊTES
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { 
        error: 'Trop de tentatives.',
        message: 'Votre accès est temporairement bloqué pour des raisons de sécurité. Veuillez patienter 15 minutes avant de réessayer.'
    },
    keyGenerator: (req, res) => {
        return req.ip + (req.body.login || req.body.email);
    },
});

// ROUTE /register
router.post('/register', authLimiter, async (req, res) => {
    try {
        const { username, email, password, phoneNumber } = req.body;
        if (!username || !email || !password || !phoneNumber) {
            return res.status(400).json({ message: 'Tous les champs sont requis.' });
        }
        const passwordRegex = /^(?=.*[a-zA-Z])(?=(?:\D*\d){3,})(?=.*[!@#$%^&*(),.?":{}|<>]).{9,}$/;
        if (!passwordRegex.test(password)) {
            return res.status(400).json({ 
                message: 'Le mot de passe ne respecte pas les critères de sécurité. Il doit contenir au moins 9 caractères, dont 3 chiffres, 1 caractère spécial et des lettres.' 
            });
        }
        const userExists = await User.findOne({ $or: [{ email }, { phoneNumber }] });
        if (userExists) {
            return res.status(400).json({ message: 'Email ou numéro de téléphone déjà utilisé.' });
        }
        const salt = await bcrypt.genSalt(12);
        const passwordHash = await bcrypt.hash(password, salt);
        const newUser = await User.create({ username, email, passwordHash, phoneNumber });
        await broadcastToAdmins(req, 'newUserRegistered', { username: newUser.username });
        await broadcastNotificationCounts(req);
        res.status(201).json({ message: `Utilisateur créé avec succès !` });
    } catch (error) {
        console.error("Erreur lors de l'inscription:", error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

// ROUTE /login
router.post('/login', authLimiter, async (req, res) => {
    try {
        const { login, password } = req.body;
        if (!login || !password) { return res.status(400).json({ message: 'Tous les champs sont requis.' }); }
        const user = await User.findOne({ $or: [{ email: login }, { phoneNumber: login }] });
        if (!user) { return res.status(401).json({ message: 'Identifiant ou mot de passe incorrect.' }); }
        const isPasswordCorrect = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordCorrect) { return res.status(401).json({ message: 'Identifiant ou mot de passe incorrect.' }); }
        const { _id, username, role, email, status, profilePicture, phoneNumber } = user;
        const payload = { _id, email, username, role, status, profilePicture, phoneNumber };
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

// ✅✅✅ ROUTE DE DÉBOGAGE ✅✅✅
router.post('/forgot-password', authLimiter, async (req, res) => {
    try {
        // 1. On vérifie que les variables d'environnement sont bien chargées
        if (!process.env.BREVO_API_KEY) {
            console.error("ERREUR CRITIQUE : La variable d'environnement BREVO_API_KEY est manquante !");
            return res.status(500).json({ message: "Erreur de configuration du serveur." });
        }
        if (!process.env.FRONTEND_URL) {
            console.error("ERREUR CRITIQUE : La variable d'environnement FRONTEND_URL est manquante !");
            return res.status(500).json({ message: "Erreur de configuration du serveur." });
        }

        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(200).json({ message: 'Si un compte est associé à cet email, un lien de réinitialisation a été envoyé.' });
        }

        const resetToken = crypto.randomBytes(20).toString('hex');
        user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        user.passwordResetExpires = Date.now() + 3600000;
        await user.save({ validateBeforeSave: false });

        const resetURL = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
        const sendSmtpEmail = {
            to: [{ email: user.email, name: user.username }],
            sender: {
                name: 'BATIClean Support',
                email: 'baticlean225@gmail.com', // L'email que vous dites fonctionner
            },
            subject: 'Réinitialisation de votre mot de passe BATIClean',
            htmlContent: `<html><body><p>Bonjour ${user.username},</p><p>Cliquez sur le lien suivant pour réinitialiser votre mot de passe :</p><a href="${resetURL}" target="_blank">Réinitialiser mon mot de passe</a><p>Ce lien expirera dans une heure.</p></body></html>`,
        };

        await apiInstance.sendTransacEmail(sendSmtpEmail);
        res.status(200).json({ message: 'Si un compte est associé à cet email, un lien de réinitialisation a été envoyé.' });

    } catch (error) {
        // 2. On affiche l'erreur DÉTAILLÉE renvoyée par Brevo dans la console du serveur
        console.error("--- ERREUR DÉTAILLÉE DE BREVO ---");
        // La partie 'error.response.body' contient souvent le message d'erreur exact de Brevo
        console.error(error.response ? error.response.body : error);
        console.error("---------------------------------");

        // On renvoie un message d'erreur générique au client pour ne pas exposer de détails
        res.status(500).json({ message: "Erreur lors de l'envoi de l'email." });
    }
});

// ROUTE /reset-password
router.post('/reset-password/:token', async (req, res) => {
    try {
        const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
        const user = await User.findOne({ 
            passwordResetToken: hashedToken,
            passwordResetExpires: { $gt: Date.now() }
        });
        if (!user) {
            return res.status(400).json({ message: 'Le lien est invalide ou a expiré.' });
        }
        const { password } = req.body;
        const passwordRegex = /^(?=.*[a-zA-Z])(?=(?:\D*\d){3,})(?=.*[!@#$%^&*(),.?":{}|<>]).{9,}$/;
        if (!passwordRegex.test(password)) {
            return res.status(400).json({ 
                message: 'Le nouveau mot de passe ne respecte pas les critères de sécurité.' 
            });
        }
        const salt = await bcrypt.genSalt(12);
        user.passwordHash = await bcrypt.hash(password, salt);
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save();
        res.status(200).json({ message: 'Votre mot de passe a été réinitialisé avec succès.' });
    } catch (error) {
        res.status(500).json({ message: 'Erreur lors de la réinitialisation du mot de passe.' });
    }
});

module.exports = router;