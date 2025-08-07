// utils/notifications.js
const User = require('../models/User.model');
const Ticket = require('../models/Ticket.model');
const Booking = require('../models/Booking.model');
const Reclamation = require('../models/Reclamation.model');

// Cette fonction calcule tous les compteurs
const getNotificationCounts = async () => {
  const userCount = await User.countDocuments({ isNew: true });
  const ticketCount = await Ticket.countDocuments({ readByAdmin: false });
  const bookingCount = await Booking.countDocuments({ status: 'En attente' });
  const reclamationCount = await Reclamation.countDocuments({ readByAdmin: false });

  return {
    users: userCount,
    tickets: ticketCount,
    bookings: bookingCount,
    reclamations: reclamationCount,
  };
};

// Cette fonction envoie les nouveaux compteurs UNIQUEMENT aux admins en ligne
const broadcastNotificationCountsToAdmins = async (io, onlineUsers) => {
  try {
    const counts = await getNotificationCounts();

    // 1. On récupère les IDs de tous les admins depuis la base de données
    const admins = await User.find({ role: { $in: ['admin', 'superAdmin'] } }).select('_id');
    const adminIds = admins.map(admin => admin._id.toString());

    // 2. On filtre les utilisateurs en ligne pour ne garder que les admins
    const onlineAdminSocketIds = Object.keys(onlineUsers)
      .filter(userId => adminIds.includes(userId))
      .map(userId => onlineUsers[userId]);

    // 3. S'il y a des admins en ligne, on leur envoie la mise à jour
    if (onlineAdminSocketIds.length > 0) {
      io.to(onlineAdminSocketIds).emit('notificationCountsUpdated', counts);
    }
  } catch (error) {
    console.error("Erreur lors de l'envoi des compteurs de notifications:", error);
  }
};

module.exports = { broadcastNotificationCountsToAdmins };