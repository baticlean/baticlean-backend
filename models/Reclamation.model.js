// models/Reclamation.model.js
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
  },
  {
    timestamps: true,
  }
);

module.exports = model('Reclamation', reclamationSchema);