// backend/socketManager.js (Corrigé)

const { Server } = require("socket.io");
const Ticket = require('./models/Ticket.model.js');
const Warning = require('./models/Warning.model.js'); // ✅ On importe notre nouveau modèle

let io;
let onlineUsers = {};

const initializeSocket = (server, corsOptions) => {
    io = new Server(server, {
        cors: corsOptions
    });

    io.on("connection", (socket) => {
        console.log(`🔌 Un utilisateur s'est connecté: ${socket.id}`);

        socket.on("addUser", (userId) => {
            if (userId) {
                onlineUsers[userId] = socket.id;
                console.log('Utilisateurs en ligne:', onlineUsers);
            }
        });

        socket.on('markMessagesAsRead', async ({ ticketId, readerId }) => {
            try {
                const ticket = await Ticket.findById(ticketId);
                if (!ticket) return;

                let hasBeenModified = false;
                ticket.messages.forEach(message => {
                    if (message.sender?.toString() !== readerId && !message.readBy.includes(readerId)) {
                        message.readBy.push(readerId);
                        hasBeenModified = true;
                    }
                });

                if (hasBeenModified) {
                    await ticket.save();
                    const updatedTicket = await Ticket.findById(ticketId)
                        .populate('user', 'username')
                        .populate('messages.sender', 'username profilePicture')
                        .populate('assignedAdmin', 'username');

                    io.emit('ticketUpdated', updatedTicket);
                }
            } catch (error) {
                console.error("Erreur lors de la mise à jour des messages lus:", error);
            }
        });

        // ✅✅✅ DÉBUT DE LA LOGIQUE D'AVERTISSEMENT AMÉLIORÉE ✅✅✅
        // L'admin envoie un avertissement qui sera maintenant sauvegardé
        socket.on('admin:warn_user', async ({ userId, adminId, message, actions }) => {
            try {
                // 1. Sauvegarder l'avertissement dans la base de données
                await Warning.create({
                    user: userId,
                    sentBy: adminId, // L'ID de l'admin qui envoie
                    message: message,
                    actions: actions || [] // Les actions possibles pour l'utilisateur
                });
                console.log(`💾 Avertissement pour l'utilisateur ${userId} sauvegardé en BDD.`);

                // 2. Notifier l'utilisateur en temps réel (s'il est en ligne)
                const userSocketId = onlineUsers[userId];
                if (userSocketId) {
                    // On envoie un signal simple pour dire "va chercher tes nouveaux avertissements"
                    io.to(userSocketId).emit('user:new_warning_received');
                    console.log(`🔔 Notification de nouvel avertissement envoyée à ${userId}`);
                } else {
                    console.log(`⚠️ Utilisateur ${userId} non connecté. Il verra l'avertissement à sa prochaine connexion.`);
                }
            } catch (error) {
                console.error("Erreur lors de la création de l'avertissement:", error);
            }
        });
        // ✅✅✅ FIN DE LA LOGIQUE AMÉLIORÉE ✅✅✅

        socket.on("disconnect", () => {
            for (const userId in onlineUsers) {
                if (onlineUsers[userId] === socket.id) {
                    delete onlineUsers[userId];
                    console.log(`🔌 Un utilisateur s'est déconnecté: ${socket.id}. Utilisateur ${userId} retiré.`);
                    console.log('Utilisateurs en ligne:', onlineUsers);
                    break;
                }
            }
        });
    });

    return io;
};

const getIO = () => {
    if (!io) {
        throw new Error("Socket.io n'est pas initialisé!");
    }
    return io;
};

const getOnlineUsers = () => {
    return onlineUsers;
};

module.exports = { initializeSocket, getIO, getOnlineUsers };