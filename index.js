// index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

let onlineUsers = {}; // { userId: socketId }

io.on('connection', (socket) => {
  console.log(`✅ Utilisateur connecté : ${socket.id}`);

  socket.on('addUser', (userId) => {
    onlineUsers[userId] = socket.id;
    console.log(`📥 Utilisateur ${userId} ajouté à la room`);
  });

  socket.on('disconnect', () => {
    for (const userId in onlineUsers) {
      if (onlineUsers[userId] === socket.id) {
        delete onlineUsers[userId];
        break;
      }
    }
    console.log(`❌ Utilisateur déconnecté : ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Injecter io et onlineUsers dans req
app.use((req, res, next) => {
  req.io = io;
  req.onlineUsers = onlineUsers;
  next();
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connexion à MongoDB réussie !'))
  .catch((err) => console.error('❌ Erreur MongoDB :', err));

// Routes
app.get('/', (req, res) => res.send('API BATIClean fonctionnelle ! 🧼'));

app.use('/api', require('./routes/auth.routes.js'));
app.use('/api/services', require('./routes/service.routes.js'));
app.use('/api/admin', require('./routes/admin.routes.js'));
app.use('/api/user', require('./routes/user.routes.js'));
app.use('/api/tickets', require('./routes/ticket.routes.js'));
app.use('/api/bookings', require('./routes/booking.routes.js'));
app.use('/api/reclamations', require('./routes/reclamation.routes.js'));

server.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
});