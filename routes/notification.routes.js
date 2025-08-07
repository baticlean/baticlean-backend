const express = require('express');
const router = express.Router();
const { isAuthenticated, isAdmin } = require('../middleware/isAdmin.js');

// On importe les modèles de données nécessaires
const User = require('../models/User.model');
const Ticket = require('../models/Ticket.model');
const Booking = require('../models/Booking.model'); // Assurez-vous que ce modèle existe et est importé
const Reclamation = require('../models/Reclamation.model');

// ROUTE 1 : Compter les nouvelles notifications en utilisant les bons statuts
router.get('/counts', isAuthenticated, isAdmin, async (req, res) => {
  try {
    // Pour les utilisateurs, on va compter ceux créés dans les dernières 24h comme "nouveaux"
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const userCount = await User.countDocuments({ role: 'user', createdAt: { $gte: twentyFourHoursAgo } });

    // Pour les tickets, on compte ceux qui sont 'Ouvert'
    const ticketCount = await Ticket.countDocuments({ status: 'Ouvert' });

    // Pour les réservations, on suppose qu'un nouveau booking a le statut 'En attente'
    // Adaptez si le statut par défaut est différent dans votre Booking.model.js
    const bookingCount = await Booking.countDocuments({ status: 'En attente' });

    // Pour les réclamations, on compte celles qui sont 'Nouvelle'
    const reclamationCount = await Reclamation.countDocuments({ status: 'Nouvelle' });

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


// ROUTE 2 : Marquer les notifications comme lues (Route "factice")
// Cette route ne modifie pas la base de données car il n'y a pas de champ 'isRead'.
// Son seul but est de répondre au frontend avec un succès 200 pour éviter les erreurs 404.
router.patch('/:type/mark-as-read', isAuthenticated, isAdmin, async (req, res) => {
    const { type } = req.params;

    // On ne fait aucune opération en base de données.
    // On renvoie simplement un message de succès pour que le frontend soit satisfait.
    console.log(`[Notification] 'mark-as-read' a été appelé pour le type '${type}'. Aucune action effectuée.`);

    res.status(200).json({ message: `Requête 'mark-as-read' pour '${type}' reçue avec succès.` });
});

module.exports = router;
