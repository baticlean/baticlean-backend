// models/User.model.js
const { Schema, model } = require('mongoose');

const userSchema = new Schema(
  {
    username: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phoneNumber: { type: String, required: true, unique: true, trim: true },
    passwordHash: { type: String, required: true },
    // --- NOUVEAU CHAMP ---
    profilePicture: {
      type: String,
      default: 'https://cdn.pixabay.com/photo/2012/04/26/19/43/profile-42914_1280.png', // Une image par défaut
    },
    role: { type: String, enum: ['user', 'admin', 'superAdmin'], default: 'user' },
    status: { type: String, enum: ['active', 'suspended', 'banned'], default: 'active' }
  },
  { timestamps: true }
);

module.exports = model('User', userSchema);