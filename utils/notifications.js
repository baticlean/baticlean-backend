// Fichier : backend/utils/notifications.js (Version Finale Corrigée)

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
        // --- CORRECTION ET FIABILISATION DES CALCULS ---

        // Le statut "En attente" semble correct pour votre modèle Booking
        const pendingBookings = await Booking.countDocuments({ status: 'En attente' });

        // Pour les tickets, on ne compte que ceux qui ne sont pas lus ET pas déjà résolus
        const unreadTickets = await Ticket.countDocuments({ isReadByAdmin: false, status: { $ne: 'Résolu' } });

        // Pour les réclamations, on vérifie si le champ 'isHandled' existe. S'il n'existe pas, on suppose qu'il n'y a pas de réclamations non traitées.
        const newReclamations = Reclamation.schema.paths['isHandled'] 
            ? await Reclamation.countDocuments({ isHandled: false }) 
            : 0;

        // De même pour les utilisateurs non vérifiés.
        const newUsers = User.schema.paths['isVerified'] 
            ? await User.countDocuments({ isVerified: false }) 
            : 0;

        const counts = {
            tickets: unreadTickets,
            bookings: pendingBookings,
            reclamations: newReclamations,
            users: newUsers
        };

        // "ESPION" CÔTÉ SERVEUR : Affiche l'objet complet qui va être envoyé
        console.log("🚀 [Serveur] Envoi des compteurs mis à jour :", counts);

        await broadcastToAdmins(req, 'notificationCountsUpdated', counts);

    } catch (error) {
        console.error("❌ Erreur lors du calcul et de la diffusion des compteurs:", error);
    }
};

module.exports = { broadcastToAdmins, broadcastNotificationCounts };