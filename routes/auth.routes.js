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
const { body, validationResult } = require('express-validator');
const { isValidPhoneNumber } = require('libphonenumber-js');

let defaultClient = SibApiV3Sdk.ApiClient.instance;
let apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = process.env.BREVO_API_KEY;
const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

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

router.post('/register', 
    authLimiter, 
    [
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

// ✅ MODIFIÉ : Route de mot de passe oublié améliorée
router.post('/forgot-password', authLimiter, async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(200).json({ message: 'Si un compte est associé à cet email, un lien de réinitialisation a été envoyé.' });
        }

        const resetToken = crypto.randomBytes(20).toString('hex');
        user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        // MODIFIÉ : Expiration réglée à 15 minutes
        user.passwordResetExpires = Date.now() + 15 * 60 * 1000; // 15 minutes
        await user.save({ validateBeforeSave: false });

        const resetURL = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

        // MODIFIÉ : Contenu de l'email amélioré avec un bouton et des emojis
        const sendSmtpEmail = {
            to: [{ email: user.email, name: user.username }],
            sender: {
                name: 'BATIClean Support',
                email: 'baticlean225@gmail.com',
            },
            subject: 'Réinitialisation de votre mot de passe BATIClean',
            htmlContent: `
                <div style="font-family: Arial, sans-serif; text-align: center; color: #333;">
                    <h2 style="color: #8A2387;">Réinitialisation de Mot de Passe 🔑</h2>
                    <p>Bonjour ${user.username},</p>
                    <p>Nous avons reçu une demande pour réinitialiser le mot de passe de votre compte.</p>
                    <p>Cliquez sur le bouton ci-dessous pour continuer. Ce lien expirera dans <strong>15 minutes</strong>.</p>
                    <a href="${resetURL}" style="background-color: #E94057; color: white; padding: 15px 25px; text-decoration: none; border-radius: 50px; display: inline-block; font-weight: bold;">Réinitialiser mon mot de passe</a>
                    <p style="margin-top: 20px; font-size: 12px; color: #777;">Si vous n'avez pas fait cette demande, vous pouvez ignorer cet email en toute sécurité.</p>
                </div>`,
        };

        await apiInstance.sendTransacEmail(sendSmtpEmail);
        res.status(200).json({ message: 'Si un compte est associé à cet email, un lien de réinitialisation a été envoyé.' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Erreur lors de l'envoi de l'email." });
    }
});


// ✅ MODIFIÉ : Route de réinitialisation avec messages d'erreur spécifiques
router.post('/reset-password/:token', async (req, res) => {
    try {
        const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

        // NOUVEAU : Logique de vérification améliorée
        // 1. On cherche d'abord un utilisateur avec ce token, même s'il a expiré
        const user = await User.findOne({ passwordResetToken: hashedToken });

        // 2. Si aucun utilisateur n'est trouvé, le lien est invalide ou a déjà été utilisé
        if (!user) {
            return res.status(400).json({ message: 'Ce lien est invalide ou a déjà été utilisé.' });
        }

        // 3. Si l'utilisateur est trouvé, on vérifie si le token a expiré
        if (Date.now() > user.passwordResetExpires) {
            return res.status(400).json({ message: "Le lien n'est plus valide car le délai d'utilisation est passé. Veuillez en demander un autre." });
        }

        // Si tout est bon, on continue...
        const { password } = req.body;
        const passwordRegex = /^(?=.*[a-zA-Z])(?=(?:\D*\d){3,})(?=.*[!@#$%^&*(),.?":{}|<>]).{9,}$/;
        if (!passwordRegex.test(password)) {
            return res.status(400).json({ 
                message: 'Le nouveau mot de passe ne respecte pas les critères de sécurité.' 
            });
        }

        const salt = await bcrypt.genSalt(12);
        user.passwordHash = await bcrypt.hash(password, salt);
        // On invalide le token pour qu'il ne soit plus utilisable
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save();

        res.status(200).json({ message: 'Votre mot de passe a été réinitialisé avec succès.' });

    } catch (error) {
        res.status(500).json({ message: 'Erreur lors de la réinitialisation du mot de passe.' });
    }
});


module.exports = router;