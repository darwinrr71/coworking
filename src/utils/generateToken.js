/**---------------------------------------------------------
 * Project: COWORKING PLATFORM
 * Developer Full Stack: Darwin Rengifo
 * 
 *      Create Date: 2025-02-08
 *      Design Name: authController.js
 *            Tools: Javascript, NodeJs, Express, Prisma, Postgres(In Supabase),
 *                   JWT, BCRYPT, Redis, Socket.io
 *        Path Name: < src/controllers/authController.js >
 * 
 * Description:
 * - This code uses the jwt.sign() function from the jsonwebtoken library to generate a 
 *   JSON Web Token (JWT). This token is an encoded text string that serves to 
 *   authenticate the user in future requests.
*-----------------------------------------------------------*/
//import { sign } from 'jsonwebtoken';
import pkg from 'jsonwebtoken';
const { sign } = pkg;
import dotenv from 'dotenv';
//import { JWT_SECRET } from '../config/config';
dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET;

const generateToken = (user) => {
    return sign(
        { userId: user.id, role: user.role },  // Payload token
        JWT_SECRET,                             // Password
        { expiresIn: '1h' }                     // Time to expire
    );
};

export default generateToken;