// index.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares (outils pour notre serveur)
app.use(cors());
app.use(express.json());

// Connexion à MongoDB en utilisant la clé secrète
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ Connexion à MongoDB réussie !');
  })
  .catch((err) => {
    console.error('❌ Erreur de connexion à MongoDB :', err);
  });

// Route de test simple
app.get('/', (req, res) => {
  res.send('Bienvenue sur l\'API de BATIClean ! 🧼');
});

// On dit au serveur d'utiliser les futurs fichiers de routes
// pour toutes les adresses qui commenceront par /api
app.use('/api', require('./routes/auth.routes.js'));
app.use('/api', require('./routes/auth.routes.js'));
app.use('/api/services', require('./routes/service.routes.js')); // <<< AJOUTEZ CETTE LIGNE

app.use('/api/services', require('./routes/service.routes.js'));
app.use('/api/admin', require('./routes/admin.routes.js')); // <<< AJOUTEZ CETTE LIGNE


// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
});