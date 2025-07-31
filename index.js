// index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http'); // Module natif de Node.js
const { Server } = require("socket.io"); // La bibliothèque Socket.IO

const app = express();
const server = http.createServer(app); // On crée un serveur HTTP qui utilise Express

const io = new Server(server, {
  cors: {
    origin: "*", // Autorise toutes les origines pour le WebSocket
    methods: ["GET", "POST"]
  }
});

let onlineUsers = {}; // Pour stocker les utilisateurs connectés { userId: socketId }

io.on("connection", (socket) => {
  console.log(`Un utilisateur s'est connecté: ${socket.id}`);

  // Quand un utilisateur se connecte, il envoie son ID
  socket.on("addUser", (userId) => {
    onlineUsers[userId] = socket.id;
    console.log("Utilisateurs en ligne:", onlineUsers);
  });

  socket.on("disconnect", () => {
    // Nettoie l'utilisateur à la déconnexion
    for (const userId in onlineUsers) {
      if (onlineUsers[userId] === socket.id) {
        delete onlineUsers[userId];
        break;
      }
    }
    console.log(`Un utilisateur s'est déconnecté: ${socket.id}`);
    console.log("Utilisateurs en ligne:", onlineUsers);
  });
});


const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// On passe 'io' et 'onlineUsers' à toutes les requêtes pour pouvoir les utiliser dans les routes
app.use((req, res, next) => {
  req.io = io;
  req.onlineUsers = onlineUsers;
  next();
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connexion à MongoDB réussie !'))
  .catch((err) => console.error('❌ Erreur de connexion à MongoDB :', err));


app.get('/', (req, res) => res.send('API BATIClean fonctionnelle ! 🧼'));

// Routes
app.use('/api', require('./routes/auth.routes.js'));
app.use('/api/services', require('./routes/service.routes.js'));
app.use('/api/admin', require('./routes/admin.routes.js'));
app.use('/api/user', require('./routes/user.routes.js')); // <<< AJOUTEZ CETTE LIGNE

// On lance le serveur via la variable 'server' et non plus 'app'
server.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
});