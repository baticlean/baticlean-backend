// routes/service.routes.js
const express = require('express');
const router = express.Router();
const Service = require('../models/Service.model');

// ROUTE POST /api/services - Pour créer un nouveau service
router.post('/', async (req, res) => {
  try {
    const { title, description, images, price, category } = req.body;

    if (!title || !description || !price || !category) {
      return res.status(400).json({ message: 'Les champs titre, description, prix et catégorie sont requis.' });
    }

    const newService = await Service.create({
      title,
      description,
      images,
      price,
      category,
    });

    res.status(201).json(newService);
  } catch (error) {
    res.status(500).json({ message: 'Erreur interne du serveur.', error });
  }
});

// ROUTE GET /api/services - Pour récupérer tous les services
router.get('/', async (req, res) => {
  try {
    const allServices = await Service.find();
    res.status(200).json(allServices);
  } catch (error) {
    res.status(500).json({ message: 'Erreur interne du serveur.', error });
  }
});

module.exports = router;