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

// NOUVEAU : Importations pour la validation avancée
const { body, validationResult } = require('express-validator');
const { isValidPhoneNumber } = require('libphonenumber-js');


// Configuration de Brevo (inchangée)
let defaultClient = SibApiV3Sdk.ApiClient.instance;
let apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = process.env.BREVO_API_KEY;
const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();


// Sécurité anti-force-brute (inchangée)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { 
        error: 'Trop de tentatives de connexion.',
        message: 'Votre accès est temporairement bloqué pour des raisons de sécurité. Veuillez patienter 15 minutes avant de réessayer.'
    },
    keyGenerator: (req, res) => {
        return req.ip + (req.body.login || req.body.email);
    },
});

// ✅ MODIFIÉ : Route /register avec validation renforcée
router.post('/register', 
    authLimiter, 
    [ // Nouvelles règles de validation
        body('username', 'Le nom d\'utilisateur est requis').not().isEmpty().trim().escape(),
        body('email', 'Veuillez fournir un email valide').isEmail().normalizeEmail(),
        body('phoneNumber', 'Le numéro de téléphone est invalide').custom((value) => {
            if (!isValidPhoneNumber(value)) {
                throw new Error('Le format du numéro de téléphone est incorrect.');
            }
            return true;
        }),
        body('password', 'Le mot de passe ne respecte pas les critères de sécurité.')
            .matches(/^(?=.*[a-zA-Z])(?=(?:\D*\d){3,})(?=.*[!@#$%^&*(),.?":{}|<>]).{9,}$/)
    ],
    async (req, res) => {
        // Vérification des erreurs de validation
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ message: errors.array()[0].msg });
        }

        try {
            const { username, email, password, phoneNumber } = req.body;

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
    }
);

// Route /login (inchangée)
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

// ✅ MODIFIÉ : Route de mot de passe oublié avec maintenance désactivée
router.post('/forgot-password', authLimiter, async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            // Pour la sécurité, on ne confirme jamais si un email existe ou non.
            return res.status(200).json({ message: 'Si un compte est associé à cet email, un lien de réinitialisation a été envoyé.' });
        }

        const resetToken = crypto.randomBytes(20).toString('hex');
        user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        user.passwordResetExpires = Date.now() + 3600000; // Valide 1 heure
        await user.save({ validateBeforeSave: false });

        const resetURL = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
        const sendSmtpEmail = {
            to: [{ email: user.email, name: user.username }],
            sender: {
                name: 'BATIClean Support',
                email: 'baticlean225@gmail.com',
            },
            subject: 'Réinitialisation de votre mot de passe BATIClean',
            // IMPORTANT : Personnalisez votre email ici
            htmlContent: `<html><body><p>Bonjour ${user.username},</p><p>Vous avez demandé une réinitialisation de mot de passe. Veuillez cliquer sur ce <a href="${resetURL}">lien</a> pour continuer.</p><p>Ce lien expirera dans une heure.</p></body></html>`,
        };

        await apiInstance.sendTransacEmail(sendSmtpEmail);
        res.status(200).json({ message: 'Si un compte est associé à cet email, un lien de réinitialisation a été envoyé.' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Erreur lors de l'envoi de l'email." });
    }
});


// Route de réinitialisation effective du mot de passe (inchangée)
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