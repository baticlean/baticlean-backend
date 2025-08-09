// baticlean/baticlean-backend/baticlean-backend-42f3c9fe26e8b96f5f88e3569849f459bcc2c933/models/Ticket.model.js
// Fichier : backend/models/Ticket.model.js (Version avec archivage)
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
    readByAdmins: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    hiddenForAdmins: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    // ✅ AJOUT : Champs pour l'archivage
    archivedByUser: { type: Boolean, default: false },
    archivedByAdmin: { type: Boolean, default: false }
  },
  {
    timestamps: true,
  }
);

module.exports = model('Ticket', ticketSchema);