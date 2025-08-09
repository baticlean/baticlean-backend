// Fichier : backend/index.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http');
const helmet = require('helmet');
const { initializeSocket, getIO, getOnlineUsers } = require('./socketManager');

const app = express();
const server = http.createServer(app);

// ====================================================================
// ✅ DÉBUT DE L'AJOUT
// On crée dynamiquement la liste des origines autorisées à partir du .env
// ====================================================================
const allowedOrigins = [];
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}
// ====================================================================
// ✅ FIN DE L'AJOUT
// ====================================================================

const corsOptions = {
    origin: allowedOrigins, // Utilise maintenant la liste créée dynamiquement
    methods: "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    credentials: true,
    allowedHeaders: "Origin,X-Requested-With,Content-Type,Accept,Authorization"
};

app.use(cors(corsOptions));

// Initialise Socket.IO via le manager
const io = initializeSocket(server, corsOptions);

const PORT = process.env.PORT || 3001;

app.use(express.json());

app.get('/favicon.ico', (req, res) => res.status(204).send());
app.get('/ping', (req, res) => res.status(200).send('pong'));

// Middleware pour attacher io et onlineUsers à chaque requête
app.use((req, res, next) => {
    req.io = getIO();
    req.onlineUsers = getOnlineUsers();
    next();
});

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ Connexion à MongoDB réussie !'))
    .catch((err) => console.error('❌ Erreur de connexion à MongoDB :', err));

// Routes (pas de changement ici)
app.use('/api', require('./routes/auth.routes.js'));
app.use('/api/user', require('./routes/user.routes.js'));
app.use('/api/services', require('./routes/service.routes.js'));
app.use('/api/admin', require('./routes/admin.routes.js'));
app.use('/api/tickets', require('./routes/ticket.routes.js'));
app.use('/api/bookings', require('./routes/booking.routes.js'));
app.use('/api/reclamations', require('./routes/reclamation.routes.js'));
app.use('/api/notifications', require('./routes/notification.routes.js'));
app.use('/api/config', require('./routes/config.routes.js'));

// NOUVEAU : On ajoute les routes de maintenance
const { router: maintenanceRouter } = require('./routes/maintenance.routes.js');
app.use('/api/maintenance', maintenanceRouter);

server.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur le port ${PORT}`);
});