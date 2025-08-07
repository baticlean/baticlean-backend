const { Schema, model } = require('mongoose');

const userSchema = new Schema(
  {
    username: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phoneNumber: { type: String, required: true, unique: true, trim: true },
    passwordHash: { type: String, required: true },
    profilePicture: {
      type: String,
      default: 'https://pixabay.com/fr/vectors/profil-utilisateur-linternet-homme-42914/', // Une image par défaut
    },
    role: { type: String, enum: ['user', 'admin', 'superAdmin'], default: 'user' },
    status: { type: String, enum: ['active', 'suspended', 'banned'], default: 'active' },
    // --- CHAMP AJOUTÉ ---
    // Ce champ nous permettra de savoir si l'utilisateur est "nouveau" pour les notifications.
    isNew: {
        type: Boolean,
        default: true
    }
  },
  { timestamps: true }
);

module.exports = model('User', userSchema);