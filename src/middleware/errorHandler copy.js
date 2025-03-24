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

const errorHandler = (err, req, res, next) => {
    // Map error messages to HTTP status codes and messages
    const messageMap = {

        /** Room  */
        'Name and type are required': { status: 400, message: 'Bad Request - Room: Both name and type are required' },
        'Capacity must be a positive integer': { status: 400, message: 'Bad Request - Room: Capacity must be a positive integer greater than 0' },
        'A room with this name already exists': { status: 400, message: 'Bad Request - Room: A room with that name already exists' },
        'Error updating room': { status: 400, message: 'Bad Request - Room: Update failed. Ensure the data is correct.' },
        'Room not found': { status: 404, message: 'The specified room does not exist.' },
        'Error creating room': { status: 500, message: 'An unexpected error occurred while creating the room' },
        'Error getting rooms': { status: 500, message: 'An unexpected error occurred. Could not retrieve room list. Please try again later.' },
        'Error deleting room': { status: 500, message: 'An unexpected error occurred. Error deleting room. Please review your input or try again later.' },

        /** Booknng */
        'roomId must be a positive integer': { status: 400, message: 'Bad Request - Booking: roomId must be a positive integer greater than 0' },
        'Start and end time are required': { status: 400, message: 'Bad Request - Booking: Both start and end times are required' },
        'startTime and endTime cannot be empty': { status: 400, message: 'Bad Request - Booking: Start and end times cannot be empty' },
        'endTime must be after startTime': { status: 400, message: 'Bad Request - Booking: endTime must be after startTime' },
        'Room is not available at this time': { status: 400, message: 'Bad Request - Booking: The room is not available at the requested time' },
        'RoomId does not exist': { status: 400, message: 'Bad Request - Booking: The room has not been created in the Room table.' },
        'Booking not found': { status: 400, message: 'Bad Request - Booking: Booking not found. Please review your input or try again later.' },
        'Error creating booking': { status: 500, message: 'An unexpected error occurred while creating the booking' },
        'Error getting bookings': { status: 500, message: 'An unexpected error occurred. Could not retrieve bookings list. Please try again later.' },
        'Error deleting booking': { status: 500, message: 'An unexpected error occurred. Error deleting booking. Please review your input or try again later.' },
    };

    // Find the message on the map or return a generic error message
    const response = messageMap[err.message] || { status: 500, message: 'An unexpected error occurred.' };

    // Registra el error en el archivo de logs

    if (response.status === 401) {
        // Errores 401 se registran como 'warn'
        logger.warn({
            status: response.status,
            message: response.message,
            /*message: err.message,
            stack: err.stack,
            status: response.status,
            requestUrl: req.originalUrl,
            requestMethod: req.method,*/
        });
    } else if (response.status >= 500) {
        // Errores 500 se registran como 'error'
        logger.error({
            message: err.message,
            stack: err.stack,
            status: response.status,
            requestUrl: req.originalUrl,
            requestMethod: req.method,
        });
    } else {
        // Errores 400 se registran como 'warn'
        logger.warn({
            message: err.message,
            stack: err.stack,
            status: response.status,
            requestUrl: req.originalUrl,
            requestMethod: req.method,
        });
    }

    res.status(response.status).json({ message: response.message });
};

export default errorHandler;