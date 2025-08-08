// Fichier : backend/models/Reclamation.model.js (Version avec notifications individuelles)
const { Schema, model } = require('mongoose');

const reclamationSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    screenshots: [
      {
        type: String, 
      },
    ],
    status: {
      type: String,
      enum: ['Nouvelle', 'En cours', 'Résolue'],
      default: 'Nouvelle',
    },
    // ✅ MODIFICATION : On remplace "readByAdmin" par une liste d'admins
    readByAdmins: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    hiddenForAdmins: [{ type: Schema.Types.ObjectId, ref: 'User' }]
  },
  {
    timestamps: true,
  }
);

module.exports = model('Reclamation', reclamationSchema);