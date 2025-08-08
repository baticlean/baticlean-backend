const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto'); // Outil pour générer un token sécurisé
const User = require('../models/User.model');
const SibApiV3Sdk = require('sib-api-v3-sdk'); // SDK de Brevo

// Configuration de Brevo
let defaultClient = SibApiV3Sdk.ApiClient.instance;
let apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = process.env.BREVO_API_KEY; // Utilise la clé API des variables d'environnement

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

// La route /register reste inchangée
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
    await User.create({ username, email, passwordHash, phoneNumber });
    req.io.emit('userListUpdated');
    res.status(201).json({ message: `Utilisateur créé avec succès !` });
  } catch (error) {
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

// La route /login reste inchangée
router.post('/login', async (req, res) => {
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
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});


// --- NOUVELLE ROUTE : MOT DE PASSE OUBLIÉ ---
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      // Pour des raisons de sécurité, on ne révèle pas si l'email existe
      return res.status(200).json({ message: 'Si un compte est associé à cet email, un lien de réinitialisation a été envoyé.' });
    }

    // 1. Créer un token de réinitialisation unique et temporaire
    const resetToken = crypto.randomBytes(20).toString('hex');
    user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.passwordResetExpires = Date.now() + 3600000; // Le token expire dans 1 heure
    await user.save();

    // 2. Préparer et envoyer l'email via Brevo
    const resetURL = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    const sendSmtpEmail = {
      to: [{ email: user.email, name: user.username }],
      sender: {
        name: 'BATIClean.CI Support',
        email: 'baticlean225@gmail.com', // TRÈS IMPORTANT
      },
      subject: 'Réinitialisation de votre mot de passe BATIClean',
      htmlContent: `<html><body><p>Bonjour ${user.username},</p><p>Cliquez sur le lien suivant pour réinitialiser votre mot de passe :</p><a href="${resetURL}">Réinitialiser mon mot de passe</a><p>Ce lien expirera dans une heure.</p></body></html>`,
    };

    await apiInstance.sendTransacEmail(sendSmtpEmail);

    res.status(200).json({ message: 'Si un compte est associé à cet email, un lien de réinitialisation a été envoyé.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur lors de l\'envoi de l\'email.' });
  }
});

// --- NOUVELLE ROUTE : RÉINITIALISER LE MOT DE PASSE ---
router.post('/reset-password/:token', async (req, res) => {
    try {
        const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
        const user = await User.findOne({ 
            passwordResetToken: hashedToken,
            passwordResetExpires: { $gt: Date.now() } // On vérifie que le token n'a pas expiré
        });

        if (!user) {
            return res.status(400).json({ message: 'Le lien est invalide ou a expiré.' });
        }

        // Mettre à jour le mot de passe
        const salt = await bcrypt.genSalt(12);
        user.passwordHash = await bcrypt.hash(req.body.password, salt);
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save();

        res.status(200).json({ message: 'Mot de passe réinitialisé avec succès.' });
    } catch (error) {
        res.status(500).json({ message: 'Erreur lors de la réinitialisation du mot de passe.' });
    }
});

module.exports = router;