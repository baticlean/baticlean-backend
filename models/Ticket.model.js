// Fichier : backend/models/Ticket.model.js (Version avec notifications individuelles)
const { Schema, model } = require('mongoose');

const messageSchema = new Schema({
  sender: { 
    type: Schema.Types.ObjectId, 
    ref: 'User',
    default: null
  },
  senderType: {
    type: String,
    enum: ['user', 'admin', 'bot'],
    required: true
  },
  text: {
    type: String,
    required: true,
  }
}, { timestamps: true });

const ticketSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    assignedAdmin: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    subject: {
      type: String,
      default: "Conversation avec l'assistant IA"
    },
    messages: [messageSchema],
    status: {
      type: String,
      enum: ['Ouvert', 'En attente de réponse', 'Pris en charge', 'Fermé'],
      default: 'Ouvert',
    },
    isReadByUser: { type: Boolean, default: true },
    // ✅ MODIFICATION : On remplace "isReadByAdmin" par une liste d'admins
    readByAdmins: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    hiddenForAdmins: [{ type: Schema.Types.ObjectId, ref: 'User' }]
  },
  {
    timestamps: true,
  }
);

module.exports = model('Ticket', ticketSchema);