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

import prisma from '../lib/db.js';
//import { PrismaClient } from '@prisma/client';
import redisClient from '../config/redis.js';
import socketService from '../services/socketService.js';
import supabase from '../lib/supabase.js';
import sharp from 'sharp';
import net from 'node:net';
import { lookup } from 'node:dns/promises';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const TTFB_TIMEOUT_MS = 10000;
const TOTAL_TIMEOUT_MS = 30000;
const TOTAL_TIMEOUT_RETRY_MS = 45000;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_SLOTS = 5;
const ROOMS_CACHE_TTL_SECONDS = 60;
const ROOMS_CACHE_VERSION_KEY = 'rooms:version';
const ROOMS_CACHE_KEY_PREFIX = 'rooms:v';

async function bumpRoomsCacheVersion() {
    await redisClient.incr(ROOMS_CACHE_VERSION_KEY);
}

async function listRoomStoragePaths(roomId) {
    const prefix = `rooms/${roomId}`;
    const paths = [];
    let offset = 0;
    const limit = 100;

    while (true) {
        const { data, error } = await supabase.storage
            .from('room-images')
            .list(prefix, { limit, offset, sortBy: { column: 'name', order: 'asc' } });
        if (error) {
            throw error;
        }
        const files = data ?? [];
        for (const file of files) {
            if (!file?.name || file.name.endsWith('/')) {
                continue;
            }
            paths.push(`${prefix}/${file.name}`);
        }
        if (files.length < limit) {
            break;
        }
        offset += limit;
    }

    return paths;
}

async function cleanupRoomStorage(roomId) {
    const dbImages = await prisma.roomImage.findMany({
        where: { roomId },
        select: { path: true },
    });
    const dbPaths = new Set(dbImages.map((image) => image.path));
    const storagePaths = await listRoomStoragePaths(roomId);
    const orphans = storagePaths.filter((path) => !dbPaths.has(path));
    if (orphans.length === 0) {
        return;
    }
    const { error } = await supabase.storage.from('room-images').remove(orphans);
    if (error) {
        throw error;
    }
    console.info('Room storage cleanup', { roomId, removed: orphans.length });
}

function toSlotLabel(slot) {
    return String(slot).padStart(2, '0');
}

function buildSlotPath(roomId, slot) {
    return `rooms/${roomId}/${toSlotLabel(slot)}.webp`;
}

async function getExistingSlots(roomId) {
    const images = await prisma.roomImage.findMany({
        where: { roomId },
        select: { path: true },
    });

    const slots = new Set();
    for (const image of images) {
        const match = image.path.match(/\/(\d{2})\.webp$/);
        if (match) {
            const slotNumber = parseInt(match[1], 10);
            if (!Number.isNaN(slotNumber)) {
                slots.add(slotNumber);
            }
        }
    }
    return slots;
}

function parseReplaceSlots(rawSlots) {
    if (!rawSlots) return [];
    if (Array.isArray(rawSlots)) {
        return rawSlots.map((value) => Number(value)).filter((value) => Number.isInteger(value));
    }
    if (typeof rawSlots === 'string') {
        return rawSlots
            .split(',')
            .map((value) => Number(value.trim()))
            .filter((value) => Number.isInteger(value));
    }
    return [];
}

function assignSlots(incomingCount, existingSlots, replaceSlots) {
    if (incomingCount === MAX_SLOTS) {
        return Array.from({ length: MAX_SLOTS }, (_, index) => index + 1);
    }

    const normalizedReplaceSlots = Array.from(new Set(replaceSlots));
    if (normalizedReplaceSlots.length > 0) {
        if (normalizedReplaceSlots.length !== replaceSlots.length) {
            const error = new Error('duplicate_replace_slots');
            error.code = 'duplicate_replace_slots';
            throw error;
        }
        if (normalizedReplaceSlots.length !== incomingCount) {
            const error = new Error('replace_slots_mismatch');
            error.code = 'replace_slots_mismatch';
            throw error;
        }
        const invalidSlot = normalizedReplaceSlots.find(
            (slot) => slot < 1 || slot > MAX_SLOTS || !Number.isInteger(slot)
        );
        if (invalidSlot !== undefined) {
            const error = new Error('invalid_replace_slots');
            error.code = 'invalid_replace_slots';
            throw error;
        }
        return normalizedReplaceSlots;
    }

    const freeSlots = [];
    for (let slot = 1; slot <= MAX_SLOTS; slot += 1) {
        if (!existingSlots.has(slot)) {
            freeSlots.push(slot);
        }
    }

    if (freeSlots.length >= incomingCount) {
        return freeSlots.slice(0, incomingCount);
    }

    const remainingNeeded = incomingCount - freeSlots.length;
    const validReplaceSlots = normalizedReplaceSlots.filter(
        (slot) => slot >= 1 && slot <= MAX_SLOTS && !freeSlots.includes(slot)
    );

    if (validReplaceSlots.length !== remainingNeeded) {
        const error = new Error('replace_slots_required');
        error.code = 'replace_slots_required';
        error.existingSlots = Array.from(existingSlots).sort((a, b) => a - b);
        error.freeSlots = freeSlots;
        error.requiredReplaceSlotsCount = remainingNeeded;
        throw error;
    }

    return [...freeSlots, ...validReplaceSlots];
}

function isBlockedHostname(hostname) {
    const normalized = hostname.toLowerCase();
    return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1';
}

function isPrivateIPv4(ip) {
    if (!net.isIP(ip)) return false;
    const [a, b] = ip.split('.').map((octet) => parseInt(octet, 10));
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (ip === '169.254.169.254') return true;
    return false;
}

async function assertPublicHost(hostname) {
    if (isBlockedHostname(hostname)) {
        throw new Error('Blocked host');
    }

    if (net.isIP(hostname)) {
        if (isPrivateIPv4(hostname)) {
            throw new Error('Blocked host');
        }
        return;
    }

    const resolved = await lookup(hostname, { all: true });
    for (const record of resolved) {
        if (isPrivateIPv4(record.address)) {
            throw new Error('Blocked host');
        }
    }
}

function detectMimeType(buffer) {
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return 'image/jpeg';
    }
    if (
        buffer.length >= 8 &&
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47 &&
        buffer[4] === 0x0d &&
        buffer[5] === 0x0a &&
        buffer[6] === 0x1a &&
        buffer[7] === 0x0a
    ) {
        return 'image/png';
    }
    if (
        buffer.length >= 12 &&
        buffer[0] === 0x52 &&
        buffer[1] === 0x49 &&
        buffer[2] === 0x46 &&
        buffer[3] === 0x46 &&
        buffer[8] === 0x57 &&
        buffer[9] === 0x45 &&
        buffer[10] === 0x42 &&
        buffer[11] === 0x50
    ) {
        return 'image/webp';
    }
    return null;
}

async function readResponseToBuffer(response) {
  if (!response.body) {
    throw new Error('Empty response');
  }

    const chunks = [];
    let total = 0;

    for await (const chunk of response.body) {
        total += chunk.length;
        if (total > MAX_IMAGE_BYTES) {
            const error = new Error('too_large');
            error.code = 'too_large';
            throw error;
        }
        chunks.push(Buffer.from(chunk));
    }

    return Buffer.concat(chunks, total);
}

async function fetchWithRedirects(rawUrl, totalTimeoutMs = TOTAL_TIMEOUT_MS) {
    let currentUrl = new URL(rawUrl);
    for (let attempt = 0; attempt <= MAX_REDIRECTS; attempt += 1) {
        if (!['http:', 'https:'].includes(currentUrl.protocol)) {
            throw new Error('Only HTTP/HTTPS URLs are allowed');
        }

        await assertPublicHost(currentUrl.hostname);

        const controller = new AbortController();
        const ttfbTimer = setTimeout(() => {
            controller.abort(new Error('timeout_ttfb'));
        }, TTFB_TIMEOUT_MS);

        let totalTimer;

        try {
            const response = await fetch(currentUrl, {
                method: 'GET',
                redirect: 'manual',
                signal: controller.signal,
            });

            clearTimeout(ttfbTimer);
            totalTimer = setTimeout(() => {
                controller.abort(new Error('timeout_total'));
            }, totalTimeoutMs);

            if ([301, 302, 303, 307, 308].includes(response.status)) {
                const location = response.headers.get('location');
                if (!location) {
                    throw new Error('Redirect without location');
                }
                currentUrl = new URL(location, currentUrl);
                clearTimeout(totalTimer);
                continue;
            }

            if (!response.ok) {
                throw new Error(`Upstream returned ${response.status}`);
            }

            const contentLengthHeader = response.headers.get('content-length');
            if (contentLengthHeader) {
                const contentLength = Number(contentLengthHeader);
                if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_BYTES) {
                    const error = new Error('too_large');
                    error.code = 'too_large';
                    throw error;
                }
            }

            const contentType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
            if (!contentType || !ALLOWED_MIME_TYPES.has(contentType)) {
                const error = new Error('invalid_content_type');
                error.code = 'invalid_content_type';
                throw error;
            }

            const buffer = await readResponseToBuffer(response);
            const detectedType = detectMimeType(buffer);
            if (!detectedType || !ALLOWED_MIME_TYPES.has(detectedType)) {
                const error = new Error('invalid_content_type');
                error.code = 'invalid_content_type';
                throw error;
            }

            return buffer;
        } catch (error) {
            if (controller.signal.aborted) {
                const reason = controller.signal.reason?.message || 'timeout';
                const timeoutError = new Error(reason);
                timeoutError.code = reason;
                throw timeoutError;
            }
            throw error;
        } finally {
            clearTimeout(ttfbTimer);
            if (totalTimer) {
                clearTimeout(totalTimer);
            }
        }
    }

    throw new Error('Too many redirects');
}

//const prisma = new PrismaClient();


async function validateRoomInput(
    name,
    address,
    type,
    capacity,
    pricePerHour,
    squareMeters,
    description,
    prisma,
    existingRoomName = null
) {

    /** This validation ensures that the name and type fields are present in the request. */
    if (!name || !type || name.trim() === '' || type.trim() === '') {
        throw new Error('Name and type are required');
    }

    /** This validation ensures that the address field is present. */
    if (!address || address.trim() === '') {
        throw new Error('Address is required');
    }

    /** This validation ensures that the capacity field is a positive integer greater than 0. */
    if (typeof capacity !== 'number' || capacity <= 0 || !Number.isInteger(capacity)) {
        throw new Error('Capacity must be a positive integer');
    }

    /** This validation ensures that the pricePerHour field is a positive integer greater than 0. */
    if (typeof pricePerHour !== 'number' || pricePerHour <= 0 || !Number.isInteger(pricePerHour)) {
        throw new Error('Price per hour must be a positive integer');
    }

    /** This validation ensures that the squareMeters field is a positive integer greater than 0. */
    if (typeof squareMeters !== 'number' || squareMeters <= 0 || !Number.isInteger(squareMeters)) {
        throw new Error('Square meters must be a positive integer');
    }

    /** This validation ensures that the description field is present. */
    if (!description || description.trim() === '') {
        throw new Error('Description is required');
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
            const { name, address, capacity, type, pricePerHour, squareMeters, description } = req.body;

            /** Validate input */
            await validateRoomInput(
                name,
                address,
                type,
                capacity,
                pricePerHour,
                squareMeters,
                description,
                prisma
            );

            const trimmedName = name.trim();
            const newRoom = await prisma.room.create({
                data: {
                    name: trimmedName,
                    address: address.trim(),
                    capacity,
                    pricePerHour,
                    squareMeters,
                    description: description.trim(),
                    type,
                },
            });
            await bumpRoomsCacheVersion();

            // Issue new room notification
            socketService.emit('New Room', newRoom);

            res.status(201).json(newRoom);
        } catch (error) {
            next(error);
        }
    },

    async getAllRooms(req, res, next) {
        try {
            res.set('Cache-Control', 'no-store');

            const cacheVersion = (await redisClient.get(ROOMS_CACHE_VERSION_KEY)) ?? '0';
            const cacheKey = `${ROOMS_CACHE_KEY_PREFIX}${cacheVersion}`;
            const cachedRooms = await redisClient.get(cacheKey);
            if (cachedRooms) {
                return res.json(JSON.parse(cachedRooms));
            }

            const rooms = await prisma.room.findMany({
                select: {
                    id: true,
                    name: true,
                    address: true,
                    capacity: true,
                    pricePerHour: true,
                    squareMeters: true,
                    description: true,
                    type: true,
                    images: {
                        select: {
                            id: true,
                            bucket: true,
                            path: true,
                            alt: true,
                            sortOrder: true,
                            updatedAt: true,
                        },
                        orderBy: {
                            sortOrder: 'asc',
                        },
                    },
                },
            });

            await redisClient.set(cacheKey, JSON.stringify(rooms), {
                EX: ROOMS_CACHE_TTL_SECONDS,
            });

            res.json(rooms);
        } catch (error) {
            next(new Error('Error getting rooms'));
        }
    },

    async getRoomById(req, res, next) {
        try {
            res.set('Cache-Control', 'no-store');
            const roomId = parseInt(req.params.id, 10);
            if (!Number.isInteger(roomId)) {
                return res.status(400).json({ message: 'Invalid room id' });
            }

            const room = await prisma.room.findUnique({
                where: { id: roomId },
                select: {
                    id: true,
                    name: true,
                    address: true,
                    capacity: true,
                    pricePerHour: true,
                    squareMeters: true,
                    description: true,
                    type: true,
                    images: {
                        select: {
                            id: true,
                            bucket: true,
                            path: true,
                            alt: true,
                            sortOrder: true,
                            updatedAt: true,
                        },
                        orderBy: {
                            sortOrder: 'asc',
                        },
                    },
                },
            });

            if (!room) {
                return res.status(404).json({ message: 'Room not found' });
            }

            return res.json(room);
        } catch (error) {
            next(new Error('Error getting rooms'));
        }
    },

    async uploadRoomImages(req, res, next) {
        try {
            const roomId = parseInt(req.params.id, 10);
            if (!Number.isInteger(roomId)) {
                return res.status(400).json({ message: 'Invalid room id' });
            }

            const room = await prisma.room.findUnique({ where: { id: roomId } });
            if (!room) {
                return res.status(404).json({ message: 'Room not found' });
            }

            const files = req.files;
            if (!Array.isArray(files) || files.length < 1 || files.length > MAX_SLOTS) {
                return res.status(400).json({ message: 'Provide between 1 and 5 images' });
            }

            const existingSlots = await getExistingSlots(roomId);
            const replaceSlots = parseReplaceSlots(req.query.replaceSlots ?? req.body?.replaceSlots);
            let slots;

            try {
                slots = assignSlots(files.length, existingSlots, replaceSlots);
            } catch (error) {
                if (error.code === 'replace_slots_required') {
                    return res.status(409).json({
                        message: 'Gallery full or insufficient free slots',
                        existingSlots: error.existingSlots ?? [],
                        freeSlots: error.freeSlots ?? [],
                        requiredReplaceSlotsCount: error.requiredReplaceSlotsCount ?? 0,
                    });
                }
                if (
                    error.code === 'invalid_replace_slots' ||
                    error.code === 'replace_slots_mismatch' ||
                    error.code === 'duplicate_replace_slots'
                ) {
                    return res.status(400).json({ message: 'Invalid replace slots' });
                }
                throw error;
            }

            for (let index = 0; index < files.length; index += 1) {
                const file = files[index];
                const slot = slots[index];
                const path = buildSlotPath(roomId, slot);

                const processedBuffer = await sharp(file.buffer)
                    .rotate()
                    .resize({ width: 1600, withoutEnlargement: true })
                    .webp({ quality: 80 })
                    .toBuffer();

                const { error } = await supabase.storage
                    .from('room-images')
                    .upload(path, processedBuffer, {
                        upsert: true,
                        contentType: 'image/webp',
                        cacheControl: '3600',
                    });

                    if (error) {
                        throw new Error('Storage upload failed');
                    }

                const alt = `${room.name} - photo ${slot}`;

                const savedImage = await prisma.roomImage.upsert({
                    where: {
                        roomId_path: {
                            roomId,
                            path,
                        },
                    },
                    update: {
                        bucket: 'room-images',
                        alt,
                        sortOrder: slot,
                        updatedAt: new Date(),
                    },
                    create: {
                        roomId,
                        bucket: 'room-images',
                        path,
                        alt,
                        sortOrder: slot,
                    },
                });
                console.info('RoomImage saved', {
                    roomId,
                    id: savedImage.id,
                    path: savedImage.path,
                    sortOrder: savedImage.sortOrder,
                    updatedAt: savedImage.updatedAt,
                });
            }

            await bumpRoomsCacheVersion();
            try {
                await cleanupRoomStorage(roomId);
            } catch (error) {
                console.warn('Room storage cleanup failed:', error);
            }

            const roomWithImages = await prisma.room.findUnique({
                where: { id: roomId },
                select: {
                    id: true,
                    name: true,
                    address: true,
                    capacity: true,
                    pricePerHour: true,
                    squareMeters: true,
                    description: true,
                    type: true,
                    images: {
                        select: {
                            id: true,
                            bucket: true,
                            path: true,
                            alt: true,
                            sortOrder: true,
                            updatedAt: true,
                        },
                        orderBy: {
                            sortOrder: 'asc',
                        },
                    },
                },
            });

            return res.json({ room: roomWithImages });
        } catch (error) {
            console.error('Upload room images failed:', error);
            return res.status(500).json({ message: 'Failed to upload room images' });
        }
    },

    async importRoomImagesFromUrls(req, res, next) {
        try {
            const roomId = parseInt(req.params.id, 10);
            if (!Number.isInteger(roomId)) {
                return res.status(400).json({ message: 'Invalid room id' });
            }

            const { urls } = req.body ?? {};
            if (!Array.isArray(urls) || urls.length < 1 || urls.length > MAX_SLOTS) {
                return res.status(400).json({ message: 'Provide between 1 and 5 URLs' });
            }

            const room = await prisma.room.findUnique({ where: { id: roomId } });
            if (!room) {
                return res.status(404).json({ message: 'Room not found' });
            }

            const existingSlots = await getExistingSlots(roomId);
            const replaceSlots = parseReplaceSlots(req.query.replaceSlots ?? req.body?.replaceSlots);
            let slots;

            try {
                slots = assignSlots(urls.length, existingSlots, replaceSlots);
            } catch (error) {
                if (error.code === 'replace_slots_required') {
                    return res.status(409).json({
                        message: 'Gallery full or insufficient free slots',
                        existingSlots: error.existingSlots ?? [],
                        freeSlots: error.freeSlots ?? [],
                        requiredReplaceSlotsCount: error.requiredReplaceSlotsCount ?? 0,
                    });
                }
                if (
                    error.code === 'invalid_replace_slots' ||
                    error.code === 'replace_slots_mismatch' ||
                    error.code === 'duplicate_replace_slots'
                ) {
                    return res.status(400).json({ message: 'Invalid replace slots' });
                }
                throw error;
            }

            const results = [];

            for (let index = 0; index < urls.length; index += 1) {
                const url = urls[index];
                const slot = slots[index];
                const path = buildSlotPath(roomId, slot);

                try {
                    let buffer;
                    try {
                        buffer = await fetchWithRedirects(url, TOTAL_TIMEOUT_MS);
                    } catch (error) {
                        const code = error?.code;
                        if (code === 'timeout' || code === 'timeout_ttfb' || code === 'timeout_total') {
                            buffer = await fetchWithRedirects(url, TOTAL_TIMEOUT_RETRY_MS);
                        } else {
                            throw error;
                        }
                    }

                    const processedBuffer = await sharp(buffer)
                        .rotate()
                        .resize({ width: 1600, withoutEnlargement: true })
                        .webp({ quality: 80 })
                        .toBuffer();

                    const { error } = await supabase.storage
                        .from('room-images')
                        .upload(path, processedBuffer, {
                            upsert: true,
                            contentType: 'image/webp',
                            cacheControl: '3600',
                        });

                    if (error) {
                        throw new Error('Storage upload failed');
                    }

                    const alt = `${room.name} - photo ${slot}`;

                    const savedImage = await prisma.roomImage.upsert({
                        where: {
                            roomId_path: {
                                roomId,
                                path,
                            },
                        },
                    update: {
                        bucket: 'room-images',
                        alt,
                        sortOrder: slot,
                        updatedAt: new Date(),
                    },
                    create: {
                        roomId,
                        bucket: 'room-images',
                            path,
                            alt,
                            sortOrder: slot,
                        },
                    });
                    console.info('RoomImage imported', {
                        roomId,
                        id: savedImage.id,
                        path: savedImage.path,
                        sortOrder: savedImage.sortOrder,
                        updatedAt: savedImage.updatedAt,
                    });

                    results.push({ url, status: 'imported', index: slot });
                } catch (error) {
                    console.error('Import image failed:', { url, error });
                    results.push({
                        url,
                        status: 'failed',
                        error: error instanceof Error ? error.message : 'Import failed',
                    });
                }
            }

            await bumpRoomsCacheVersion();
            try {
                await cleanupRoomStorage(roomId);
            } catch (error) {
                console.warn('Room storage cleanup failed:', error);
            }

            const roomWithImages = await prisma.room.findUnique({
                where: { id: roomId },
                select: {
                    id: true,
                    name: true,
                    address: true,
                    capacity: true,
                    pricePerHour: true,
                    squareMeters: true,
                    description: true,
                    type: true,
                    images: {
                        select: {
                            id: true,
                            bucket: true,
                            path: true,
                            alt: true,
                            sortOrder: true,
                            updatedAt: true,
                        },
                        orderBy: {
                            sortOrder: 'asc',
                        },
                    },
                },
            });

            return res.json({ room: roomWithImages, results });
        } catch (error) {
            console.error('Import room images failed:', error);
            return res.status(500).json({ message: 'Failed to import room images' });
        }
    },

    async reorderRoomImages(req, res) {
        try {
            const roomId = parseInt(req.params.id, 10);
            if (!Number.isInteger(roomId)) {
                return res.status(400).json({ message: 'Invalid room id' });
            }

            const { order } = req.body ?? {};
            if (!Array.isArray(order)) {
                return res.status(400).json({ message: 'Order must be an array' });
            }

            const room = await prisma.room.findUnique({
                where: { id: roomId },
                select: { id: true },
            });
            if (!room) {
                return res.status(404).json({ message: 'Room not found' });
            }

            const existingImages = await prisma.roomImage.findMany({
                where: { roomId },
                select: { id: true },
            });

            if (order.length !== existingImages.length) {
                return res.status(400).json({
                    message: `Order must include ${existingImages.length} images`,
                });
            }

            const existingIds = new Set(existingImages.map((image) => image.id));
            const seenIds = new Set();
            const seenOrders = new Set();

            for (const entry of order) {
                const id = Number(entry?.id);
                const sortOrder = Number(entry?.sortOrder);

                if (!Number.isInteger(id) || !Number.isInteger(sortOrder)) {
                    return res.status(400).json({ message: 'Invalid id or sortOrder' });
                }
                if (!existingIds.has(id)) {
                    return res.status(400).json({ message: 'Image id does not belong to this room' });
                }
                if (seenIds.has(id)) {
                    return res.status(400).json({ message: 'Duplicate image id in order' });
                }
                if (sortOrder < 1 || sortOrder > MAX_SLOTS) {
                    return res.status(400).json({ message: 'sortOrder must be between 1 and 5' });
                }
                if (seenOrders.has(sortOrder)) {
                    return res.status(400).json({ message: 'sortOrder values must be unique' });
                }

                seenIds.add(id);
                seenOrders.add(sortOrder);
            }

            await prisma.$transaction(
                order.map(({ id, sortOrder }) =>
                    prisma.roomImage.update({
                        where: { id },
                        data: { sortOrder },
                    })
                )
            );
            console.info('RoomImages reordered', {
                roomId,
                count: order.length,
                ids: order.map(({ id }) => id),
            });

            await bumpRoomsCacheVersion();
            try {
                await cleanupRoomStorage(roomId);
            } catch (error) {
                console.warn('Room storage cleanup failed:', error);
            }

            const roomWithImages = await prisma.room.findUnique({
                where: { id: roomId },
                select: {
                    id: true,
                    name: true,
                    address: true,
                    capacity: true,
                    pricePerHour: true,
                    squareMeters: true,
                    description: true,
                    type: true,
                    images: {
                        select: {
                            id: true,
                            bucket: true,
                            path: true,
                            alt: true,
                            sortOrder: true,
                            updatedAt: true,
                        },
                        orderBy: {
                            sortOrder: 'asc',
                        },
                    },
                },
            });

            return res.json({ room: roomWithImages });
        } catch (error) {
            console.error('Reorder room images failed:', error);
            return res.status(500).json({ message: 'Failed to reorder room images' });
        }
    },

    async deleteRoomImage(req, res) {
        try {
            const roomId = parseInt(req.params.id, 10);
            const imageId = parseInt(req.params.imageId, 10);
            if (!Number.isInteger(roomId) || !Number.isInteger(imageId)) {
                return res.status(400).json({ message: 'Invalid room id or image id' });
            }

            const image = await prisma.roomImage.findFirst({
                where: { id: imageId, roomId },
            });
            if (!image) {
                return res.status(404).json({ message: 'Image not found' });
            }

            const { error } = await supabase.storage
                .from(image.bucket)
                .remove([image.path]);
            if (error) {
                console.warn('Storage delete failed:', error);
            }

            await prisma.roomImage.delete({ where: { id: imageId } });
            console.info('RoomImage deleted', {
                roomId,
                id: imageId,
                path: image.path,
            });

            await bumpRoomsCacheVersion();

            const roomWithImages = await prisma.room.findUnique({
                where: { id: roomId },
                select: {
                    id: true,
                    name: true,
                    address: true,
                    capacity: true,
                    pricePerHour: true,
                    squareMeters: true,
                    description: true,
                    type: true,
                    images: {
                        select: {
                            id: true,
                            bucket: true,
                            path: true,
                            alt: true,
                            sortOrder: true,
                            updatedAt: true,
                        },
                        orderBy: {
                            sortOrder: 'asc',
                        },
                    },
                },
            });

            return res.json({ room: roomWithImages });
        } catch (error) {
            console.error('Delete room image failed:', error);
            return res.status(500).json({ message: 'Failed to delete room image' });
        }
    },

    async updateRoom(req, res, next) {
        try {
            const { id } = req.params;
            const { name, address, capacity, type, pricePerHour, squareMeters, description } = req.body;

            const roomToUpdate = await prisma.room.findUnique({ where: { id: parseInt(id) } });
            if (!roomToUpdate) {
                throw new Error('Room not found');
            }

            await validateRoomInput(
                name,
                address,
                type,
                capacity,
                pricePerHour,
                squareMeters,
                description,
                prisma,
                roomToUpdate.name
            );

            const trimmedName = name.trim();
            const updatedRoom = await prisma.room.update({
                where: {
                    id: parseInt(id),
                },
                data: {
                    name: trimmedName,
                    address: address.trim(),
                    capacity,
                    pricePerHour,
                    squareMeters,
                    description: description.trim(),
                    type,
                },
            });
            await bumpRoomsCacheVersion();

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
            const roomId = parseInt(id);

            const existingBookings = await prisma.booking.count({
                where: { roomId },
            });

            if (existingBookings > 0) {
                return next(new Error('Room has existing bookings'));
            }

            await prisma.room.delete({
                where: {
                    id: roomId,
                },
            });
            await bumpRoomsCacheVersion();

            // Issue deleted room notification
            socketService.emit('Booking Deleted', { roomId: id });

            res.status(204).send(); // No Content
        } catch (error) {
            next(new Error('Error deleting room'));
        }
    },
};

export default roomController;
