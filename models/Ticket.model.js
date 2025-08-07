const { Schema, model } = require('mongoose');

// Le schéma pour un message dans la conversation
const messageSchema = new Schema({
  // Le sender peut être un vrai utilisateur (admin ou client) ou null pour le bot
  sender: { 
    type: Schema.Types.ObjectId, 
    ref: 'User',
    default: null // Important pour les messages du bot
  },
  // On garde une trace du type de l'expéditeur
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
    subject: {
      type: String,
      default: "Conversation avec l'assistant IA"
    },
    messages: [messageSchema],
    status: {
      type: String,
      enum: ['Ouvert', 'En attente de réponse', 'Fermé'],
      default: 'Ouvert',
    },
    // Pour les notifications
    isReadByUser: { type: Boolean, default: true },
    isReadByAdmin: { type: Boolean, default: false }
  },
  {
    timestamps: true,
  }
);

module.exports = model('Ticket', ticketSchema);