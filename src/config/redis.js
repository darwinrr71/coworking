/**---------------------------------------------------------
 * Project: COWORKING PLATFORM
 * Developer Full Stack: Darwin Rengifo
 * 
 *      Create Date: 2025-02-10
 *      Design Name: authRoutes.js
 *            Tools: Javascript, NodeJs, Express, Prisma, Postgres(In Supabase),
 *                   JWT, BCRYPT, Redis, Socket.io
 *        Path Name: < src/routes/authRoutes.js >
 * 
 * Description:
 * - redisClient: Create a connection to the Redis server.
 * - It includes the following functions:
 * - redisClient.on('connect'): Show a message when connected to Redis.
 * - redisClient.on('error'): Show an error message when there is an error.
 * - finally: export default redisClient; 
*-----------------------------------------------------------*/
import redis from 'redis';
import dotenv from 'dotenv';
dotenv.config();

const redisUrl = process.env.REDIS_URL || '127.0.0.1';

if (!redisUrl) {
    console.error("Error: REDIS_URL (or REDIS_HOST) is not defined.");
    process.exit(1);
}

const redisClient = redis.createClient({
    url: redisUrl,
});

redisClient.on('connect', () => console.log('Connected to Redis'));
redisClient.on('error', (err) => console.log('Redis Client Error', err));

redisClient.connect();

export default redisClient;