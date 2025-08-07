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
      default: 'https://i.pravatar.cc/150?u=a042581f4e29026704d', // Une image par défaut
    },
    role: { type: String, enum: ['user', 'admin', 'superAdmin'], default: 'user' },
    status: { type: String, enum: ['active', 'suspended', 'banned'], default: 'active' }
  },
  { timestamps: true }
);

module.exports = model('User', userSchema);