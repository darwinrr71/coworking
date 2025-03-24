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
 * - validateRoomInput: Validate the input for creating or updating a room.
 *                      It checks if the name and type are provided, if the capacity 
 *                      is a positive integer, and if a room with the same name 
 *                      already exists.
 * - The controller uses Prisma to interact with the database.
 * - The controller uses Redis to cache room data.
 * - The controller uses Socket.IO to emit room events.
 * - The controller uses the errorHandler middleware to handle errors.
 * 
*-----------------------------------------------------------*/

import { PrismaClient } from '@prisma/client';
import redisClient from '../config/redis.js';
import socketService from '../services/socketService.js';

const prisma = new PrismaClient();


async function validateRoomInput(name, type, capacity, prisma, existingRoomName = null) {

    /** This validation ensures that the name and type fields are present in the request. */
    if (!name || !type || name.trim() === '' || type.trim() === '') {
        throw new Error('Name and type are required');
    }

    /** This validation ensures that the roomId field is a positive integer greater than 0. */
    if (typeof capacity !== 'number' || capacity <= 0 || !Number.isInteger(capacity)) {
        throw new Error('Capacity must be a positive integer');
    }

    const existingRoom = await prisma.room.findUnique({
        where: { name: name },
    });

    /** This validation ensures that a room with the same name does not already exist. */
    if (existingRoom && name !== existingRoomName) {
        throw new Error('A room with this name already exists');
    }
}

const roomController = {
    async createRoom(req, res, next) {

        try {
            const { name, capacity, type } = req.body;

            /** Validate input */
            await validateRoomInput(name, type, capacity, prisma);

            const trimmedName = name.trim();
            const newRoom = await prisma.room.create({
                data: {
                    name: trimmedName,
                    capacity,
                    type,
                },
            });

            // Issue new room notification
            socketService.emit('New Room', newRoom);

            res.status(201).json(newRoom);
        } catch (error) {
            next(error);
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
                EX: 3600, // Set the key expiration to 3600 seconds (1 hour)
                NX: true, // The key will only be set if it does not already exist in Redis.
            });

            res.json(rooms);
        } catch (error) {
            next(new Error('Error getting rooms'));
        }
    },

    async updateRoom(req, res, next) {
        try {
            const { id } = req.params;
            const { name, capacity, type } = req.body;

            const roomToUpdate = await prisma.room.findUnique({ where: { id: parseInt(id) } });
            if (!roomToUpdate) {
                throw new Error('Room not found');
            }

            await validateRoomInput(name, type, capacity, prisma, roomToUpdate.name);

            const trimmedName = name.trim();
            const updatedRoom = await prisma.room.update({
                where: {
                    id: parseInt(id),
                },
                data: {
                    name: trimmedName,
                    capacity,
                    type,
                },
            });

            // Issue updated room notification
            socketService.emit('Room Updated', updatedRoom);

            res.json(updatedRoom);
        } catch (error) {
            next(error);
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

            // Issue deleted room notification
            socketService.emit('Booking Deleted', { roomId: id });

            res.status(204).send(); // No Content
        } catch (error) {
            next(new Error('Error deleting room'));
        }
    },
};

export default roomController;