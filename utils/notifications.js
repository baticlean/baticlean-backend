// Fichier : backend/utils/notifications.js

const User = require('../models/User.model');
const Ticket = require('../models/Ticket.model');
const Booking = require('../models/Booking.model');
const Reclamation = require('../models/Reclamation.model');

/**
 * Diffuse un événement à tous les administrateurs et super-administrateurs en ligne.
 * @param {object} req - L'objet Requête Express, pour accéder à io et onlineUsers.
 * @param {string} event - Le nom de l'événement à émettre.
 * @param {object} payload - Les données à envoyer avec l'événement.
 */
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

/**
 * Calcule tous les compteurs de notifications et les diffuse aux admins.
 * @param {object} req - L'objet Requête Express.
 */
const broadcastNotificationCounts = async (req) => {
    try {
        const { io, onlineUsers } = req;

        const unreadTickets = await Ticket.countDocuments({ isReadByAdmin: false, status: { $ne: 'Résolu' } });
        const pendingBookings = await Booking.countDocuments({ status: 'En attente' });
        const newReclamations = await Reclamation.countDocuments({ isHandled: false });
        const newUsers = await User.countDocuments({ isVerified: false });

        const counts = {
            tickets: unreadTickets,
            bookings: pendingBookings,
            reclamations: newReclamations,
            users: newUsers
        };

        // On utilise la fonction ci-dessus pour diffuser
        await broadcastToAdmins(req, 'notificationCountsUpdated', counts);

    } catch (error) {
        console.error("Erreur lors du calcul et de la diffusion des compteurs:", error);
    }
};

module.exports = { broadcastToAdmins, broadcastNotificationCounts };