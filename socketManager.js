// Fichier : backend/socketManager.js

const { Server } = require("socket.io");

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