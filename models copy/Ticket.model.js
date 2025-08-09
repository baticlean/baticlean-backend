// baticlean-backend/models/Ticket.model.js

const { Schema, model } = require('mongoose');

// Schéma pour les pièces jointes (images, pdf, etc.)
const attachmentSchema = new Schema({
  url: { type: String, required: true },
  fileName: { type: String, required: true },
  fileType: { type: String, required: true },
}, { _id: false });

// Schéma pour les réactions emoji
const reactionSchema = new Schema({
    emoji: { type: String, required: true },
    users: [{ type: Schema.Types.ObjectId, ref: 'User' }]
}, { _id: false });

// Schéma pour chaque message individuel
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
  readBy: [{
      type: Schema.Types.ObjectId,
      ref: 'User'
  }],
  isEdited: {
    type: Boolean,
    default: false
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  // On ajoute le champ pour les emojis ici
  reactions: [reactionSchema]
}, { timestamps: true });

// Schéma principal pour un ticket (une conversation)
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