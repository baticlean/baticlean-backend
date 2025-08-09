// baticlean-backend/models/Ticket.model.js

const { Schema, model } = require('mongoose');

// NOUVEAU : Schéma pour les pièces jointes
const attachmentSchema = new Schema({
  url: { type: String, required: true }, // L'URL du fichier sur Cloudinary
  fileName: { type: String, required: true }, // Le nom original du fichier
  fileType: { type: String, required: true }, // Le type MIME (ex: 'image/png')
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
    // Le texte n'est plus requis, on peut envoyer juste des fichiers
  },
  // NOUVEAU : On ajoute le champ pour les pièces jointes
  attachments: [attachmentSchema]
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