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
 * - Routes for user registration and login.
 * - It includes the following functions:
 * - register: Create a new user in the database.
 * - login: Authenticate a user and generate a JWT.
 * - finally: export default authRoutes; 
*-----------------------------------------------------------*/

import express from 'express';
const authRoutes = express.Router();
import authController from '../controllers/authController.js';

authRoutes.post('/user/register', authController.register);
authRoutes.post('/user/login', authController.login);

export default authRoutes;