// Fichier : backend/models/User.model.js (Version avec notifications individuelles)
const { Schema, model } = require('mongoose');

const userSchema = new Schema(
  {
    username: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phoneNumber: { type: String, required: true, unique: true, trim: true },
    passwordHash: { type: String, required: true },
    profilePicture: {
      type: String,
      default: 'https://pixabay.com/fr/vectors/profil-utilisateur-linternet-homme-42914/',
    },
    role: { type: String, enum: ['user', 'admin', 'superAdmin'], default: 'user' },
    status: { type: String, enum: ['active', 'suspended', 'banned'], default: 'active' },
    // ✅ MODIFICATION : On remplace "isNew" par une liste d'admins.
    // Un utilisateur est "nouveau" pour un admin si l'ID de l'admin n'est pas dans cette liste.
    readByAdmins: [{ type: Schema.Types.ObjectId, ref: 'User' }]
  },
  { timestamps: true }
);

module.exports = model('User', userSchema);