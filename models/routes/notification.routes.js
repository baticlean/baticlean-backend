// Fichier : backend/routes/notification.routes.js (Version finale avec lecture par type)

const express = require('express');
const router = express.Router();
const { isAuthenticated, isAdmin } = require('../middleware/isAdmin.js');

const User = require('../models/User.model');
const Ticket = require('../models/Ticket.model');
const Booking = require('../models/Booking.model');
const Reclamation = require('../models/Reclamation.model');
const { broadcastNotificationCounts } = require('../utils/notifications.js');

// ROUTE 1 : Compter les notifications non lues pour l'admin actuel (inchangée)
router.get('/counts', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const adminId = req.auth._id;

        const userCount = await User.countDocuments({ readByAdmins: { $ne: adminId } });
        const ticketCount = await Ticket.countDocuments({ readByAdmins: { $ne: adminId } });
        const bookingCount = await Booking.countDocuments({ readByAdmins: { $ne: adminId } });
        const reclamationCount = await Reclamation.countDocuments({ readByAdmins: { $ne: adminId } });

        res.status(200).json({
            users: userCount,
            tickets: ticketCount,
            bookings: bookingCount,
            reclamations: reclamationCount,
        });
    } catch (error) {
        console.error("Erreur lors du comptage des notifications:", error);
        res.status(500).json({ message: "Erreur interne du serveur." });
    }
});

// ✅ NOUVELLE ROUTE : Marquer une catégorie de notifications comme lue pour l'admin qui clique
router.patch('/:type/mark-as-read', isAuthenticated, isAdmin, async (req, res) => {
    const { type } = req.params;
    const adminId = req.auth._id;
    let Model;

    switch (type) {
        case 'users': Model = User; break;
        case 'tickets': Model = Ticket; break;
        case 'bookings': Model = Booking; break;
        case 'reclamations': Model = Reclamation; break;
        default:
            return res.status(400).json({ message: 'Type de notification inconnu.' });
    }

    try {
        // Ajoute l'ID de l'admin à la liste des lecteurs pour tous les documents de ce type
        await Model.updateMany(
            { readByAdmins: { $ne: adminId } },
            { $addToSet: { readByAdmins: adminId } }
        );

        // Rediffuse les compteurs mis à jour
        await broadcastNotificationCounts(req);
        res.status(200).json({ message: `Notifications de type '${type}' marquées comme lues pour vous.` });
    } catch (error) {
        console.error(`Erreur lors de la mise à jour des notifications de type '${type}':`, error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

module.exports = router;