// baticlean-backend/models/Service.model.js

const { Schema, model } = require('mongoose');

const commentSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
    text: { type: String, required: true },
    likes: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      default: []
    },

     // ✅ LIGNE À AJOUTER
    parent: { type: Schema.Types.ObjectId, ref: 'Comment', default: null },
  },
  
  { timestamps: true }
);

// Schéma pour chaque avis/notation laissé après une prestation
const reviewSchema = new Schema(
    {
        user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        username: { type: String, required: true },
        profilePicture: { type: String },
        rating: { type: Number, required: true, min: 1, max: 5 },
        comment: { type: String, required: true },
        booking: { type: Schema.Types.ObjectId, ref: 'Booking', required: true }
    },
    { timestamps: true }
);

const serviceSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    images: [{ type: String }],
    price: { type: Number, required: false },
    category: {
      type: String,
      required: true,
      enum: ['Ménage', 'Entretien', 'Maintenance', 'Autre'],
    },
    likes: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      default: []
    },
    comments: {
      type: [commentSchema],
      default: []
    },
    // On ajoute le tableau pour stocker les avis
    reviews: {
      type: [reviewSchema],
      default: []
    }
  },
  { timestamps: true }
);

module.exports = model('Service', serviceSchema);