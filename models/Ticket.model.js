// baticlean-backend/models/Ticket.model.js

const { Schema, model } = require('mongoose');

const attachmentSchema = new Schema({
  url: { type: String, required: true },
  fileName: { type: String, required: true },
  fileType: { type: String, required: true },
}, { _id: false });

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
  },
  attachments: [attachmentSchema],
  // ✅ NOUVEAU : On ajoute un champ pour savoir qui a lu le message
  // Ce sera un tableau contenant l'ID de l'utilisateur qui a lu.
  readBy: [{
      type: Schema.Types.ObjectId,
      ref: 'User'
  }]
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
    archivedByUser: { type: Boolean, default: false },
    archivedByAdmin: { type: Boolean, default: false }
  },
  {
    timestamps: true,
  }
);

module.exports = model('Ticket', ticketSchema);