// baticlean-backend/socketManager.js

const { Server } = require("socket.io");
const Ticket = require('./models/Ticket.model.js');

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

        // ✅ CORRIGÉ : Logique de mise à jour des messages lus
        socket.on('markMessagesAsRead', async ({ ticketId, readerId }) => {
            try {
                const ticket = await Ticket.findById(ticketId);
                if (!ticket) return;

                let hasBeenModified = false;
                // On parcourt chaque message pour le mettre à jour
                ticket.messages.forEach(message => {
                    // On ne met à jour que les messages non envoyés par le lecteur
                    // et que le lecteur n'a pas encore lus
                    if (message.sender?.toString() !== readerId && !message.readBy.includes(readerId)) {
                        message.readBy.push(readerId);
                        hasBeenModified = true;
                    }
                });

                // Si au moins un message a été modifié, on sauvegarde et on notifie les clients
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

        socket.on("disconnect", () => {
            for (const userId in onlineUsers) {
                if (onlineUsers[userId] === socket.id) {
                    delete onlineUsers[userId];
                    console.log(`🔌 Un utilisateur s'est déconnecté: ${socket.id}`);
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