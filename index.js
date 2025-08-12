// backend/index.js

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http');
const helmet = require('helmet');
const { initializeSocket, getIO, getOnlineUsers } = require('./socketManager');

const app = express();
const server = http.createServer(app);

const corsOptions = {
    origin: ['http://localhost:5173', process.env.FRONTEND_URL],
    methods: "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    credentials: true,
    allowedHeaders: "Origin,X-Requested-With,Content-Type,Accept,Authorization"
};

app.use(cors(corsOptions));
app.use(helmet());
app.use(express.json());

const io = initializeSocket(server, corsOptions);
const PORT = process.env.PORT || 3001;

app.get('/favicon.ico', (req, res) => res.status(204).send());
app.get('/ping', (req, res) => res.status(200).send('pong'));

// Middleware pour attacher io et onlineUsers à chaque requête
app.use((req, res, next) => {
    req.io = getIO();
    req.onlineUsers = getOnlineUsers();
    next();
});

// Connexion à la base de données
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ Connexion à MongoDB réussie !'))
    .catch((err) => console.error('❌ Erreur de connexion à MongoDB :', err));

// Routes
app.use('/api', require('./routes/auth.routes.js'));
app.use('/api/user', require('./routes/user.routes.js'));
app.use('/api/services', require('./routes/service.routes.js'));
app.use('/api/admin', require('./routes/admin.routes.js'));
app.use('/api/tickets', require('./routes/ticket.routes.js'));
app.use('/api/bookings', require('./routes/booking.routes.js'));
app.use('/api/reclamations', require('./routes/reclamation.routes.js'));
app.use('/api/notifications', require('./routes/notification.routes.js'));
app.use('/api/config', require('./routes/config.routes.js'));
const { router: maintenanceRouter } = require('./routes/maintenance.routes.js');
app.use('/api/maintenance', maintenanceRouter);

// ✅ On ajoute la nouvelle route pour le chatbot
app.use('/api/chatbot', require('./routes/chatbot.routes.js'));

// Démarrage du serveur
server.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur le port ${PORT}`);
});