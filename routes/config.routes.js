// Fichier: backend/routes/config.routes.js

const express = require('express');
const router = express.Router();

router.get('/forgot-password-status', (req, res) => {
    // Lit la variable d'environnement et la convertit en booléen
    const isMaintenance = process.env.FORGOT_PASSWORD_MAINTENANCE_MODE === 'false';

    // Renvoie le statut au frontend
    res.status(200).json({
        maintenance: isMaintenance
    });
});

module.exports = router;