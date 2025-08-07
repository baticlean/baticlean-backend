const express = require('express');
const router = express.Router();
const { isAuthenticated, isAdmin } = require('../middleware/isAdmin.js');

// Importe tes modèles de données
const User = require('../models/User.model');
const Ticket = require('../models/Ticket.model'); // Assure-toi que le chemin est correct
const Booking = require('../models/Booking.model'); // Assure-toi que le chemin est correct
const Reclamation = require('../models/Reclamation.model'); // Assure-toi que le chemin est correct

// GET /api/notifications/counts
// Cette route calcule le nombre de nouvelles notifications pour l'admin.
router.get('/counts', isAuthenticated, isAdmin, async (req, res) => {
  try {
    // Compte les nouveaux utilisateurs (si tu as un champ comme 'isVerified' ou 'status')
    // Pour cet exemple, on suppose que tu veux voir les utilisateurs non vérifiés.
    // Adapte la condition à ta logique. Ici, on va compter tous les utilisateurs pour l'exemple.
    const userCount = await User.countDocuments({ role: 'user' }); // Exemple simple

    // Compte les tickets en attente (adapte le statut si besoin)
    const ticketCount = await Ticket.countDocuments({ status: 'pending' });

    // Compte les réservations en attente
    const bookingCount = await Booking.countDocuments({ status: 'pending' });

    // Compte les réclamations non lues
    const reclamationCount = await Reclamation.countDocuments({ isRead: false });

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

module.exports = router;
