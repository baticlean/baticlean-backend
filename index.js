// index.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const corsOptions = {
  origin: ['http://localhost:5173', 'https://votre-site-en-production.com'], 
  methods: "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  credentials: true,
  allowedHeaders: "Origin,X-Requested-With,Content-Type,Accept,Authorization"
};

app.use(cors(corsOptions));

const io = new Server(server, {
  cors: corsOptions
});

// --- GESTION DES UTILISATEURS EN TEMPS RÉEL ---
let onlineUsers = {};
let bannedSockets = {}; // <-- NOUVEAU : La mémoire des navigateurs bannis

io.on("connection", (socket) => {
  console.log(`[SERVEUR] Client connecté : ${socket.id}`);

  socket.on("addUser", (userId) => {
    onlineUsers[userId] = socket.id;
    // Si ce navigateur était listé comme banni, on nettoie, car l'utilisateur est actif
    Object.keys(bannedSockets).forEach(key => {
        if (bannedSockets[key] === socket.id) {
            delete bannedSockets[key];
        }
    });
    console.log("Utilisateurs en ligne:", onlineUsers);
  });

  socket.on("disconnect", () => {
    console.log(`[SERVEUR] Client déconnecté : ${socket.id}`);
    // On nettoie les deux listes lors de la déconnexion
    for (const userId in onlineUsers) {
      if (onlineUsers[userId] === socket.id) delete onlineUsers[userId];
    }
    for (const userId in bannedSockets) {
      if (bannedSockets[userId] === socket.id) delete bannedSockets[userId];
    }
    console.log("Utilisateurs en ligne après déconnexion:", onlineUsers);
  });
});

const PORT = process.env.PORT || 3001;

app.use(express.json());
app.get('/favicon.ico', (req, res) => res.status(204).send());

// --- MIDDLEWARE ---
// On passe io et les listes d'utilisateurs à toutes les routes
app.use((req, res, next) => {
  req.io = io;
  req.onlineUsers = onlineUsers;
  req.bannedSockets = bannedSockets; // <-- NOUVEAU
  next();
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connexion à MongoDB réussie !'))
  .catch((err) => console.error('❌ Erreur de connexion à MongoDB :', err));

// --- ROUTES ---
app.use('/api', require('./routes/auth.routes.js'));
app.use('/api/user', require('./routes/user.routes.js'));
app.use('/api/services', require('./routes/service.routes.js'));
app.use('/api/admin', require('./routes/admin.routes.js'));
app.use('/api/tickets', require('./routes/ticket.routes.js'));
app.use('/api/bookings', require('./routes/booking.routes.js'));
app.use('/api/reclamations', require('./routes/reclamation.routes.js'));

server.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
});