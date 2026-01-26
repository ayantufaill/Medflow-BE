import { Router } from 'express';
import { roomController } from '../controllers/room.controller';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  roomIdValidator,
  createRoomValidator,
  updateRoomValidator,
  roomQueryValidator,
} from '../validators/room.validator';

const router = Router();

// All room routes require authentication
router.use(authenticate);

// Get all rooms
router.get(
  '/',
  validate(roomQueryValidator),
  roomController.getAllRooms.bind(roomController)
);

// Get room by ID
router.get(
  '/:roomId',
  validate(roomIdValidator),
  roomController.getRoomById.bind(roomController)
);

// Create room (Admin only)
router.post(
  '/',
  requireRoles('Admin'),
  validate(createRoomValidator),
  roomController.createRoom.bind(roomController)
);

// Update room (Admin only)
router.put(
  '/:roomId',
  requireRoles('Admin'),
  validate([...roomIdValidator, ...updateRoomValidator]),
  roomController.updateRoom.bind(roomController)
);

// Delete room (Admin only)
router.delete(
  '/:roomId',
  requireRoles('Admin'),
  validate(roomIdValidator),
  roomController.deleteRoom.bind(roomController)
);

export default router;

