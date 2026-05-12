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

/**
 * @swagger
 * /rooms:
 *   get:
 *     summary: Get all rooms
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: clinicId
 *         schema: { type: integer }
 *       - in: query
 *         name: isAvailable
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: List of rooms
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/',
  validate(roomQueryValidator),
  roomController.getAllRooms.bind(roomController)
);

/**
 * @swagger
 * /rooms/{roomId}:
 *   get:
 *     summary: Get room by ID
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Room details
 *       404:
 *         description: Room not found
 */
router.get(
  '/:roomId',
  validate(roomIdValidator),
  roomController.getRoomById.bind(roomController)
);

/**
 * @swagger
 * /rooms:
 *   post:
 *     summary: Create new room (Admin only)
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - clinicId
 *             properties:
 *               name:
 *                 type: string
 *               roomNumber:
 *                 type: string
 *               clinicId:
 *                 type: integer
 *               type:
 *                 type: string
 *                 enum: [exam, surgery, consultation, hygiene]
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Room created
 *       403:
 *         description: Admin only
 */
router.post(
  '/',
  requireRoles('Admin'),
  validate(createRoomValidator),
  roomController.createRoom.bind(roomController)
);

/**
 * @swagger
 * /rooms/{roomId}:
 *   put:
 *     summary: Update room (Admin only)
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               roomNumber:
 *                 type: string
 *               type:
 *                 type: string
 *               notes:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Room updated
 *       403:
 *         description: Admin only
 *       404:
 *         description: Room not found
 */
router.put(
  '/:roomId',
  requireRoles('Admin'),
  validate([...roomIdValidator, ...updateRoomValidator]),
  roomController.updateRoom.bind(roomController)
);

/**
 * @swagger
 * /rooms/{roomId}:
 *   delete:
 *     summary: Delete room (Admin only)
 *     tags: [Rooms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Room deleted
 *       403:
 *         description: Admin only
 *       404:
 *         description: Room not found
 */
router.delete(
  '/:roomId',
  requireRoles('Admin'),
  validate(roomIdValidator),
  roomController.deleteRoom.bind(roomController)
);

export default router;