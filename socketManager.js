// baticlean-backend/socketManager.js

const { Server } = require("socket.io");
const Ticket = require('./models/Ticket.model.js'); // ✅ On importe le modèle de Ticket

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

        // ✅ NOUVEAU : Logique pour marquer les messages comme lus
        socket.on('markMessagesAsRead', async ({ ticketId, readerId }) => {
            try {
                // On met à jour tous les messages du ticket qui n'ont pas été envoyés par le lecteur
                // et où le lecteur n'est pas déjà dans le tableau "readBy"
                const result = await Ticket.updateMany(
                    { 
                        _id: ticketId, 
                        'messages.sender': { $ne: readerId },
                        'messages.readBy': { $ne: readerId }
                    },
                    { $addToSet: { 'messages.$.readBy': readerId } }
                );

                if (result.modifiedCount > 0) {
                    const updatedTicket = await Ticket.findById(ticketId)
                        .populate('user', 'username')
                        .populate('messages.sender', 'username profilePicture')
                        .populate('assignedAdmin', 'username');

                    // On notifie tout le monde que le ticket a été mis à jour
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