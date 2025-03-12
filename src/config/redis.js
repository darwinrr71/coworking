import redis from 'redis';
import dotenv from 'dotenv';
dotenv.config();

const redisClient = redis.createClient({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
});

redisClient.on('connect', () => console.log('Connected to Redis'));
redisClient.on('error', (err) => console.log('Redis Client Error', err));

redisClient.connect();

export default redisClient;
