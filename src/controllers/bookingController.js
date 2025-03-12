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
 *  - getUserBookings: Get all bookings.
 *  - updateBooking: Update a booking.
 *  - deleteBooking: Delete a booking.
 * 
 * - finally: await prisma.$disconnect(): 
 *   It always runs, regardless of whether the Try block ends successfully or if an error 
 *   occurs in the Catch block.
*-----------------------------------------------------------*/

import { PrismaClient } from '@prisma/client';
import socketService from '../services/socketService.js';
const prisma = new PrismaClient();

const bookingController = {
    async createBooking(req, res, next) {
        try {
            const { roomId, startTime, endTime } = req.body;
            const userId = req.user.id;
            console.log('userId', userId);

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
                return next(new Error('Room is not available at this time'));
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
            next(new Error('Error creating booking'));
        }
    },

    async getUserBookings(req, res, next) {
        try {
            const userId = req.user.id;
            let bookings;

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
                return next(new Error('Booking not found'));
            }

            if (req.user.role !== 'Admin' && booking.userId !== userId) {
                return next(new Error('Unauthorized'));
            }

            const overlappingBookings = await prisma.booking.findMany({
                where: {
                    roomId: booking.roomId,
                    id: { not: parseInt(id) },
                    startTime: { lt: new Date(endTime) },
                    endTime: { gt: new Date(startTime) },
                },
            });

            if (overlappingBookings.length > 0) {
                return next(new Error('Room is not available at this time'));
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
            next(new Error('Error updating booking'));
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
            console.error(error);
            next(new Error('Error deleting booking'));
        }
    },
};

export default bookingController;