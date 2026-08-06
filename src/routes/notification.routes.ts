import { Router } from 'express';
import { notificationController } from '../controllers/notification.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { notificationIdValidator, notificationQueryValidator } from '../validators/notification.validator';

const router = Router();
router.use(authenticate);

/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: Get the current staff user's notifications
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: List of notifications retrieved successfully
 *       401:
 *         description: Unauthorized - invalid or missing token
 */
router.get('/', validate(notificationQueryValidator), notificationController.getMyNotifications.bind(notificationController));

/**
 * @swagger
 * /notifications/unread-count:
 *   get:
 *     summary: Get the current staff user's unread notification count
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unread count retrieved successfully
 *       401:
 *         description: Unauthorized - invalid or missing token
 */
router.get('/unread-count', notificationController.getUnreadCount.bind(notificationController));

/**
 * @swagger
 * /notifications/mark-all-read:
 *   patch:
 *     summary: Mark all of the current staff user's notifications as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read
 *       401:
 *         description: Unauthorized - invalid or missing token
 */
router.patch('/mark-all-read', notificationController.markAllAsRead.bind(notificationController));

/**
 * @swagger
 * /notifications/{notificationId}/read:
 *   patch:
 *     summary: Mark a single notification as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Notification marked as read
 *       401:
 *         description: Unauthorized - invalid or missing token
 *       404:
 *         description: Notification not found
 */
router.patch(
  '/:notificationId/read',
  validate(notificationIdValidator),
  notificationController.markAsRead.bind(notificationController)
);

export default router;
