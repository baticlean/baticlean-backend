// backend/routes/auth.routes.js (Corrigé et Amélioré)

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
const { isAuthenticated } = require('../middleware/isAdmin.js'); // ✅ On importe isAuthenticated

let defaultClient = SibApiV3Sdk.ApiClient.instance;
let apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = process.env.BREVO_API_KEY;
const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false,
    message: { error: 'Trop de tentatives.', message: 'Votre accès est temporairement bloqué.' },
    keyGenerator: (req, res) => req.ip + (req.body.login || req.body.email),
});

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

        await broadcastToAdmins(req, 'newUserRegistered', { username: newUser.username });
        await broadcastNotificationCounts(req);
        
        const { _id, role, status, profilePicture, warnings } = newUser;
        const payload = { _id, email: newUser.email, username: newUser.username, role, status, profilePicture, phoneNumber: newUser.phoneNumber, warnings };
        const authToken = jwt.sign(payload, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '6h' });
        
        res.status(201).json({ 
            authToken: authToken,
            isNewUser: true 
        });

    } catch (error) {
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
        
        const { _id, username, role, email, status, profilePicture, phoneNumber, warnings } = user;
        const payload = { _id, email, username, role, status, profilePicture, phoneNumber, warnings };
        const authToken = jwt.sign(payload, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '6h' });

        if (user.status !== 'active') return res.status(403).json({ message: 'Compte suspendu.', authToken });

        res.status(200).json({ authToken });
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne.' });
    }
});

// ✅ NOUVELLE ROUTE POUR SUPPRIMER UN AVERTISSEMENT SPÉCIFIQUE
router.patch('/warnings/:warningId/clear', isAuthenticated, async (req, res) => {
    try {
        const { warningId } = req.params;
        const userId = req.auth._id;

        // On utilise $pull pour retirer un élément d'un tableau
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { $pull: { warnings: { _id: warningId } } },
            { new: true }
        ).select('-passwordHash');

        if (!updatedUser) {
            return res.status(404).json({ message: 'Utilisateur non trouvé.' });
        }
        
        // On renvoie l'utilisateur mis à jour pour que le frontend puisse actualiser l'état
        res.status(200).json({ message: 'Avertissement supprimé.', user: updatedUser });

    } catch (error) {
        console.error("Erreur lors de la suppression de l'avertissement:", error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});


router.post('/forgot-password', authLimiter, checkMaintenance('forgot-password'), async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });
        if (user) {
            const resetToken = crypto.randomBytes(20).toString('hex');
            user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
            user.passwordResetExpires = Date.now() + 15 * 60 * 1000;
            await user.save({ validateBeforeSave: false });
            const resetURL = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
            const sendSmtpEmail = {
                to: [{ email: user.email, name: user.username }],
                sender: { name: 'BATIClean Support', email: 'baticlean225@gmail.com' },
                subject: 'Réinitialisation de votre mot de passe BATIClean',
                htmlContent: `<div style="font-family: Arial, sans-serif; text-align: center; color: #333;"><h2 style="color: #8A2387;">Réinitialisation 🔑</h2><p>Bonjour ${user.username},</p><p>Cliquez sur le bouton ci-dessous pour changer de mot de passe. Ce lien expirera dans <strong>15 minutes</strong>.</p><a href="${resetURL}" style="background-color: #E94057; color: white; padding: 15px 25px; text-decoration: none; border-radius: 50px; display: inline-block; font-weight: bold;">Réinitialiser</a><p style="margin-top: 20px; font-size: 12px; color: #777;">Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p></div>`,
            };
            await apiInstance.sendTransacEmail(sendSmtpEmail);
        }
        res.status(200).json({ message: 'Si un compte existe, un lien a été envoyé.' });
    } catch (error) {
        res.status(500).json({ message: "Erreur d'envoi de l'email." });
    }
});
router.post('/reset-password/:token', async (req, res) => {
    try {
        const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
        const user = await User.findOne({ passwordResetToken: hashedToken });
        if (!user) return res.status(400).json({ message: 'Lien invalide ou déjà utilisé.' });
        if (Date.now() > user.passwordResetExpires) return res.status(400).json({ message: "Lien expiré. Veuillez refaire une demande." });
        const { password } = req.body;
        const passwordRegex = /^(?=.*[a-zA-Z])(?=(?:\D*\d){3,})(?=.*[!@#$%^&*(),.?":{}|<>]).{9,}$/;
        if (!passwordRegex.test(password)) return res.status(400).json({ message: 'Le mot de passe est trop faible.' });
        const salt = await bcrypt.genSalt(12);
        user.passwordHash = await bcrypt.hash(password, salt);
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save();
        res.status(200).json({ message: 'Mot de passe réinitialisé.' });
    } catch (error) {
        res.status(500).json({ message: 'Erreur de réinitialisation.' });
    }
});


module.exports = router;
