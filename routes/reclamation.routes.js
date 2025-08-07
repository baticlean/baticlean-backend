const express = require('express');
const router = express.Router();
const Reclamation = require('../models/Reclamation.model');
const { isAuthenticated, isAdmin } = require('../middleware/isAdmin.js');
const { broadcastNotificationCountsToAdmins } = require('../utils/notifications.js');

router.post('/', isAuthenticated, async (req, res) => {
  try {
    const { message, screenshots } = req.body;
    const userId = req.auth._id;
    if (!message) {
      return res.status(400).json({ message: 'Le message ne peut pas être vide.' });
    }
    const newReclamation = await Reclamation.create({ user: userId, message, screenshots });

    req.io.emit('newReclamation', newReclamation);
    broadcastNotificationCountsToAdmins(req.io, req.onlineUsers);
    res.status(201).json(newReclamation);
  } catch (error) {
    res.status(500).json({ message: 'Erreur interne du serveur.' });
  }
});

router.get('/', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const reclamations = await Reclamation.find({ hiddenForAdmins: { $ne: req.auth._id } })
            .populate('user', 'username email status')
            .sort({ createdAt: -1 });
        res.status(200).json(reclamations);
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

router.patch('/:reclamationId/hide', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { reclamationId } = req.params;
        const adminId = req.auth._id;
        const updatedReclamation = await Reclamation.findByIdAndUpdate(
            reclamationId,
            { $addToSet: { hiddenForAdmins: adminId } },
            { new: true }
        );
        if (!updatedReclamation) {
            return res.status(404).json({ message: 'Réclamation non trouvée.' });
        }
        req.io.to(req.onlineUsers[adminId]).emit('reclamationHidden', { _id: reclamationId });
        res.status(200).json({ message: 'Réclamation masquée avec succès.' });
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

module.exports = router;