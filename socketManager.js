const { Server } = require("socket.io");
const Ticket = require('./models/Ticket.model.js');

let io;
// Votre système utilise un objet, nous allons le conserver
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

        // ✅ CORRIGÉ : Logique de mise à jour des messages lus
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

        // ✅✅✅ DÉBUT DU BLOC AJOUTÉ POUR LES AVERTISSEMENTS ✅✅✅
        // Émis par un admin pour avertir un utilisateur
        socket.on('admin:warn_user', ({ userId, message }) => {
            // 1. On cherche le socket de l'utilisateur cible dans votre objet onlineUsers
            const userSocketId = onlineUsers[userId];
            
            if (userSocketId) {
                // 2. Si on le trouve, on envoie l'événement *uniquement* à cet utilisateur
                io.to(userSocketId).emit('user:receive_warning', { message });
                console.log(`🔔 Avertissement envoyé à l'utilisateur ${userId} sur le socket ${userSocketId}`);
            } else {
                console.log(`⚠️ Utilisateur ${userId} non trouvé ou non connecté. Avertissement non envoyé.`);
            }
        });
        // ✅✅✅ FIN DU BLOC AJOUTÉ POUR LES AVERTISSEMENTS ✅✅✅

        socket.on("disconnect", () => {
            // On parcourt l'objet pour trouver l'utilisateur à supprimer
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