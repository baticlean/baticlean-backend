// index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const Service = require('./models/Service.model'); // Importer le modèle Service

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(async () => { // On rend la fonction asynchrone
    console.log('✅ Connexion à MongoDB réussie !');

    // --- NOTRE DÉTECTIVE ---
    // On vérifie si un service de test existe, sinon on le crée
    const testService = await Service.findOne({ title: "--- SERVICE DE TEST ---" });
    if (!testService) {
      console.log("Le service de test n'existe pas, création...");
      await Service.create({
        title: "--- SERVICE DE TEST ---",
        description: "Si vous voyez ce service, c'est que le backend est bien connecté à CETTE base de données.",
        price: 999,
        category: "Autre",
        images: []
      });
      console.log(">>> Service de test créé avec succès ! <<<");
    } else {
      console.log("Le service de test existe déjà.");
    }
    // --------------------

  })
  .catch((err) => {
    console.error('❌ Erreur de connexion à MongoDB :', err);
  });

app.get('/', (req, res) => {
  res.send('Bienvenue sur l\'API de BATIClean ! 🧼');
});

app.use('/api', require('./routes/auth.routes.js'));
app.use('/api/services', require('./routes/service.routes.js'));
app.use('/api/admin', require('./routes/admin.routes.js'));

app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
});