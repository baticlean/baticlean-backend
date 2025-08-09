// baticlean-backend/config/cloudinary.config.js

const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// On configure Cloudinary avec les clés secrètes du fichier .env
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// On configure le stockage sur Cloudinary
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    allowed_formats: ['jpg', 'png', 'pdf', 'zip', 'doc', 'docx'], // Formats autorisés
    folder: 'ticket-attachments', // Le nom du dossier sur Cloudinary où les fichiers seront stockés
    resource_type: 'auto', // Permet à Cloudinary de détecter automatiquement le type de fichier
  }
});

// On exporte l'outil (middleware) qui va gérer l'upload des fichiers
module.exports = multer({ storage });