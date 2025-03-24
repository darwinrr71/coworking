/**---------------------------------------------------------
 * Project: COWORKING PLATFORM
 * Developer Full Stack: Darwin Rengifo
 * 
 *      Create Date: 2025-02-08
 *      Design Name: authController.js
 *            Tools: Javascript, NodeJs, Express, Prisma, Postgres(In Supabase),
 *                   JWT, BCRYPT, Redis, Socket.io
 *        Path Name: < src/controllers/authController.js >
 * Description:
* - Create a new user in the database.
* - Login a user.
* - Hash the password.
* - Compare the password.
* - Generate a JWT token.
*-----------------------------------------------------------*/

import { hash, compare } from 'bcrypt';
import generateToken from '../utils/generateToken.js';
import { PrismaClient } from '@prisma/client'; // Import user model
import socketService from '../services/socketService.js';

const prisma = new PrismaClient();

const authController = {
    async register(req, res, next) {
        try {
            const { username, password, role } = req.body;

            // Validate required fields
            if (!username || !password || !role) {
                return next(new Error('Username, password, and role are required')); // Error 400
            }

            // Check if the user already exists
            const existingUser = await prisma.user.findFirst({
                where: { username },
            });

            if (existingUser) {
                return next(new Error('User already exists')); // Error 400
            }

            // Hash password
            const hashedPassword = await hash(password, 10);

            // Create user in the database
            const newUser = await prisma.user.create({
                data: {
                    username,
                    password: hashedPassword,
                    role,
                },
            });

            // Generate a JWT token
            const token = generateToken(newUser);

            res.status(201).json({ token });
        } catch (error) {
            next(new Error('Error registering user')); // Error 500
        }
    },

    async login(req, res, next) {
        try {
            const { username, password } = req.body;

            // Find user by username
            const user = await prisma.user.findFirst({
                where: {
                    username: username,
                },
            });

            if (!user) {
                return next(new Error('Invalid credentials')); // Error 401
            }

            // Compare password
            const passwordMatch = await compare(password, user.password);

            if (!passwordMatch) {
                return next(new Error('Invalid credentials')); // Error 401
            }

            // Geerate a JWT token
            const token = generateToken(user);

            // Emit a message when a user logs in
            socketService.emit("userLoggedIn", {
                message: `${user.username} has logged in.`,
                userId: user.id,
            });

            res.json({ token });
        } catch (error) {
            next(new Error('Error logging in')); // Error 500
        }
    },
};

export default authController;  