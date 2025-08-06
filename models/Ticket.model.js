// models/Ticket.model.js
const { Schema, model } = require('mongoose');

const ticketMessageSchema = new Schema({
  sender: {
    type: String,
    enum: ['user', 'bot'],
    required: true,
  },
  text: {
    type: String,
    required: true,
  }
}, { _id: false });

const ticketSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    subject: {
      type: String,
      default: "Conversation avec l'assistant IA"
    },
    messages: [ticketMessageSchema],
    status: {
      type: String,
      enum: ['Ouvert', 'En cours', 'Fermé'],
      default: 'Ouvert',
    },
    // À ajouter dans chaque schéma (User, Ticket, Booking, Reclamation)
    readByAdmin: {
      type: Boolean,
      default: false // Par défaut, une nouvelle entrée n'est pas lue
    }
  },


  {
    timestamps: true,
  }
);

module.exports = model('Ticket', ticketSchema);