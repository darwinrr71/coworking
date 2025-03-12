/**---------------------------------------------------------
 * Project: COWORKING PLATFORM
 * Developer Full Stack: Darwin Rengifo
 * 
 *      Create Date: 2025-02-13
 *      Design Name: socketService.js
 *            Tools: Javascript, NodeJs, Express, Prisma, Postgres(In Supabase),
 *                   JWT, BCRYPT, Redis, Socket.io
 *        Path Name: < src/services/socketService.js >
 * 
 * Description:
 * - Routes for creating a room, getting all rooms, 
 *   updating a room, and deleting a room.
 * - It includes the following functions:
 * - init: Initialize the socket.io server.
 * - emit: Emit an event to all connected clients.
*-----------------------------------------------------------*/
import { Server } from "socket.io";

let io;

const socketService = {
    init(server) {
        console.log("Initializing socket.io server");
        io = new Server(server);
    },

    emit(event, data) {
        if (!io) {
            console.log("Socket.io not initialized!");
            return;
        }
        io.emit(event, data);
        console.log(`Emitted ${event}:`, data); // This log will give you the answer in the terminal
    },
};

export default socketService;