// models/Service.model.js
const { Schema, model } = require('mongoose');

const commentSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
    text: { type: String, required: true },
    // On s'assure que le tableau de likes existe toujours
    likes: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      default: []
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
    likes: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      default: []
    },
    comments: {
      type: [commentSchema],
      default: []
    },
  },
  { timestamps: true }
);

module.exports = model('Service', serviceSchema);