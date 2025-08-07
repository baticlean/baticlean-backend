const { Schema, model } = require('mongoose');

// Sous-schéma pour les pièces jointes
const attachmentSchema = new Schema({
    url: { type: String, required: true },
    fileName: { type: String, required: true },
    fileType: { type: String, required: true }
}, { _id: false });

// Sous-schéma pour les réactions emoji
const reactionSchema = new Schema({
    emoji: { type: String, required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true }
}, { _id: false });

// Sous-schéma pour les messages de la conversation
const messageSchema = new Schema({
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, default: '' },
    attachments: [attachmentSchema],
    reactions: [reactionSchema],
    isRead: { type: Boolean, default: false },
    isEdited: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

const ticketSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // On ajoute un admin assigné pour les notifications ciblées
    assignedAdmin: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    subject: { type: String, required: true },
    messages: [messageSchema],
    status: {
      type: String,
      enum: ['Ouvert', 'En attente de réponse', 'Fermé'],
      default: 'Ouvert',
    },
    // Pour savoir si l'utilisateur ou l'admin a lu la dernière réponse
    isReadByUser: { type: Boolean, default: true },
    isReadByAdmin: { type: Boolean, default: false }
  },
  { timestamps: true }
);

module.exports = model('Ticket', ticketSchema);