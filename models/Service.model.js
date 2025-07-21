// models/Service.model.js
const { Schema, model } = require('mongoose');

const commentSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    username: { // Pour afficher le nom sans faire de recherche supplémentaire
      type: String,
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const serviceSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    images: [{ type: String }],
    price: { type: Number, required: true },
    category: {
      type: String,
      required: true,
      enum: ['Ménage', 'Entretien', 'Maintenance', 'Autre'],
    },
    // --- NOUVEAUX CHAMPS ---
    likes: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    comments: [commentSchema],
  },
  { timestamps: true }
);

module.exports = model('Service', serviceSchema);