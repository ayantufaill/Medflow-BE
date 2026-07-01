import { Router } from 'express';
import { roleController } from '../controllers/role.controller';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { body } from 'express-validator';

const router = Router();

// All permission routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /permissions/check:
 *   post:
 *     summary: Check if user has a specific permission
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - permission
 *             properties:
 *               permission:
 *                 type: string
 *                 example: appointments.create
 *                 description: Permission name to check
 *               userId:
 *                 type: string
 *                 description: User ID (optional, defaults to current user)
 *     responses:
 *       200:
 *         description: Permission check result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     hasPermission:
 *                       type: boolean
 *                     permission:
 *                       type: string
 *       401:
 *         description: Unauthorized
 *       400:
 *         description: Permission is required
 */
router.post(
  '/check',
  validate([
    body('permission')
      .trim()
      .notEmpty()
      .withMessage('Permission is required')
      .isString()
      .withMessage('Permission must be a string'),
    body('userId').optional().isString().trim().withMessage('User ID must be a string'),
  ]),
  roleController.checkPermission.bind(roleController)
);

/**
 * @swagger
 * /permissions/matrix:
 *   get:
 *     summary: Get permissions matrix (Admin only)
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Role-permission map
 *       403:
 *         description: Forbidden
 */
router.get(
  '/matrix',
  requireRoles('Admin'),
  roleController.getPermissionMatrix.bind(roleController)
);

export default router;