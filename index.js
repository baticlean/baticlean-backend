 // Fichier : backend/index.js



require('dotenv').config();

const express = require('express');

const cors = require('cors');

const mongoose = require('mongoose');

const http = require('http');

const helmet = require('helmet'); // ✅ 1. IMPORTER HELMET

const { initializeSocket, getIO, getOnlineUsers } = require('./socketManager'); // On importe depuis notre nouveau fichier



const app = express();

const server = http.createServer(app);



const corsOptions = {

    origin: ['http://localhost:5173', process.env.FRONTE], // Mettez ici l'URL de votre site en production

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



// ✅ AJOUTEZ CETTE LIGNE

app.use('/api/config', require('./routes/config.routes.js'));



// NOUVEAU : On ajoute les routes de maintenance

const { router: maintenanceRouter } = require('./routes/maintenance.routes.js');

app.use('/api/maintenance', maintenanceRouter);



server.listen(PORT, () => {

    console.log(`🚀 Serveur démarré sur le port ${PORT}`);

});