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

import prisma from '../lib/db.js';
import { hash, compare } from 'bcrypt';
import generateToken from '../utils/generateToken.js';
//import { PrismaClient } from '@prisma/client'; // Import user model
import socketService from '../services/socketService.js';
import dotenv from 'dotenv';

dotenv.config();
const isProduction = process.env.NODE_ENV === 'production';

const getCookieOptions = () => ({
    httpOnly: true,
    sameSite: isProduction ? 'none' : 'lax',
    secure: isProduction,
    maxAge: 60 * 60 * 1000,
    path: '/',
});

//const prisma = new PrismaClient();

const authController = {
    async register(req, res, next) {
        try {
            const { username, password } = req.body;

            // Validate required fields
            if (!username || !password) {
                return next(new Error('Username and password are required')); // Error 400
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
                    role: 'User',
                },
            });

            // Generate a JWT token
            const token = generateToken(newUser);
            res.cookie('token', token, getCookieOptions());

            socketService.emit('New User', {
                message: `${newUser.username} has been created.`,
                Role: newUser.role
            });

            res.status(201).json({
                user: {
                    id: newUser.id,
                    username: newUser.username,
                    role: newUser.role,
                },
            });
        } catch (error) {
            next(new Error('Error registering user')); // Error 500
        }
    },
    async createAdmin(req, res, next) {
        try {
            const { username, password } = req.body;

            if (!username || !password) {
                return next(new Error('Username and password are required')); // Error 400
            }

            const existingUser = await prisma.user.findFirst({
                where: { username },
            });

            if (existingUser) {
                return next(new Error('User already exists')); // Error 400
            }

            const hashedPassword = await hash(password, 10);

            const newAdmin = await prisma.user.create({
                data: {
                    username,
                    password: hashedPassword,
                    role: 'Admin',
                },
            });

            socketService.emit('New User', {
                message: `${newAdmin.username} has been created.`,
                Role: newAdmin.role
            });

            res.status(201).json({
                user: {
                    id: newAdmin.id,
                    username: newAdmin.username,
                    role: newAdmin.role,
                },
            });
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
            res.cookie('token', token, getCookieOptions());

            // Emit a message when a user logs in
            socketService.emit("userLoggedIn", {
                message: `${user.username} has logged in.`,
                userId: user.id,
            });

            res.json({
                user: {
                    id: user.id,
                    username: user.username,
                    role: user.role,
                },
            });
        } catch (error) {
            next(new Error('Error logging in')); // Error 500
        }
    },
    async logout(req, res) {
        res.clearCookie('token', getCookieOptions());
        res.status(204).send();
    },
    async me(req, res) {
        res.json({
            user: {
                id: req.user.id,
                username: req.user.username,
                role: req.user.role,
            },
        });
    },
};

export default authController;  
