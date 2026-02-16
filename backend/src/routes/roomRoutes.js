/**---------------------------------------------------------
 * Project: COWORKING PLATFORM
 * Developer Full Stack: Darwin Rengifo
 * 
 *      Create Date: 2025-02-10
 *      Design Name: roomRoutes.js
 *            Tools: Javascript, NodeJs, Express, Prisma, Postgres(In Supabase),
 *                   JWT, BCRYPT, Redis, Socket.io
 *        Path Name: < src/routes/roomRoutes.js >
 * 
 * Description:
 * - Routes for creating a room, getting all rooms, 
 *   updating a room, and deleting a room.
*-----------------------------------------------------------*/

import express from 'express';
import multer from 'multer';
const roomRoutes = express.Router();
import roomController from '../controllers/roomController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 5,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error('Only JPG, PNG, or WEBP images are allowed'));
    }
    return cb(null, true);
  },
});

const handleRoomImageUpload = (req, res, next) => {
  upload.array('images', 5)(req, res, (err) => {
    if (!err) {
      return next();
    }
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'Each image must be 10MB or less' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ message: 'Max 5 images allowed' });
    }
    return res.status(400).json({ message: err.message || 'Invalid upload' });
  });
};

roomRoutes.post('/room/create', authMiddleware.authenticate, authMiddleware.authorize(['Admin']), roomController.createRoom);
roomRoutes.get('/rooms', roomController.getAllRooms);
roomRoutes.get('/rooms/:id', roomController.getRoomById);
roomRoutes.post(
  '/rooms/:id/images/upload',
  authMiddleware.authenticate,
  authMiddleware.authorize(['Admin']),
  handleRoomImageUpload,
  roomController.uploadRoomImages
);
roomRoutes.post(
  '/rooms/:id/images/import-url',
  authMiddleware.authenticate,
  authMiddleware.authorize(['Admin']),
  roomController.importRoomImagesFromUrls
);
roomRoutes.patch(
  '/rooms/:id/images/reorder',
  authMiddleware.authenticate,
  authMiddleware.authorize(['Admin']),
  roomController.reorderRoomImages
);
roomRoutes.delete(
  '/rooms/:id/images/:imageId',
  authMiddleware.authenticate,
  authMiddleware.authorize(['Admin']),
  roomController.deleteRoomImage
);
roomRoutes.put('/room/update/:id', authMiddleware.authenticate, authMiddleware.authorize(['Admin']), roomController.updateRoom);
roomRoutes.delete('/room/delete/:id', authMiddleware.authenticate, authMiddleware.authorize(['Admin']), roomController.deleteRoom);

export default roomRoutes;
