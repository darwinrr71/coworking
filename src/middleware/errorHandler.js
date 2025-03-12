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

const errorHandler = (err, req, res, next) => {
    console.error('Error:', err.message);

    // Mapeo de mensajes de error con su respectivo código de estado y mensaje de respuesta
    const messageMap = {
        'Error creating room': { status: 400, message: 'Room creation failed. Please check your input.' },
        'Error getting rooms': { status: 500, message: 'Could not retrieve room list. Please try again later.' },
        'Error updating room': { status: 400, message: 'Room update failed. Ensure the data is correct.' },
        'Room not found': { status: 404, message: 'The specified room does not exist.' },
        'Error deleting room': { status: 500, message: 'Room deletion failed. Please try again later.' },
    };

    // Find the message on the map or return a generic error message
    const response = messageMap[err.message] || { status: 500, message: 'An unexpected error occurred.' };

    res.status(response.status).json({ message: response.message });
};

export default errorHandler;