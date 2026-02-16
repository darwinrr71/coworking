/**---------------------------------------------------------
 * Project: COWORKING PLATFORM
 * Developer Full Stack: Darwin Rengifo
 * 
 *      Create Date: 2025-02-08
 *      Design Name: index.js
 *            Tools: Javascript, NodeJs, Express, Prisma, Postgres(In Supabase),
 *                   JWT, BCRYPT
 *        Path Name: < coworking-platform/index.js >
 * 
 * Description:
 * - This file is the entry point for the server.
 * - It sets up the server and connects to the database.
 * - It also defines the routes for the application.
 * - Finally, it listens on a port for incoming requests.
 * - The server is created using Express.js and Socket.IO.
 * - The database is connected using Prisma.
 * - The routes are defined in separate files.
 * - The server listens on port 5000 by default.
 * - The server emits an event every 10 seconds using Socket.IO.
 * - The server logs the response time for each request.
 * - The server uses Helmet, and Morgan for security and logging.
 * - The server uses Helmet to set security headers.
 * - The server uses Morgan to log HTTP requests in the console.
 * - The server uses error handling middleware to handle errors.
 * - The server uses dotenv to load environment variables.
 * - The server uses HTTP to create the server instance.
 * - The server uses Express to handle requests and responses.
 * - The server uses Socket.IO to enable real-time communication.
 * - The server uses response-time to log response times.
*-----------------------------------------------------------*/

import express from 'express';
import authRoutes from './src/routes/authRoutes.js';
import roomRoutes from './src/routes/roomRoutes.js';
import bookingRoutes from './src/routes/bookingRoutes.js';
import socketService from './src/services/socketService.js';
import errorHandler from './src/middleware/errorHandler.js';
import responseTime from 'response-time';
import http from 'http';
import helmet from 'helmet';
import dotenv from 'dotenv';
import morgan from 'morgan';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import supabase from './src/lib/supabase.js';

dotenv.config();

const PORT = process.env.PORT || 4000;
const rawOrigins = process.env.CORS_ORIGIN || 'http://localhost:7000';
const allowedOrigins = rawOrigins.split(',').map((origin) => origin.trim()).filter(Boolean);

const app = express();
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.use(express.json())
app.use(responseTime());

/**
 * Helmet: Helps protect your application by setting secure HTTP headers. 
 * Prevents attacks such as clickjacking, XSS (Cross-Site Scripting), 
 * and content sniffing. 
 */
app.use(helmet());

/**
 * Morgan: This is a logging that records HTTP requests to the console. 
 * It's useful for debugging and monitoring.
 */
app.use(morgan('dev'));

app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use("/api", authRoutes);
app.use("/api", roomRoutes);
app.use("/api", bookingRoutes);
app.use(errorHandler);

const server = http.createServer(app);
socketService.init(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

app.get('/', (req, res) => {
  res.send('Server with Node js, Express and Socket.IO running');
});


// Emits an event every 10 seconds
setInterval(() => {
  socketService.emit("Socket.io", { message: "Update from server", timestamp: new Date() });
}, 10000);

async function ensureRoomImagesBucket() {
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    if (error) {
      console.warn('Supabase listBuckets failed:', error.message);
      return;
    }
    const exists = (buckets ?? []).some((bucket) => bucket.name === 'room-images');
    if (exists) {
      return;
    }
    const { error: createError } = await supabase.storage.createBucket('room-images', {
      public: true,
    });
    if (createError && createError.statusCode !== 409) {
      console.warn('Supabase createBucket failed:', createError.message);
    }
  } catch (error) {
    console.warn('Supabase bucket ensure failed:', error?.message ?? error);
  }
}

async function startServer() {
  await ensureRoomImagesBucket();
  server.listen(PORT, () =>
    console.log(`The server is running on port:${PORT}`)
  );
}

startServer();
