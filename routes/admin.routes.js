// Fichier : backend/routes/admin.routes.js

const express = require('express');
const router = express.Router();
const User = require('../models/User.model');
const Booking = require('../models/Booking.model');
const Service = require('../models/Service.model');
const Ticket = require('../models/Ticket.model');
const jwt = require('jsonwebtoken');
const { isAuthenticated, isAdmin, isSuperAdmin } = require('../middleware/isAdmin.js');

router.get('/dashboard-stats', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const sevenDaysAgo = new Date(new Date().setDate(new Date().getDate() - 7));

        const totalUsers = await User.countDocuments({ role: { $ne: 'superAdmin' } });
        const pendingBookings = await Booking.countDocuments({ status: 'En attente' });
        const newUsersLast7Days = await User.countDocuments({ createdAt: { $gte: sevenDaysAgo } });
        const newBookingsLast7Days = await Booking.countDocuments({ createdAt: { $gte: sevenDaysAgo } });

        const recentReviews = await Service.aggregate([
            { $unwind: '$reviews' },
            { $sort: { 'reviews.createdAt': -1 } },
            { $limit: 5 },
            { $project: {
                _id: '$reviews._id',
                serviceTitle: '$title',
                username: '$reviews.username',
                rating: '$reviews.rating',
                comment: '$reviews.comment',
                createdAt: '$reviews.createdAt'
            }}
        ]);
        
        const recentTickets = await Ticket.find({ assignedAdmin: null })
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('user', 'username');

        // ✅ SÉCURITÉ : On filtre les tickets dont l'utilisateur a été supprimé
        const validTickets = recentTickets.filter(ticket => ticket.user);

        res.status(200).json({
            stats: {
                totalUsers,
                pendingBookings,
                newUsersLast7Days,
                newBookingsLast7Days
            },
            recentReviews,
            recentTickets: validTickets // On envoie la liste filtrée
        });

    } catch (error) {
        console.error("Erreur lors de la récupération des statistiques:", error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

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

// ✅ --- DÉBUT DE LA CORRECTION ---
// Cette fonction centralise la logique pour éviter la duplication
const updateUserAndNotify = async (req, res, userId, updateData) => {
    const updatedUser = await User.findByIdAndUpdate(userId, updateData, { new: true }).select('-passwordHash');
    if (!updatedUser) {
        return res.status(404).json({ message: 'Utilisateur non trouvé.' });
    }
    
    // On génère le nouveau token avec les informations à jour (rôle, statut, etc.)
    const payload = { 
        _id: updatedUser._id, email: updatedUser.email, username: updatedUser.username, 
        role: updatedUser.role, status: updatedUser.status, profilePicture: updatedUser.profilePicture, 
        phoneNumber: updatedUser.phoneNumber 
    };
    const newAuthToken = jwt.sign(payload, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '6h' });

    // On cherche si l'utilisateur est connecté pour lui envoyer une notification privée
    const userSocketId = req.onlineUsers[userId];
    if (userSocketId) {
        console.log(`Envoi de la mise à jour à ${updatedUser.username} sur le socket ${userSocketId}`);
        // On envoie la notification uniquement à l'utilisateur concerné
        req.io.to(userSocketId).emit('userUpdated', { user: updatedUser, newToken: newAuthToken });
    }

    // On renvoie l'utilisateur mis à jour au frontend de l'admin
    res.status(200).json(updatedUser);
};

// Route pour mettre à jour le RÔLE d'un utilisateur
router.patch('/users/:userId/role', isAuthenticated, isAdmin, async (req, res) => {
  try {
    // On utilise notre nouvelle fonction centralisée
    await updateUserAndNotify(req, res, req.params.userId, { role: req.body.role });
  } catch (error) {
    console.error("Erreur lors de la mise à jour du rôle:", error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

// Route pour mettre à jour le STATUT d'un utilisateur
router.patch('/users/:userId/status', isAuthenticated, isAdmin, async (req, res) => {
  try {
    // On utilise notre nouvelle fonction centralisée
    await updateUserAndNotify(req, res, req.params.userId, { status: req.body.status });
  } catch (error) {
    console.error("Erreur lors de la mise à jour du statut:", error);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});
// ✅ --- FIN DE LA CORRECTION ---

module.exports = router;