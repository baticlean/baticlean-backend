// models/Reclamation.model.js

const { Schema, model } = require('mongoose');

const reclamationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, required: true, trim: true },
    screenshots: [{ type: String }],
    status: {
      type: String,
      enum: ['Nouvelle', 'En cours', 'Résolue'],
      default: 'Nouvelle',
    },
    // --- CHAMP AJOUTÉ ---
    // Ce champ nous permettra de savoir si l'admin a vu la réclamation.
    readByAdmin: {
        type: Boolean,
        default: false // Par défaut, une nouvelle réclamation n'est pas lue.
    }
  },
  { timestamps: true }
);

module.exports = model('Reclamation', reclamationSchema);