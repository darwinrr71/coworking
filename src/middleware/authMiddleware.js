/**---------------------------------------------------------
 * Project: COWORKING PLATFORM
 * Developer Full Stack: Darwin Rengifo
 * 
 *      Create Date: 2025-02-10
 *      Design Name: authMiddleware.js
 *            Tools: Javascript, NodeJs, Express, Prisma, Postgres(In Supabase),
 *                   JWT, BCRYPT
 *        Path Name: < src/middleware/authMiddleware.js >
 * 
 * Description:
 * - Middleware to authenticate and authorize users.
 * - The authenticate method verifies the token in the request header.
 * - The authorize method checks if the user has the required role.
 * - The authenticate method is used to protect routes.
*-----------------------------------------------------------*/

import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET;

const prisma = new PrismaClient();

const authMiddleware = {
    authenticate(req, res, next) {

        /** Req.headers contains all the application headers.
            Authorization is the header where the token JWT is normally sent in protected applications. 
        **/
        const authHeader = req.headers.authorization;

        /** Verify if authheader does not exist or is empty (! Authheader)
            If the header Authorization is not present in the application, it means that the client did not send a token jwt.
            A 401 error (unauthorized) is returned. 
        **/
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const token = authHeader.substring(7);

        /** Jwt.verify: verifies and decodes the token jwt.
            Token: the token jwt that was extracted from header authorization.
            Jwt_secret: the secret key used to sign the token; It is necessary to verify its validity.
        **/
        jwt.verify(token, JWT_SECRET, async (err, decoded) => {
            if (err) {
                return res.status(401).json({ message: 'Invalid token' });
            }

            try {
                const user = await prisma.user.findUnique({
                    where: { id: decoded.userId },
                });

                if (!user) {
                    return res.status(401).json({ message: 'User not found' });
                }

                req.user = user;
                next();
            } catch (error) {
                console.error(error);
                return res.status(500).json({ message: 'Failed to authenticate' });
            }
        });
    },

    authorize(roles) {
        return (req, res, next) => {
            // Verify if the user's role is in the array roles.
            if (!roles.includes(req.user.role)) {
                return res.status(403).json({ message: 'You do not have permissions' });
            }
            next();
        };
    },
};

export default authMiddleware;