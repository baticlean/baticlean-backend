const { Schema, model } = require('mongoose');

// On utilise un schéma simple pour les messages du chatbot
const ticketMessageSchema = new Schema({
  sender: {
    type: String,
    enum: ['user', 'bot'], // Le sender est soit 'user', soit 'bot'
    required: true,
  },
  text: {
    type: String,
    required: true,
  }
}, { _id: false, timestamps: true });


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
    readByAdmin: {
        type: Boolean,
        default: false
    }
  },
  {
    timestamps: true,
  }
);

module.exports = model('Ticket', ticketSchema);