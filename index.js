// index.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

// --- CORRECTION CORS ---
const corsOptions = {
  // Remplace 'https://ton-frontend-en-production.com' par l'URL de ton site en ligne
  origin: ['http://localhost:5173', 'https://ton-frontend-en-production.com'],
  methods: "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  credentials: true,
  allowedHeaders: "Origin,X-Requested-With,Content-Type,Accept,Authorization"
};

app.use(cors(corsOptions));

const io = new Server(server, {
  cors: corsOptions
});

let onlineUsers = {};

io.on("connection", (socket) => {
  socket.on("addUser", (userId) => { onlineUsers[userId] = socket.id; });
  socket.on("disconnect", () => {
    for (const userId in onlineUsers) {
      if (onlineUsers[userId] === socket.id) {
        delete onlineUsers[userId];
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3001;

app.use(express.json());

// --- CORRECTION FAVICON ---
app.get('/favicon.ico', (req, res) => res.status(204).send());

// --- AJOUT DE LA ROUTE POUR LE CRON-JOB ---
app.get('/ping', (req, res) => {
  res.status(200).send('pong');
});

app.use((req, res, next) => {
  req.io = io;
  req.onlineUsers = onlineUsers;
  next();
});

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

server.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
});