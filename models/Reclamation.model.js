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
        type: String, // URLs des images depuis Cloudinary
      },
    ],
    status: {
      type: String,
      enum: ['Nouvelle', 'En cours', 'Résolue'],
      default: 'Nouvelle',
    },
    readByAdmin: {
        type: Boolean,
        default: false
    },
    // --- CHAMP AJOUTÉ ---
    hiddenForAdmins: [{ type: Schema.Types.ObjectId, ref: 'User' }]
  },
  {
    timestamps: true,
  }
);

module.exports = model('Reclamation', reclamationSchema);