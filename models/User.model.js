 // Fichier : backend/models/User.model.js (Corrigé)

const { Schema, model } = require('mongoose');



const userSchema = new Schema(

  {

    username: { type: String, required: true, trim: true },

    email: { type: String, required: true, unique: true, lowercase: true, trim: true },

    phoneNumber: { type: String, required: true, unique: true, trim: true },

    passwordHash: { type: String, required: true },

   

    // ✅ AJOUT DES CHAMPS MANQUANTS

    passwordResetToken: String,

    passwordResetExpires: Date,

   

    profilePicture: {

      type: String,

      default: 'https://pixabay.com/fr/vectors/profil-utilisateur-linternet-homme-42914/',

    },

    role: { type: String, enum: ['user', 'admin', 'superAdmin'], default: 'user' },

    status: { type: String, enum: ['active', 'suspended', 'banned'], default: 'active' },

    readByAdmins: [{ type: Schema.Types.ObjectId, ref: 'User' }]

  },

  { timestamps: true }

);



module.exports = model('User', userSchema);