// models/User.model.js
const { Schema, model } = require('mongoose');

const userSchema = new Schema(
  {
    username: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // On ajoute le numéro de téléphone
    phoneNumber: { type: String, required: true, unique: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin', 'superAdmin'], default: 'user' },
    status: { type: String, enum: ['active', 'suspended', 'banned'], default: 'active' }
  },
  { timestamps: true }
);

module.exports = model('User', userSchema);