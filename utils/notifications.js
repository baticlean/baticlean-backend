// Fichier : backend/utils/notifications.js (Version Définitive)

const User = require('../models/User.model');
const Ticket = require('../models/Ticket.model');
const Booking = require('../models/Booking.model');
const Reclamation = require('../models/Reclamation.model');

const broadcastToAdmins = async (req, event, payload) => {
    try {
        const { io, onlineUsers } = req;
        const admins = await User.find({ role: { $in: ['admin', 'superAdmin'] } });
        admins.forEach(admin => {
            const adminSocketId = onlineUsers[admin._id.toString()];
            if (adminSocketId) {
                io.to(adminSocketId).emit(event, payload);
            }
        });
    } catch (error) {
        console.error("Erreur lors de la diffusion aux admins:", error);
    }
};

const broadcastNotificationCounts = async (req) => {
    try {
        // --- CORRECTION DÉFINITIVE DES CHAMPS DE LA BASE DE DONNÉES ---
        // Ces noms de champs sont maintenant identiques à ceux de votre fichier notification.routes.js

        const userCount = await User.countDocuments({ isNew: true });
        const ticketCount = await Ticket.countDocuments({ readByAdmin: false });
        const bookingCount = await Booking.countDocuments({ readByAdmin: false });
        const reclamationCount = await Reclamation.countDocuments({ readByAdmin: false });

        const counts = {
            users: userCount,
            tickets: ticketCount,
            bookings: bookingCount,
            reclamations: reclamationCount
        };

        console.log("🚀 [Serveur] Envoi de l'objet de compteurs unifié :", counts);
        await broadcastToAdmins(req, 'notificationCountsUpdated', counts);

    } catch (error) {
        console.error("❌ Erreur critique lors du calcul des compteurs:", error);
    }
};

module.exports = { broadcastToAdmins, broadcastNotificationCounts };