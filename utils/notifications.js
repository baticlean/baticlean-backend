// Fichier : backend/utils/notifications.js (Version avec notifications individuelles)

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
                // Pour les compteurs, on envoie un payload personnalisé. Sinon, le payload général.
                if (event === 'notificationCountsUpdated' && payload.individualCounts) {
                    io.to(adminSocketId).emit(event, payload.individualCounts[admin._id.toString()]);
                } else {
                    io.to(adminSocketId).emit(event, payload);
                }
            }
        });
    } catch (error) {
        console.error("Erreur lors de la diffusion aux admins:", error);
    }
};

const broadcastNotificationCounts = async (req) => {
    try {
        const { onlineUsers } = req;
        const onlineAdminIds = Object.keys(onlineUsers);

        // Objet pour stocker les compteurs de chaque admin connecté
        const individualCounts = {};

        // On calcule les compteurs pour chaque admin en ligne
        for (const adminId of onlineAdminIds) {
            const userCount = await User.countDocuments({ readByAdmins: { $ne: adminId } });
            const ticketCount = await Ticket.countDocuments({ readByAdmins: { $ne: adminId } });
            const bookingCount = await Booking.countDocuments({ readByAdmins: { $ne: adminId } });
            const reclamationCount = await Reclamation.countDocuments({ readByAdmins: { $ne: adminId } });

            individualCounts[adminId] = {
                users: userCount,
                tickets: ticketCount,
                bookings: bookingCount,
                reclamations: reclamationCount
            };
        }

        console.log("🚀 [Serveur] Envoi des compteurs individuels:", individualCounts);
        await broadcastToAdmins(req, 'notificationCountsUpdated', { individualCounts });

    } catch (error) {
        console.error("❌ Erreur critique lors du calcul des compteurs individuels:", error);
    }
};

module.exports = { broadcastToAdmins, broadcastNotificationCounts };