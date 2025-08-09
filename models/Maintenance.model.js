// baticlean-backend/models/Maintenance.model.js

const { Schema, model } = require('mongoose');

const maintenanceSchema = new Schema({
  // Un identifiant unique pour chaque page, ex: "forgot-password"
  pageKey: {
    type: String,
    required: true,
    unique: true,
  },
  // Le nom de la page affiché dans le panel admin, ex: "Mot de Passe Oublié"
  pageName: {
    type: String,
    required: true,
  },
  // Un simple booléen pour savoir si la maintenance est active ou non
  isUnderMaintenance: {
    type: Boolean,
    default: false,
  },
});

module.exports = model('Maintenance', maintenanceSchema);