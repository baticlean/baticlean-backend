// Fichier : backend/routes/admin.routes.js

const express = require('express');
const router = express.Router();
const User = require('../models/User.model');
const Booking = require('../models/Booking.model'); // On importe les modèles nécessaires
const Service = require('../models/Service.model');
const Ticket = require('../models/Ticket.model');
const jwt = require('jsonwebtoken');
const { isAuthenticated, isAdmin, isSuperAdmin } = require('../middleware/isAdmin.js');

// ✅ NOUVEAU : Route pour les statistiques du tableau de bord
router.get('/dashboard-stats', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const sevenDaysAgo = new Date(new Date().setDate(new Date().getDate() - 7));

        // Cartes de statistiques principales
        const totalUsers = await User.countDocuments({ role: { $ne: 'superAdmin' } });
        const pendingBookings = await Booking.countDocuments({ status: 'En attente' });
        const newUsersLast7Days = await User.countDocuments({ createdAt: { $gte: sevenDaysAgo } });
        const newBookingsLast7Days = await Booking.countDocuments({ createdAt: { $gte: sevenDaysAgo } });

        // Derniers avis des clients
        const recentReviews = await Service.aggregate([
            { $unwind: '$reviews' }, // Sépare chaque avis en un document distinct
            { $sort: { 'reviews.createdAt': -1 } }, // Trie par date de l'avis
            { $limit: 5 }, // Ne prend que les 5 plus récents
            { $project: { // Formate les données pour le frontend
                _id: '$reviews._id',
                serviceTitle: '$title',
                username: '$reviews.username',
                rating: '$reviews.rating',
                comment: '$reviews.comment',
                createdAt: '$reviews.createdAt'
            }}
        ]);
        
        // Derniers tickets non assignés
        const recentTickets = await Ticket.find({ assignedAdmin: null })
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('user', 'username');

        res.status(200).json({
            stats: {
                totalUsers,
                pendingBookings,
                newUsersLast7Days,
                newBookingsLast7Days
            },
            recentReviews,
            recentTickets
        });

    } catch (error) {
        console.error("Erreur lors de la récupération des statistiques:", error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});


// --- VOS AUTRES ROUTES (INCHANGÉES) ---

// Route pour obtenir tous les utilisateurs
router.get('/users', isAuthenticated, isSuperAdmin, async (req, res) => {
  try {
    const { search } = req.query;
    let query = { role: { $ne: 'superAdmin' } };

    if (search) {
      const regex = new RegExp(search, 'i');
      query.$or = [
        { username: regex },
        { email: regex },
        { phoneNumber: regex }
      ];
    }

    const users = await User.find(query)
        .sort({ createdAt: -1 })
        .select('-passwordHash');

    res.status(200).json(users);
  } catch (error) {
    console.error("Erreur lors de la récupération des utilisateurs:", error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

// Route pour mettre à jour le RÔLE d'un utilisateur
router.patch('/users/:userId/role', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    const updatedUser = await User.findByIdAndUpdate(userId, { role }, { new: true }).select('-passwordHash');
    if (!updatedUser) {
      return res.status(404).json({ message: 'Utilisateur non trouvé.' });
    }
    
    const payload = { _id: updatedUser._id, email: updatedUser.email, username: updatedUser.username, role: updatedUser.role, status: updatedUser.status, profilePicture: updatedUser.profilePicture, phoneNumber: updatedUser.phoneNumber };
    const newAuthToken = jwt.sign(payload, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '6h' });

    req.io.emit('userUpdated', { user: updatedUser, newToken: newAuthToken });

    res.status(200).json(updatedUser);
  } catch (error) {
    console.error("Erreur lors de la mise à jour du rôle:", error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

// Route pour mettre à jour le STATUT d'un utilisateur
router.patch('/users/:userId/status', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.body;

    const updatedUser = await User.findByIdAndUpdate(userId, { status }, { new: true }).select('-passwordHash');
    if (!updatedUser) {
      return res.status(404).json({ message: 'Utilisateur non trouvé.' });
    }
    
    const payload = { _id: updatedUser._id, email: updatedUser.email, username: updatedUser.username, role: updatedUser.role, status: updatedUser.status, profilePicture: updatedUser.profilePicture, phoneNumber: updatedUser.phoneNumber };
    const newAuthToken = jwt.sign(payload, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '6h' });

    req.io.emit('userUpdated', { user: updatedUser, newToken: newAuthToken });

    res.status(200).json(updatedUser);
  } catch (error) {
    console.error("Erreur lors de la mise à jour du statut:", error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

module.exports = router;