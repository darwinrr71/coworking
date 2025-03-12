/**---------------------------------------------------------
 * Project: COWORKING PLATFORM
 * Developer Full Stack: Darwin Rengifo
 * 
 *      Create Date: 2025-02-10
 *      Design Name: roomController .js
 *            Tools: Javascript, NodeJs, Express, Prisma, Postgres(In Supabase),
 *                   JWT, BCRYPT, Redis, Socket.io
 *        Path Name: < src/controllers/roomController.js >
 * 
 * Description:
 * - roomController  is a controller file that contains the logic for handling room
 *  requests.
 * - It includes the following functions:
 * - createRoom: Create a new room in the database.
 * - getAllRooms: Get all rooms.
 * - updateRoom: Update a room.
 * - deleteRoom: Delete a room.
 * 
 * - finally: await prisma.$disconnect(): 
 *   It always runs, regardless of whether the Try block ends successfully or if an error 
 *   occurs in the Catch block.
*-----------------------------------------------------------*/

import { PrismaClient } from '@prisma/client';
import redisClient from '../config/redis.js';

const prisma = new PrismaClient();

const roomController = {
    async createRoom(req, res, next) {
        try {
            const { name, capacity, type } = req.body;
            const newRoom = await prisma.room.create({
                data: {
                    name,
                    capacity,
                    type,
                },
            });
            res.status(201).json(newRoom);
        } catch (error) {
            //console.error(error);
            next(new Error('Error creating room'));
        }
    },

    async getAllRooms(req, res, next) {
        try {

            const cachedRooms = await redisClient.get('rooms');

            if (cachedRooms) {
                return res.json(JSON.parse(cachedRooms));
            }

            const rooms = await prisma.room.findMany();

            await redisClient.set('rooms', JSON.stringify(rooms), {
                EX: 3600,
                NX: true,
            });

            res.json(rooms);
        } catch (error) {
            //console.error(error);
            next(new Error('Error getting rooms'));
        }
    },

    async updateRoom(req, res, next) {
        try {
            const { id } = req.params;
            const { name, capacity, type } = req.body;
            const updatedRoom = await prisma.room.update({
                where: {
                    id: parseInt(id),
                },
                data: {
                    name,
                    capacity,
                    type,
                },
            });
            if (!updatedRoom) {
                return res.status(404).json({ message: 'Room not found' });
            }
            res.json(updatedRoom);
        } catch (error) {
            //console.error(error);
            next(new Error('Error updating room'));
        }
    },

    async deleteRoom(req, res, next) {
        try {
            const { id } = req.params;
            await prisma.room.delete({
                where: {
                    id: parseInt(id),
                },
            });
            res.status(204).send(); // No Content
        } catch (error) {
            //console.error(error);
            next(new Error('Error deleting room'));
        }
    },
};

export default roomController;