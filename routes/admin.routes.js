// routes/admin.routes.js
const express = require('express');
const router = express.Router();
const User = require('../models/User.model');
const { isAuthenticated, isAdmin } = require('../middleware/isAdmin.js');

// ROUTE GET /api/admin/users
// Renvoie tous les utilisateurs (sauf le superAdmin)
// Protégée : il faut être connecté ET être admin
router.get('/users', isAuthenticated, isAdmin, async (req, res) => {
  try {
    // On récupère tous les utilisateurs dont le rôle n'est pas 'superAdmin'
    const users = await User.find({ role: { $ne: 'superAdmin' } }).select('-passwordHash'); // On exclut le mot de passe
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

module.exports = router;