// Fichier : backend/utils/notifications.js (Version Finale et Complète)

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
        console.log("--- Lancement du calcul des compteurs ---");

        // Calcul 1 : Tickets
        // On compte les tickets non lus par un admin et qui ne sont pas "Résolu"
        const unreadTickets = await Ticket.countDocuments({ isReadByAdmin: false, status: { $ne: 'Résolu' } });
        console.log(`-> Compteur Tickets trouvé : ${unreadTickets}`);

        // Calcul 2 : Réservations
        // On compte les réservations avec le statut "En attente"
        const pendingBookings = await Booking.countDocuments({ status: 'En attente' });
        console.log(`-> Compteur Réservations trouvé : ${pendingBookings}`);

        // Calcul 3 : Réclamations
        // On compte les réclamations qui n'ont pas encore été traitées
        const newReclamations = await Reclamation.countDocuments({ isHandled: false });
        console.log(`-> Compteur Réclamations trouvé : ${newReclamations}`);

        // Calcul 4 : Nouveaux Utilisateurs
        // On compte les utilisateurs qui ne sont pas encore vérifiés
        const newUsers = await User.countDocuments({ isVerified: false });
        console.log(`-> Compteur Utilisateurs trouvé : ${newUsers}`);

        const counts = {
            tickets: unreadTickets,
            bookings: pendingBookings,
            reclamations: newReclamations,
            users: newUsers
        };

        console.log("🚀 [Serveur] Envoi de l'objet de compteurs complet :", counts);
        await broadcastToAdmins(req, 'notificationCountsUpdated', counts);

    } catch (error) {
        console.error("❌ Erreur critique lors du calcul des compteurs:", error);
    }
};

module.exports = { broadcastToAdmins, broadcastNotificationCounts };