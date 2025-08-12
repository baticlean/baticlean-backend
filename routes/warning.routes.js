// backend/routes/warning.routes.js

const express = require('express');
const router = express.Router();
const Warning = require('../models/Warning.model');
const { isAuthenticated } = require('../middleware/isAdmin.js');

// Route pour récupérer les avertissements non lus de l'utilisateur connecté
router.get('/my-warnings', isAuthenticated, async (req, res) => {
  try {
    const userId = req.auth._id;

    // On cherche tous les avertissements pour cet utilisateur qui ne sont pas encore "fermés"
    const warnings = await Warning.find({ user: userId, isDismissed: false })
      .sort({ createdAt: -1 }) // Du plus récent au plus ancien
      .populate('sentBy', 'username'); // Pour savoir quel admin l'a envoyé

    res.status(200).json(warnings);
  } catch (error) {
    console.error("Erreur lors de la récupération des avertissements:", error);
    res.status(500).json({ message: "Erreur interne du serveur." });
  }
});

// Route pour "fermer" un avertissement
router.patch('/:warningId/dismiss', isAuthenticated, async (req, res) => {
  try {
    const { warningId } = req.params;
    const userId = req.auth._id;

    // On cherche l'avertissement par son ID ET on vérifie qu'il appartient bien à l'utilisateur connecté
    // C'est une sécurité pour empêcher un utilisateur de fermer les avertissements d'un autre
    const warning = await Warning.findOneAndUpdate(
      { _id: warningId, user: userId },
      { isDismissed: true },
      { new: true }
    );

    if (!warning) {
      return res.status(404).json({ message: "Avertissement non trouvé ou action non autorisée." });
    }

    res.status(200).json({ message: "Avertissement fermé avec succès." });
  } catch (error) {
    console.error("Erreur lors de la fermeture de l'avertissement:", error);
    res.status(500).json({ message: "Erreur interne du serveur." });
  }
});

module.exports = router;