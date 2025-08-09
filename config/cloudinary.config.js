// baticlean-backend/config/cloudinary.config.js

const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    // ✅ ON AJOUTE LES FORMATS AUDIO ICI
    allowed_formats: ['jpg', 'png', 'pdf', 'zip', 'doc', 'docx', 'mp3', 'webm', 'ogg', 'm4a'],
    folder: 'ticket-attachments',
    resource_type: 'auto',
  }
});

module.exports = multer({ storage });