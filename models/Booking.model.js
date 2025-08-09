// baticlean-backend/models/Booking.model.js

const { Schema, model } = require('mongoose');

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
    readByAdmins: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    isReadByUser: {
        type: Boolean,
        default: true
    },
    hiddenForUser: {
        type: Boolean,
        default: false
    },
    hiddenForAdmins: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }],
    // On ajoute le champ pour suivre si un avis a été laissé
    hasBeenReviewed: {
        type: Boolean,
        default: false
    }
  },
  {
    timestamps: true
  }
);

module.exports = model('Booking', bookingSchema);