const { Schema, model } = require('mongoose');

// Un sous-schéma pour suivre l'historique des statuts
const timelineEventSchema = new Schema({
    status: {
        type: String,
        required: true,
        enum: ['En attente', 'Confirmée', 'Terminée', 'Annulée']
    },
    eventDate: {
        type: Date,
        default: Date.now
    }
}, { _id: false });


const bookingSchema = new Schema(
  // --- PREMIER ARGUMENT : La définition des champs ---
  {
    service: {
      type: Schema.Types.ObjectId,
      ref: 'Service', // Assurez-vous d'avoir un modèle 'Service'
      required: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    bookingDate: { type: Date, required: true },
    bookingTime: { type: String, required: true },
    address: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    notes: { type: String },
    status: {
      type: String,
      enum: ['En attente', 'Confirmée', 'Terminée', 'Annulée'],
      default: 'En attente',
    },
    timeline: [timelineEventSchema],
    // --- AJUSTEMENT AJOUTÉ ICI ---
    readByAdmin: {
        type: Boolean,
        default: false
    }
  },
  // --- DEUXIÈME ARGUMENT : Les options du schéma (PLACEMENT CORRECT) ---
  {
    timestamps: true
  }
);

module.exports = model('Booking', bookingSchema);