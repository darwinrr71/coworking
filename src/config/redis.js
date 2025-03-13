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