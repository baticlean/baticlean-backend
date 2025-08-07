const { Schema, model } = require('mongoose');

// Petit schéma pour garder une trace des changements de statut
const timelineEventSchema = new Schema({
  status: {
    type: String,
    required: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });


const bookingSchema = new Schema(
  {
    service: {
      type: Schema.Types.ObjectId,
      ref: 'Service',
      required: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Nouveaux champs pour le formulaire complet
    address: {
      type: String,
      required: [true, "L'adresse est requise."],
      trim: true,
    },
    phoneNumber: {
        type: String,
        required: [true, "Le numéro de téléphone est requis."],
        trim: true,
    },
    bookingDate: {
      type: Date,
      required: true,
    },
    bookingTime: {
        type: String,
        required: [true, "L'heure est requise."],
    },
    status: {
      type: String,
      enum: ['En attente', 'Confirmée', 'Terminée', 'Annulée'],
      default: 'En attente',
    },
    notes: {
      type: String,
      trim: true,
    },
    // Nouvelle timeline pour le suivi
    timeline: {
        type: [timelineEventSchema],
        default: [{ status: 'En attente' }]
    },
    readByClient: { // Pour le compteur de notifications
        type: Boolean,
        default: false
    },
    readByAdmin: {
      type: Boolean,
      default: false 
  },
  {
    timestamps: true,
  }
);

module.exports = model('Booking', bookingSchema);