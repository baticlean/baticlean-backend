// models/Service.model.js
const { Schema, model } = require('mongoose');

const serviceSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    images: [
      {
        type: String, // On stockera les URLs des images
      },
    ],
    price: {
      type: Number,
      required: true,
    },
    category: {
      type: String,
      required: true,
      enum: ['Ménage', 'Entretien', 'Maintenance', 'Autre'], // Catégories possibles
    },
  },
  {
    timestamps: true,
  }
);

module.exports = model('Service', serviceSchema);