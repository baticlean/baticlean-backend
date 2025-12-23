// baticlean-backend/routes/auth.routes.js

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
const { checkMaintenance } = require('./maintenance.routes.js');

// --- CONFIGURATION BREVO ---
const setupBrevo = () => {
    const defaultClient = SibApiV3Sdk.ApiClient.instance;
    const apiKey = defaultClient.authentications['api-key'];
    
    if (!process.env.BREVO_API_KEY) {
        console.error("❌ CRITIQUE : BREVO_API_KEY manquante dans Render !");
        return null;
    }
    
    apiKey.apiKey = process.env.BREVO_API_KEY;
    return new SibApiV3Sdk.TransactionalEmailsApi();
};

const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, 
    max: 30, 
    standardHeaders: true, 
    legacyHeaders: false,
    message: { error: 'Trop de tentatives.', message: 'Votre accès est temporairement bloqué.' },
    keyGenerator: (req) => req.ip,
});

// --- ROUTES ---

router.post('/register', authLimiter, [
    body('username', 'Le nom d\'utilisateur est requis').not().isEmpty().trim().escape(),
    body('email', 'Veuillez fournir un email valide').isEmail().normalizeEmail(),
    body('phoneNumber', 'Le numéro de téléphone est invalide').custom(v => { if (!isValidPhoneNumber(v)) throw new Error('Format invalide.'); return true; }),
    body('password', 'Le mot de passe ne respecte pas les critères.').matches(/^(?=.*[a-zA-Z])(?=(?:\D*\d){3,})(?=.*[!@#$%^&*(),.?":{}|<>]).{9,}$/)
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });
    
    try {
        const { username, email, password, phoneNumber } = req.body;
        const userExists = await User.findOne({ $or: [{ email }, { phoneNumber }] });
        if (userExists) return res.status(400).json({ message: 'Email ou numéro déjà utilisé.' });

        const salt = await bcrypt.genSalt(12);
        const passwordHash = await bcrypt.hash(password, salt);
        const newUser = await User.create({ username, email, passwordHash, phoneNumber });

        try {
            await broadcastToAdmins(req, 'newUserRegistered', { username: newUser.username });
            await broadcastNotificationCounts(req);
        } catch (err) { console.error("Notif Error:", err.message); }
        
        const payload = { _id: newUser._id, email: newUser.email, username: newUser.username, role: newUser.role, status: newUser.status, profilePicture: newUser.profilePicture, phoneNumber: newUser.phoneNumber };
        const authToken = jwt.sign(payload, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '6h' });
        
        res.status(201).json({ authToken, isNewUser: true });
    } catch (error) {
        console.error("REGISTER ERROR:", error);
        res.status(500).json({ message: 'Erreur interne.' });
    }
});

router.post('/login', authLimiter, async (req, res) => {
    try {
        const { login, password } = req.body;
        if (!login || !password) return res.status(400).json({ message: 'Champs requis.' });
        
        const user = await User.findOne({ $or: [{ email: login }, { phoneNumber: login }] });
        if (!user) return res.status(401).json({ message: 'Identifiants incorrects.' });

        const isPasswordCorrect = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordCorrect) return res.status(401).json({ message: 'Identifiants incorrects.' });
        
        const payload = { _id: user._id, email: user.email, username: user.username, role: user.role, status: user.status, profilePicture: user.profilePicture, phoneNumber: user.phoneNumber };
        const authToken = jwt.sign(payload, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '6h' });

        if (user.status !== 'active') return res.status(403).json({ message: 'Compte suspendu.', authToken });

        res.status(200).json({ authToken });
    } catch (error) {
        console.error("LOGIN ERROR:", error);
        res.status(500).json({ message: 'Erreur interne.' });
    }
});

router.post('/forgot-password', authLimiter, checkMaintenance('forgot-password'), async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });
        
        if (user) {
            const apiInstance = setupBrevo();
            if (!apiInstance) throw new Error("API Brevo non initialisée");

            const resetToken = crypto.randomBytes(20).toString('hex');
            user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
            user.passwordResetExpires = Date.now() + 15 * 60 * 1000;
            await user.save({ validateBeforeSave: false });
            
            const resetURL = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
            
            const sendSmtpEmail = {
                to: [{ email: user.email, name: user.username }],
                // ⚠️ REMPLACE no-reply@baticlean-app.com PAR TON EMAIL DE COMPTE BREVO CI-DESSOUS
                sender: { name: 'BATIClean Support', email: 'baticlean225@gmail.com' }, 
                subject: 'Réinitialisation de votre mot de passe BATIClean',
                htmlContent: `
                    <div style="font-family: Arial, sans-serif; text-align: center; color: #333; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                        <h2 style="color: #3f51b5;">BATIClean</h2>
                        <p>Bonjour <strong>${user.username}</strong>,</p>
                        <p>Cliquez sur le bouton ci-dessous pour réinitialiser votre mot de passe :</p>
                        <a href="${resetURL}" style="background-color: #3f51b5; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; margin: 20px 0;">Réinitialiser mon mot de passe</a>
                        <p style="font-size: 12px; color: #777;">Ce lien est valable 15 minutes.</p>
                    </div>`,
            };
            
            await apiInstance.sendTransacEmail(sendSmtpEmail);
            console.log("[MAIL] ✅ Succès Brevo confirmé.");
        }
        
        res.status(200).json({ message: 'Si un compte existe, un lien a été envoyé.' });
    } catch (error) {
        const errorDetail = error.response ? error.response.text : error.message;
        console.error("❌ ERREUR BREVO CRITIQUE:", errorDetail);
        res.status(500).json({ message: "Erreur technique lors de l'envoi." });
    }
});

router.post('/reset-password/:token', async (req, res) => {
    try {
        const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
        const user = await User.findOne({ 
            passwordResetToken: hashedToken,
            passwordResetExpires: { $gt: Date.now() } 
        });

        if (!user) return res.status(400).json({ message: 'Lien invalide ou expiré.' });
        
        const { password } = req.body;
        const salt = await bcrypt.genSalt(12);
        user.passwordHash = await bcrypt.hash(password, salt);
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save();
        
        res.status(200).json({ message: 'Mot de passe réinitialisé.' });
    } catch (error) {
        console.error("RESET PASSWORD ERROR:", error);
        res.status(500).json({ message: 'Erreur de réinitialisation.' });
    }
});

module.exports = router;                   