/**---------------------------------------------------------
 * Project: COWORKING PLATFORM
 * Developer Full Stack: Darwin Rengifo
 * 
 *      Create Date: 2025-02-15
 *      Design Name: errorHandler.js
 *            Tools: Javascript, NodeJs, Express, Prisma, Postgres(In Supabase),
 *                   JWT, BCRYPT, Redis, Socket.io
 *        Path Name: < src/middleware/errorHandler.js >
 * 
 * Description:
 * - errorHandler is a middleware function that catches errors thrown by the application
 *  and sends an appropriate response to the client.
 * - It includes the following functions:
 * - errorHandler: Catch and handle errors thrown by the application.
*-----------------------------------------------------------*/

import logger from "../utils/logger.js";
import socketService from '../services/socketService.js';

const errorHandler = (err, req, res, next) => {
    // Map error messages to HTTP status codes and messages
    const messageMap = {

        /** authController.js */
        'Username, password, and role are required': { status: 400, message: 'Bad Request: Username, password, and role are required' },
        'Username and password are required': { status: 400, message: 'Bad Request: Username and password are required' },
        'User already exists': { status: 400, message: 'Bad Request: A user with this username already exists' },
        'Invalid credentials': { status: 401, message: 'Unauthorized: Invalid username or password' },
        'Error registering user': { status: 500, message: 'Internal Server Error: An unexpected error occurred while registering the user' },
        'Error logging in': { status: 500, message: 'Internal Server Error: An unexpected error occurred while logging in' },

        /** authMiddleware.js */
        'Unauthorized': { status: 401, message: 'Unauthorized: No valid token provided' },
        'Invalid token': { status: 401, message: 'Unauthorized: The provided token is invalid or expired' },
        'User not found': { status: 401, message: 'Unauthorized: User not found in the system' },
        'Failed to authenticate': { status: 500, message: 'Internal Server Error: Authentication process failed' },
        'You do not have permissions': { status: 403, message: 'Forbidden: You do not have the necessary permissions' },

        /** roomController.js  */
        'Name and type are required': { status: 400, message: 'Bad Request - Room: Both name and type are required' },
        'Capacity must be a positive integer': { status: 400, message: 'Bad Request - Room: Capacity must be a positive integer greater than 0' },
        'Price per hour must be a positive integer': { status: 400, message: 'Bad Request - Room: Price per hour must be a positive integer greater than 0' },
        'Square meters must be a positive integer': { status: 400, message: 'Bad Request - Room: Square meters must be a positive integer greater than 0' },
        'Description is required': { status: 400, message: 'Bad Request - Room: Description is required' },
        'Address is required': { status: 400, message: 'Bad Request - Room: Address is required' },
        'A room with this name already exists': { status: 400, message: 'Bad Request - Room: A room with that name already exists' },
        'Error updating room': { status: 400, message: 'Bad Request - Room: Update failed. Ensure the data is correct.' },
        'Room not found': { status: 404, message: 'The specified room does not exist.' },
        'Room has existing bookings': { status: 409, message: 'Conflict - Room: Cannot delete a room with existing bookings.' },
        'Error creating room': { status: 500, message: 'An unexpected error occurred while creating the room' },
        'Error getting rooms': { status: 500, message: 'An unexpected error occurred. Could not retrieve room list. Please try again later.' },
        'Error deleting room': { status: 500, message: 'An unexpected error occurred. Error deleting room. Please review your input or try again later.' },

        /** booknngController.js */
        'roomId must be a positive integer': { status: 400, message: 'Bad Request - Booking: roomId must be a positive integer greater than 0' },
        'Start and end time are required': { status: 400, message: 'Bad Request - Booking: Both start and end times are required' },
        'startTime and endTime cannot be empty': { status: 400, message: 'Bad Request - Booking: Start and end times cannot be empty' },
        'endTime must be after startTime': { status: 400, message: 'Bad Request - Booking: endTime must be after startTime' },
        'Room is not available at this time': { status: 400, message: 'Bad Request - Booking: The room is not available at the requested time' },
        'RoomId does not exist': { status: 400, message: 'Bad Request - Booking: The room has not been created in the Room table.' },
        'Booking not found': { status: 400, message: 'Bad Request - Booking: Booking not found. Please review your input or try again later.' },
        'Minutes must be 00': { status: 400, message: 'Bad Request - Booking: Minutes must be 00.' },
        'Time must be between 08 and 22': { status: 400, message: 'Bad Request - Booking: Time must be between 08 and 22.' },
        'Intervals are required': { status: 400, message: 'Bad Request - Booking: Intervals are required.' },
        'Invalid intervals payload': { status: 400, message: 'Bad Request - Booking: Invalid intervals payload.' },
        'Invalid interval date': { status: 400, message: 'Bad Request - Booking: Invalid interval date.' },
        'Invalid interval range': { status: 400, message: 'Bad Request - Booking: Invalid interval range.' },
        'Invalid availability range': { status: 400, message: 'Bad Request - Booking: Invalid availability range.' },
        'Invalid roomIds': { status: 400, message: 'Bad Request - Booking: Invalid roomIds.' },
        'Error creating booking': { status: 500, message: 'An unexpected error occurred while creating the booking' },
        'Error getting bookings': { status: 500, message: 'An unexpected error occurred. Could not retrieve bookings list. Please try again later.' },
        'Error deleting booking': { status: 500, message: 'An unexpected error occurred. Error deleting booking. Please review your input or try again later.' },
    };

    // Find the message on the map or return a generic error message
    const response = messageMap[err.message] || { status: 500, message: 'An unexpected error occurred.' };

    // Records system activity

    socketService.emit('System activity', { status: response.status, message: response.message });

    if (response.status === 401) {
        // Errores 401 se registran como 'warn'
        logger.warn({
            status: response.status,
            message: response.message,
            requestUrl: req.originalUrl,
        });
    } else if (response.status >= 500) {
        // Errores 500 se registran como 'error'
        logger.error({
            status: response.status,
            message: response.message,
            requestUrl: req.originalUrl,
        });
    } else {
        // Errores 400 se registran como 'warn'
        logger.warn({
            status: response.status,
            message: response.message,
            requestUrl: req.originalUrl,
        });
    }

    res.status(response.status).json({ message: response.message });
};

export default errorHandler;
