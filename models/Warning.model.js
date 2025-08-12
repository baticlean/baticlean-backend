// backend/models/Warning.model.js

const { Schema, model } = require('mongoose');

const warningSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true, // Optimise les recherches par utilisateur
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    // Envoyé par l'admin qui a créé l'avertissement
    sentBy: {
      type: Schema.Types.ObjectId,
      ref: 'User', 
      required: true,
    },
    // L'utilisateur peut avoir plusieurs actions à faire
    actions: [{
      label: String, // ex: "Contacter le support"
      type: {
        type: String, // ex: "contact_support"
        enum: ['contact_support', 'review_profile', 'other'],
      }
    }],
    // On saura si l'utilisateur a cliqué sur "Fermer"
    isDismissed: {
      type: Boolean,
      default: false,
    }
  },
  {
    timestamps: true, // Ajoute automatiquement createdAt et updatedAt
  }
);

const Warning = model('Warning', warningSchema);

module.exports = Warning;