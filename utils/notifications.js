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

// Cette fonction envoie les nouveaux compteurs à tous les clients via socket
const broadcastNotificationCounts = async (io) => {
  try {
    const counts = await getNotificationCounts();
    io.emit('notificationCountsUpdated', counts);
  } catch (error) {
    console.error("Erreur lors de l'envoi des compteurs de notifications:", error);
  }
};

module.exports = { broadcastNotificationCounts };