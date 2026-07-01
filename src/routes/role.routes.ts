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
 * components:
 *   schemas:
 *     Role:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "role_123"
 *         name:
 *           type: string
 *           example: "Billing Manager"
 *         description:
 *           type: string
 *           example: "Manages billing operations"
 *         permissions:
 *           type: object
 *           additionalProperties:
 *             type: boolean
 *         isSystemRole:
 *           type: boolean
 *           example: false
 *         isActive:
 *           type: boolean
 *           example: true
 *         userCount:
 *           type: integer
 *           example: 5
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     
 *     RoleListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           properties:
 *             roles:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Role'
 *             pagination:
 *               type: object
 *               properties:
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 total:
 *                   type: integer
 *                 pages:
 *                   type: integer
 *     
 *     RoleSingleResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           properties:
 *             role:
 *               $ref: '#/components/schemas/Role'
 *     
 *     RoleUsersResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           properties:
 *             users:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   email:
 *                     type: string
 *                   firstName:
 *                     type: string
 *                   lastName:
 *                     type: string
 *             pagination:
 *               type: object
 */

/**
 * @swagger
 * /roles:
 *   get:
 *     summary: Get all roles (Admin only)
 *     tags: [Roles & Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 10 }
 *         description: Items per page
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search by role name
 *     responses:
 *       200:
 *         description: List of roles retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RoleListResponse'
 *       400:
 *         description: Bad request - invalid query parameters
 *       401:
 *         description: Unauthorized - invalid or missing token
 *       403:
 *         description: Forbidden - Admin role required
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
 *     tags: [Roles & Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema: { type: string }
 *         description: Role ID
 *     responses:
 *       200:
 *         description: Role details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RoleSingleResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin role required
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
 *     tags: [Roles & Permissions]
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
 *                 additionalProperties:
 *                   type: boolean
 *                 description: Object with permission keys
 *                 example:
 *                   billing.read: true
 *                   billing.create: true
 *                   billing.update: true
 *               isSystemRole:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       201:
 *         description: Role created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RoleSingleResponse'
 *       400:
 *         description: Bad request - missing required fields or invalid data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - insufficient permissions
 *       409:
 *         description: Conflict - role name already exists
 *       422:
 *         description: Validation failed
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
 *     tags: [Roles & Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema: { type: string }
 *         description: Role ID
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
 *                 example: Senior Billing Manager
 *               description:
 *                 type: string
 *                 example: Manages all billing operations
 *               permissions:
 *                 type: object
 *                 additionalProperties:
 *                   type: boolean
 *               isActive:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Role updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RoleSingleResponse'
 *       400:
 *         description: Bad request - invalid data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - insufficient permissions
 *       404:
 *         description: Role not found
 *       409:
 *         description: Conflict - role name already exists
 *       422:
 *         description: Validation failed - cannot update system role
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
 *     tags: [Roles & Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema: { type: string }
 *         description: Role ID
 *     responses:
 *       200:
 *         description: Role deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Role deleted successfully"
 *       400:
 *         description: Bad request - cannot delete system role or role with users assigned
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin role required
 *       404:
 *         description: Role not found
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
 *     tags: [Roles & Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema: { type: string }
 *         description: Role ID
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 10 }
 *         description: Items per page
 *     responses:
 *       200:
 *         description: List of users with this role retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RoleUsersResponse'
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin role required
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