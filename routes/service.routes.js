// routes/service.routes.js
const express = require('express');
const router = express.Router();
const Service = require('../models/Service.model');
const { isAuthenticated, isAdmin } = require('../middleware/isAdmin.js');

// ROUTE POST /api/services - Pour créer un nouveau service (protégée)
router.post('/', isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { title, description, images, price, category } = req.body;
    if (!title || !description || !price || !category) {
      return res.status(400).json({ message: 'Tous les champs sont requis.' });
    }
    const newService = await Service.create({ title, description, images, price, category });
    res.status(201).json(newService);
  } catch (error) {
    res.status(500).json({ message: 'Erreur interne du serveur.', error });
  }
});

// ROUTE GET /api/services - Pour récupérer tous les services (publique)
router.get('/', async (req, res) => {
  try {
    const allServices = await Service.find().sort({ createdAt: -1 }); // Trié par plus récent
    res.status(200).json(allServices);
  } catch (error) {
    res.status(500).json({ message: 'Erreur interne du serveur.', error });
  }
});

// NOUVEAU - ROUTE PUT /api/services/:id - Pour modifier un service (protégée)
router.put('/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const updatedService = await Service.findByIdAndUpdate(id, req.body, { new: true });
        if (!updatedService) {
            return res.status(404).json({ message: 'Service non trouvé.' });
        }
        res.status(200).json(updatedService);
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.', error });
    }
});

// NOUVEAU - ROUTE DELETE /api/services/:id - Pour supprimer un service (protégée)
router.delete('/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const deletedService = await Service.findByIdAndDelete(id);
        if (!deletedService) {
            return res.status(404).json({ message: 'Service non trouvé.' });
        }
        res.status(200).json({ message: 'Service supprimé avec succès.' });
    } catch (error) {
        res.status(500).json({ message: 'Erreur interne du serveur.', error });
    }
});

module.exports = router;