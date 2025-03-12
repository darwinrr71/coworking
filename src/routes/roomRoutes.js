/**---------------------------------------------------------
 * Project: COWORKING PLATFORM
 * Developer Full Stack: Darwin Rengifo
 * 
 *      Create Date: 2025-02-10
 *      Design Name: roomRoutes.js
 *            Tools: Javascript, NodeJs, Express, Prisma, Postgres(In Supabase),
 *                   JWT, BCRYPT, Redis, Socket.io
 *        Path Name: < src/routes/roomRoutes.js >
 * 
 * Description:
 * - Routes for creating a room, getting all rooms, 
 *   updating a room, and deleting a room.
*-----------------------------------------------------------*/

import express from 'express';
const roomRoutes = express.Router();
import roomController from '../controllers/roomController.js';
import authMiddleware from '../middleware/authMiddleware.js';

roomRoutes.post('/room/create', authMiddleware.authenticate, authMiddleware.authorize(['Admin']), roomController.createRoom);
roomRoutes.get('/room/allroom', roomController.getAllRooms);
roomRoutes.put('/room/update/:id', authMiddleware.authenticate, authMiddleware.authorize(['Admin']), roomController.updateRoom);
roomRoutes.delete('/room/delete/:id', authMiddleware.authenticate, authMiddleware.authorize(['Admin']), roomController.deleteRoom);

export default roomRoutes;