import { Router } from 'express';
import { roleController } from '../controllers/role.controller';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validation.middleware';
import { body, param, query } from 'express-validator';

const router = Router();

// All role routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /roles:
 *   get:
 *     summary: Get all roles (Admin only)
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *         description: Items per page
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search by role name
 *     responses:
 *       200:
 *         description: List of roles
 *       403:
 *         description: Admin only
 */
router.get(
  '/',
  requireRoles('Admin'),
  validate([
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('search').optional().isString().trim(),
  ]),
  roleController.getAllRoles.bind(roleController)
);

/**
 * @swagger
 * /roles/{roleId}:
 *   get:
 *     summary: Get role by ID (Admin only)
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Role details
 *       403:
 *         description: Admin only
 *       404:
 *         description: Role not found
 */
router.get(
  '/:roleId',
  requireRoles('Admin'),
  validate([
    param('roleId').isString().trim().notEmpty().withMessage('Role ID is required'),
  ]),
  roleController.getRoleById.bind(roleController)
);

/**
 * @swagger
 * /roles:
 *   post:
 *     summary: Create new role (Admin only)
 *     tags: [Roles]
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
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 50
 *                 example: Billing Manager
 *               description:
 *                 type: string
 *                 example: Manages billing operations
 *               permissions:
 *                 type: object
 *                 description: Object with permission keys
 *               isSystemRole:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       201:
 *         description: Role created
 *       403:
 *         description: Admin only
 *       409:
 *         description: Role name already exists
 */
router.post(
  '/',
  requireRoles('Admin'),
  requirePermission('roles.create'),
  validate([
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Role name is required')
      .isLength({ min: 2, max: 50 })
      .withMessage('Role name must be between 2 and 50 characters'),
    body('description').optional().isString().trim(),
    body('permissions').optional().isObject().withMessage('Permissions must be an object'),
    body('isSystemRole').optional().isBoolean().withMessage('isSystemRole must be a boolean'),
  ]),
  roleController.createRole.bind(roleController)
);

/**
 * @swagger
 * /roles/{roleId}:
 *   put:
 *     summary: Update role (Admin only)
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 50
 *               description:
 *                 type: string
 *               permissions:
 *                 type: object
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Role updated
 *       403:
 *         description: Admin only
 *       404:
 *         description: Role not found
 *       409:
 *         description: Role name already exists
 */
router.put(
  '/:roleId',
  requireRoles('Admin'),
  requirePermission('roles.update'),
  validate([
    param('roleId').isString().trim().notEmpty().withMessage('Role ID is required'),
    body('name').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Role name must be between 2 and 50 characters'),
    body('description').optional().isString().trim(),
    body('permissions').optional().isObject().withMessage('Permissions must be an object'),
    body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  ]),
  roleController.updateRole.bind(roleController)
);

/**
 * @swagger
 * /roles/{roleId}:
 *   delete:
 *     summary: Delete role (Admin only)
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Role deleted
 *       403:
 *         description: Admin only
 *       404:
 *         description: Role not found
 *       400:
 *         description: Cannot delete system role or role with users assigned
 */
router.delete(
  '/:roleId',
  requireRoles('Admin'),
  requirePermission('roles.delete'),
  validate([
    param('roleId').isString().trim().notEmpty().withMessage('Role ID is required'),
  ]),
  roleController.deleteRole.bind(roleController)
);

/**
 * @swagger
 * /roles/{roleId}/users:
 *   get:
 *     summary: Get users with a specific role (Admin only)
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *         description: Items per page
 *     responses:
 *       200:
 *         description: List of users with this role
 *       403:
 *         description: Admin only
 *       404:
 *         description: Role not found
 */
router.get(
  '/:roleId/users',
  requireRoles('Admin'),
  validate([
    param('roleId').isString().trim().notEmpty().withMessage('Role ID is required'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  ]),
  roleController.getUsersWithRole.bind(roleController)
);

export default router;