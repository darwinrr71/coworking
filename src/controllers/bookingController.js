/**---------------------------------------------------------
 * Project: COWORKING PLATFORM
 * Developer Full Stack: Darwin Rengifo
 * 
 *      Create Date: 2025-02-10
 *      Design Name: bookingController .js
 *            Tools: Javascript, NodeJs, Express, Prisma, Postgres(In Supabase),
 *                   JWT, BCRYPT, Redis, Socket.io
 *        Path Name: < src/controllers/bookingController.js >
 * 
 * Description:
 * - bookningController  is a controller file that contains the logic for handling booking 
 *   requests.
 * - It includes the following functions:
 *  - createBooking: Create a new booking in the database.
 *  - getUserBookings: Get all bookings (Admin / User).
 *  - updateBooking: Update a booking.
 *  - deleteBooking: Delete a booking.
 * - validateBookingInput: Validate the input for creating or updating a booking.
 * - The controller uses Prisma to interact with the database.
 * - The controller uses Redis to cache booking data.
 * - The controller uses Socket.IO to emit booking events.
 * - The controller uses the errorHandler middleware to handle errors.
 * 
 *-----------------------------------------------------------*/

import { PrismaClient } from '@prisma/client';
import redisClient from '../config/redis.js';
import socketService from '../services/socketService.js';

const prisma = new PrismaClient();

async function validateBookingInput(roomId, startTime, endTime) {

    /** This validation ensures that the roomId field is a positive integer greater than 0. */
    if (typeof roomId !== 'number' || roomId <= 0 || !Number.isInteger(roomId)) {
        throw new Error('roomId must be a positive integer');
    }

    /** This validation ensures that the startTime and endTime fields are present in the request. Boolean(true/false) */
    if (!startTime || !endTime) {
        throw new Error('Start and end time are required');
    }

    /** This validation ensures that the startTime and endTime fields are not empty, even if they contain only blank spaces. */
    if (startTime.trim() === '' || endTime.trim() === '') {
        throw new Error('startTime and endTime cannot be empty');
    }

    const startDate = new Date(startTime);
    const endDate = new Date(endTime);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new Error('Invalid start or end time format');
    }

    if (endDate.getTime() <= startDate.getTime()) {
        throw new Error('endTime must be after startTime');
    }
}

const bookingController = {
    async createBooking(req, res, next) {
        try {
            const { roomId, startTime, endTime } = req.body;
            const userId = req.user.id;

            /** Validate input */
            await validateBookingInput(roomId, startTime, endTime);

            /* Check room availability 
                The code checks if someone has already 
                reserved the room for the time you want.
            */
            const overlappingBookings = await prisma.booking.findMany({
                where: {
                    roomId: parseInt(roomId),
                    startTime: { lt: new Date(endTime) },   // lt = less than
                    endTime: { gt: new Date(startTime) },   // gt = greater than
                },
            });

            if (overlappingBookings.length > 0) {
                throw new Error('Room is not available at this time');
            }

            /** Verify that the roomID exists in the Room table before creating the booking */
            const existingRoom = await prisma.room.findFirst({
                where: {
                    id: roomId,
                },
            });

            if (!existingRoom) {
                throw new Error('RoomId does not exist');
            }

            const newBooking = await prisma.booking.create({
                data: {
                    roomId: parseInt(roomId),
                    userId: userId,
                    startTime: new Date(startTime),
                    endTime: new Date(endTime),
                },
            });

            // Issue new reservation notification
            socketService.emit('New Booking', newBooking);

            res.status(201).json(newBooking);
        } catch (error) {
            next(error);
        }
    },

    async getUserBookings(req, res, next) {
        try {
            const userId = req.user.id;
            let bookings;

            const cachedBooking = await redisClient.get('getbookings');

            if (cachedBooking) {
                return res.json(JSON.parse(cachedBooking));
            }

            if (req.user.role === 'Admin') {
                bookings = await prisma.booking.findMany({
                    include: {
                        user: true,
                        room: true,
                    },
                });
            } else {
                bookings = await prisma.booking.findMany({
                    where: { userId },
                    include: {
                        user: true,
                        room: true,
                    },
                });
            }

            await redisClient.set('getbookings', JSON.stringify(bookings), {
                EX: 3600, // Set the key expiration to 3600 seconds (1 hour)
                NX: true, // The key will only be set if it does not already exist in Redis.
            });

            res.json(bookings);
        } catch (error) {
            next(new Error('Error getting bookings'));
        }
    },

    async updateBooking(req, res, next) {
        try {
            const { id } = req.params;
            const { startTime, endTime } = req.body;
            const userId = req.user.id;

            const booking = await prisma.booking.findUnique({
                where: { id: parseInt(id) },
            });

            if (!booking) {
                throw new Error('Booking not found');
            }

            if (req.user.role !== 'Admin' && booking.userId !== userId) {
                return next(new Error('Unauthorized'));
            }

            await validateBookingInput(booking.roomId, startTime, endTime);

            const overlappingBookings = await prisma.booking.findMany({
                where: {
                    roomId: booking.roomId,
                    id: { not: parseInt(id) },
                    startTime: { lt: new Date(endTime) },
                    endTime: { gt: new Date(startTime) },
                },
            });

            if (overlappingBookings.length > 0) {
                throw new Error('Room is not available at this time');
            }

            const updatedBooking = await prisma.booking.update({
                where: { id: parseInt(id) },
                data: {
                    startTime: new Date(startTime),
                    endTime: new Date(endTime),
                },
            });

            // Issue updated reservation notification
            socketService.emit('Booking Updated', updatedBooking);

            res.json(updatedBooking);
        } catch (error) {
            next(error);
        }
    },

    async deleteBooking(req, res, next) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            const booking = await prisma.booking.findUnique({
                where: { id: parseInt(id) },
            });

            if (!booking) {
                return next(new Error('Booking not found'));
            }

            if (req.user.role !== 'Admin' && booking.userId !== userId) {
                return next(new Error('Unauthorized'));
            }

            await prisma.booking.delete({
                where: { id: parseInt(id) },
            });

            // Issue deleted reservation notification
            socketService.emit('Booking Deleted', { bookingId: id });

            res.status(204).send();
        } catch (error) {
            next(new Error('Error deleting booking'));
        }
    },
};

export default bookingController;