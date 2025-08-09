// baticlean-backend/routes/maintenance.routes.js

const express = require('express');
const router = express.Router();
const Maintenance = require('../models/Maintenance.model');
const { isAuthenticated, isSuperAdmin } = require('../middleware/isAdmin.js');

// Route pour obtenir le statut de toutes les pages (pour le panel SuperAdmin)
router.get('/status', isAuthenticated, isSuperAdmin, async (req, res) => {
    try {
        const statuses = await Maintenance.find({});
        res.status(200).json(statuses);
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

// Route pour activer/désactiver la maintenance d'une page (uniquement SuperAdmin)
router.patch('/toggle/:pageKey', isAuthenticated, isSuperAdmin, async (req, res) => {
    try {
        const { pageKey } = req.params;
        const page = await Maintenance.findOne({ pageKey });

        if (!page) {
            return res.status(404).json({ message: 'Page non trouvée.' });
        }

        // On inverse l'état actuel
        page.isUnderMaintenance = !page.isUnderMaintenance;
        await page.save();

        // On informe tous les clients via WebSocket que l'état a changé
        req.io.emit('maintenanceStatusChanged', page);

        res.status(200).json(page);
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

// Middleware réutilisable pour vérifier la maintenance
const checkMaintenance = (pageKey) => {
    return async (req, res, next) => {
        try {
            const page = await Maintenance.findOne({ pageKey });
            if (page && page.isUnderMaintenance) {
                // Si la maintenance est active, on bloque la requête
                return res.status(503).json({ message: 'Cette fonctionnalité est actuellement en maintenance.' });
            }
            // Sinon, on laisse la requête continuer
            next();
        } catch (error) {
            // En cas d'erreur, par sécurité, on continue la requête
            next();
        }
    };
};

module.exports = { router, checkMaintenance };