// models/Booking.model.js
const { Schema, model } = require('mongoose');

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
    bookingDate: {
      type: Date,
      required: true,
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
  },
  {
    timestamps: true,
  }
);

module.exports = model('Booking', bookingSchema);