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

//import { PrismaClient } from '@prisma/client';
import prisma from '../lib/db.js';
import redisClient from '../config/redis.js';
import socketService from '../services/socketService.js';
import { randomUUID } from 'crypto';

//const prisma = new PrismaClient();

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

    const startHour = startDate.getHours();
    const endHour = endDate.getHours();
    if (
        startDate.getMinutes() !== 0 ||
        endDate.getMinutes() !== 0 ||
        startDate.getSeconds() !== 0 ||
        endDate.getSeconds() !== 0
    ) {
        throw new Error('Minutes must be 00');
    }
    if (startHour < 8 || startHour > 22 || endHour < 8 || endHour > 22) {
        throw new Error('Time must be between 08 and 22');
    }
}

function parseRequiredDate(value, message) {
    if (!value || typeof value !== 'string') {
        throw new Error(message);
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new Error(message);
    }
    return date;
}

function validateWorkingHours(date) {
    const hour = date.getHours();
    if (date.getMinutes() !== 0 || date.getSeconds() !== 0) {
        throw new Error('Minutes must be 00');
    }
    if (hour < 8 || hour > 22) {
        throw new Error('Time must be between 08 and 22');
    }
}

function validateIntervalsPayload(body) {
    const { roomId, intervals, metadata } = body ?? {};
    if (typeof roomId !== 'number' || roomId <= 0 || !Number.isInteger(roomId)) {
        throw new Error('roomId must be a positive integer');
    }
    if (!Array.isArray(intervals) || intervals.length === 0) {
        throw new Error('Intervals are required');
    }
    const normalized = intervals.map((interval) => {
        if (!interval || typeof interval !== 'object') {
            throw new Error('Invalid intervals payload');
        }
        const startAt = parseRequiredDate(interval.startAt, 'Invalid interval date');
        const endAt = parseRequiredDate(interval.endAt, 'Invalid interval date');
        validateWorkingHours(startAt);
        validateWorkingHours(endAt);
        if (endAt.getTime() <= startAt.getTime()) {
            throw new Error('Invalid interval range');
        }
        return { startAt, endAt };
    });
    return { roomId, intervals: normalized, metadata: metadata ?? null };
}

function findConflicts(intervals, existingBookings) {
    const conflicts = [];
    intervals.forEach((interval) => {
        existingBookings.forEach((booking) => {
            if (interval.startAt < booking.endTime && interval.endAt > booking.startTime) {
                conflicts.push({
                    startAt: interval.startAt.toISOString(),
                    endAt: interval.endAt.toISOString(),
                    existingBookingId: booking.id,
                });
            }
        });
    });
    return conflicts;
}

const PUBLIC_AVAILABILITY_CACHE_TTL_SECONDS = 30;
const PUBLIC_AVAILABILITY_CACHE_KEY_PREFIX = 'availability:public:v1';

function buildPublicAvailabilityCacheKey(from, to, roomIds, slotMinutes) {
    const normalizedRoomIds = typeof roomIds === 'string' ? roomIds : '';
    return `${PUBLIC_AVAILABILITY_CACHE_KEY_PREFIX}:${from}:${to}:${normalizedRoomIds}:${slotMinutes}`;
}

function toLocalDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
            await redisClient.del('getbookings');
            await redisClient.del(`getbookings:user:${userId}`);
            await redisClient.del('getbookings:admin');

            // Issue new reservation notification
            socketService.emit('New Booking', newBooking);

            res.status(201).json(newBooking);
        } catch (error) {
            next(error);
        }
    },

    async validateBookingIntervals(req, res, next) {
        try {
            const { roomId, intervals } = validateIntervalsPayload(req.body);
            const minStart = new Date(Math.min(...intervals.map((item) => item.startAt.getTime())));
            const maxEnd = new Date(Math.max(...intervals.map((item) => item.endAt.getTime())));
            const overlappingBookings = await prisma.booking.findMany({
                where: {
                    roomId,
                    startTime: { lt: maxEnd },
                    endTime: { gt: minStart },
                },
            });
            const conflicts = findConflicts(intervals, overlappingBookings);
            res.json({ ok: conflicts.length === 0, conflicts });
        } catch (error) {
            next(error);
        }
    },

    async createBulkBookings(req, res, next) {
        try {
            const { roomId, intervals, metadata } = validateIntervalsPayload(req.body);
            const userId = req.user.id;

            const existingRoom = await prisma.room.findFirst({
                where: { id: roomId },
            });
            if (!existingRoom) {
                throw new Error('RoomId does not exist');
            }

            const minStart = new Date(Math.min(...intervals.map((item) => item.startAt.getTime())));
            const maxEnd = new Date(Math.max(...intervals.map((item) => item.endAt.getTime())));
            const overlappingBookings = await prisma.booking.findMany({
                where: {
                    roomId,
                    startTime: { lt: maxEnd },
                    endTime: { gt: minStart },
                },
            });
            const conflicts = findConflicts(intervals, overlappingBookings);
            if (conflicts.length > 0) {
                return res.status(409).json({ message: 'Conflicts detected', conflicts });
            }

            const seriesId =
                metadata?.seriesId ?? (intervals.length > 1 ? randomUUID() : null);

            const operations = intervals.map((interval) =>
                prisma.booking.create({
                    data: {
                        roomId,
                        userId,
                        startTime: interval.startAt,
                        endTime: interval.endAt,
                        seriesId,
                        metadata,
                    },
                })
            );

            const createdBookings = await prisma.$transaction(operations);

            await redisClient.del('getbookings');
            await redisClient.del(`getbookings:user:${userId}`);
            await redisClient.del('getbookings:admin');

            createdBookings.forEach((booking) => {
                socketService.emit('New Booking', booking);
            });

            res.status(201).json({
                createdCount: createdBookings.length,
                seriesId,
            });
        } catch (error) {
            next(error);
        }
    },

    async getAvailability(req, res, next) {
        try {
            const { from, to, roomIds, slotMinutes } = req.query;
            const isPublicRequest = !req.user;
            const fromDate = parseRequiredDate(from, 'Invalid availability range');
            const toDate = parseRequiredDate(to, 'Invalid availability range');
            if (toDate.getTime() <= fromDate.getTime()) {
                throw new Error('Invalid availability range');
            }

            const slotSize = slotMinutes ? Number(slotMinutes) : 60;
            if (!Number.isFinite(slotSize) || slotSize <= 0 || slotSize !== 60) {
                throw new Error('Invalid availability range');
            }

            let publicCacheKey = null;
            if (isPublicRequest) {
                publicCacheKey = buildPublicAvailabilityCacheKey(from, to, roomIds, slotSize);
                try {
                    const cachedResponse = await redisClient.get(publicCacheKey);
                    if (cachedResponse) {
                        return res.json(JSON.parse(cachedResponse));
                    }
                } catch (cacheReadError) {
                    // Cache read failures should not block availability checks.
                }
            }

            let roomIdList = null;
            if (typeof roomIds === 'string' && roomIds.trim() !== '') {
                roomIdList = roomIds
                    .split(',')
                    .map((value) => Number(value))
                    .filter((value) => Number.isInteger(value) && value > 0);
                if (roomIdList.length === 0) {
                    throw new Error('Invalid roomIds');
                }
            }

            const rooms = await prisma.room.findMany({
                where: roomIdList ? { id: { in: roomIdList } } : undefined,
                select: { id: true },
            });
            const roomIdsToQuery = rooms.map((room) => room.id);
            if (roomIdsToQuery.length === 0) {
                return res.json({ rooms: [] });
            }

            const bookings = await prisma.booking.findMany({
                where: {
                    roomId: { in: roomIdsToQuery },
                    startTime: { lt: toDate },
                    endTime: { gt: fromDate },
                },
            });

            const bookingsByRoom = bookings.reduce((acc, booking) => {
                if (!acc[booking.roomId]) {
                    acc[booking.roomId] = [];
                }
                acc[booking.roomId].push(booking);
                return acc;
            }, {});

            const results = [];
            const dayCursor = new Date(fromDate);
            dayCursor.setHours(0, 0, 0, 0);
            const lastDay = new Date(toDate);
            lastDay.setHours(0, 0, 0, 0);

            while (dayCursor.getTime() <= lastDay.getTime()) {
                const dayStart = new Date(dayCursor);
                dayStart.setHours(8, 0, 0, 0);
                if (dayStart.getTime() < fromDate.getTime()) {
                    dayStart.setTime(fromDate.getTime());
                }
                const dayEnd = new Date(dayCursor);
                dayEnd.setHours(22, 0, 0, 0);
                if (dayEnd.getTime() > toDate.getTime()) {
                    dayEnd.setTime(toDate.getTime());
                }

                const dateKey = toLocalDateKey(dayCursor);

                rooms.forEach((room) => {
                    const roomBookings = bookingsByRoom[room.id] || [];
                    const slots = [];
                    let cursor = new Date(dayStart);
                    while (cursor.getTime() < dayEnd.getTime()) {
                        const slotStart = new Date(cursor);
                        const slotEnd = new Date(cursor.getTime() + slotSize * 60 * 1000);
                        if (slotEnd.getTime() > dayEnd.getTime()) {
                            break;
                        }
                        const isBusy = roomBookings.some(
                            (booking) =>
                                slotStart < booking.endTime && slotEnd > booking.startTime
                        );
                        slots.push({
                            startAt: slotStart.toISOString(),
                            endAt: slotEnd.toISOString(),
                            status: isBusy ? 'BUSY' : 'FREE',
                        });
                        cursor = slotEnd;
                    }
                    results.push({
                        roomId: room.id,
                        date: dateKey,
                        slots,
                    });
                });

                dayCursor.setDate(dayCursor.getDate() + 1);
            }

            const payload = { rooms: results };

            if (isPublicRequest && publicCacheKey) {
                try {
                    await redisClient.set(publicCacheKey, JSON.stringify(payload), {
                        EX: PUBLIC_AVAILABILITY_CACHE_TTL_SECONDS,
                    });
                } catch (cacheWriteError) {
                    // Cache write failures should not block availability checks.
                }
            }

            res.json(payload);
        } catch (error) {
            next(error);
        }
    },

    async getUserBookings(req, res, next) {
        try {
            const userId = req.user.id;
            let bookings;
            const cacheKey =
                req.user.role === 'Admin'
                    ? 'getbookings:admin'
                    : `getbookings:user:${userId}`;
            const cachedBooking = await redisClient.get(cacheKey);

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

            await redisClient.set(cacheKey, JSON.stringify(bookings), {
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
            await redisClient.del('getbookings');
            await redisClient.del(`getbookings:user:${userId}`);
            await redisClient.del('getbookings:admin');

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
            await redisClient.del('getbookings');
            await redisClient.del(`getbookings:user:${userId}`);
            await redisClient.del('getbookings:admin');

            // Issue deleted reservation notification
            socketService.emit('Booking Deleted', { bookingId: id });

            res.status(204).send();
        } catch (error) {
            next(new Error('Error deleting booking'));
        }
    },
};

export default bookingController;
