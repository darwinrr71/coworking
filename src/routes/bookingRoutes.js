/**---------------------------------------------------------
 * Project: COWORKING PLATFORM
 * Developer Full Stack: Darwin Rengifo
 * 
 *      Create Date: 2025-02-10
 *      Design Name: bookingRoutes.js
 *            Tools: Javascript, NodeJs, Express, Prisma, Postgres(In Supabase),
 *                   JWT, BCRYPT, Redis, Socket.io
 *        Path Name: < src/routes/bookingRoutes.js >
 * 
 * Description:
 * - Routes for creating a booking, getting all bookings,
 *   updating a booking, and deleting a booking.
 * - authMiddleware.authenticate: Middleware function to authenticate requests.
*-----------------------------------------------------------*/

import express from 'express';
const router = express.Router();
import bookingController from '../controllers/bookingController.js';
import authMiddleware from '../middleware/authMiddleware.js';

router.post('/bookning/create', authMiddleware.authenticate, bookingController.createBooking);
router.get('/bookning/allbookning', authMiddleware.authenticate, bookingController.getUserBookings);
router.put('/bookning/update/:id', authMiddleware.authenticate, bookingController.updateBooking);
router.delete('/bookning/delete/:id', authMiddleware.authenticate, bookingController.deleteBooking);

export default router;