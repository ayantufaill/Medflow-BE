import { Router } from 'express';
import { query } from 'express-validator';
import { userController } from '../controllers/user.controller';
import { roleController } from '../controllers/role.controller';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  updateUserValidator,
  userIdValidator,
  assignRoleValidator,
  queryValidator,
  createUserValidator,
} from '../validators/user.validator';

// Validator for activity and login history endpoints
const activityQueryValidator = [
  ...userIdValidator,
  ...queryValidator,
];
import { changePasswordValidator } from '../validators/auth.validator';

const router = Router();

// All user routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /users:
 *   post:
 *     summary: Create new user (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - firstName
 *               - lastName
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User's email address
 *                 example: "john.doe@example.com"
 *               firstName:
 *                 type: string
 *                 description: User's first name
 *                 example: "John"
 *               lastName:
 *                 type: string
 *                 description: User's last name
 *                 example: "Doe"
 *               roleId:
 *                 type: string
 *                 description: Role ID (must be a string)
 *                 example: "1"
 *     responses:
 *       201:
 *         description: User created (inactive, verification email sent)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       400:
 *         description: Invalid input
 *       403:
 *         description: Admin only
 *       409:
 *         description: Email already exists
 */
router.post(
  '/',
  requireRoles('Admin'),
  validate(createUserValidator),
  userController.createUser.bind(userController)
);

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Get all users (Admin only)
 *     tags: [Users]
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
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [active, inactive] }
 *     responses:
 *       200:
 *         description: List of users
 *       403:
 *         description: Admin only
 */
router.get(
  '/',
  requireRoles('Admin'),
  validate(queryValidator),
  userController.getAllUsers.bind(userController)
);

/**
 * @swagger
 * /users/by-role/{roleName}:
 *   get:
 *     summary: Get users by role name (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleName
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [active, inactive] }
 *     responses:
 *       200:
 *         description: List of users with specified role
 */
router.get(
  '/by-role/:roleName',
  requireRoles('Admin'),
  validate([
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('Limit must be between 1 and 1000'),
    query('status').optional().isIn(['active', 'inactive']).withMessage('Status must be active or inactive'),
    query('excludeWithProvider').optional().isIn(['true', 'false']).withMessage('excludeWithProvider must be true or false'),
  ]),
  userController.getUsersByRoleName.bind(userController)
);

/**
 * @swagger
 * /users/{userId}:
 *   get:
 *     summary: Get user by ID
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: User details
 *       404:
 *         description: User not found
 */
router.get(
  '/:userId',
  validate(userIdValidator),
  userController.getUserById.bind(userController)
);

/**
 * @swagger
 * /users/{userId}:
 *   put:
 *     summary: Update user (Admin can update any, users can update themselves)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: User updated
 *       404:
 *         description: User not found
 */
router.put(
  '/:userId',
  validate([...userIdValidator, ...updateUserValidator]),
  userController.updateUser.bind(userController)
);

/**
 * @swagger
 * /users/profile/me:
 *   put:
 *     summary: Update own profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated
 */
router.put(
  '/profile/me',
  validate(updateUserValidator),
  userController.updateProfile.bind(userController)
);

/**
 * @swagger
 * /users/profile/change-password:
 *   post:
 *     summary: Change own password
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 format: password
 *               newPassword:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Password changed
 *       401:
 *         description: Current password incorrect
 */
router.post(
  '/profile/change-password',
  validate(changePasswordValidator),
  userController.changePassword.bind(userController)
);

/**
 * @swagger
 * /users/{userId}/roles:
 *   post:
 *     summary: Assign role to user (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - roleId
 *             properties:
 *               roleId:
 *                 type: string
 *                 description: Role ID (must be a string)
 *                 example: "1"
 *     responses:
 *       200:
 *         description: Role assigned
 *       403:
 *         description: Admin only
 */
router.post(
  '/:userId/roles',
  requireRoles('Admin'),
  validate([...userIdValidator, ...assignRoleValidator]),
  userController.assignRole.bind(userController)
);

/**
 * @swagger
 * /users/{userId}/roles/{roleId}:
 *   delete:
 *     summary: Remove role from user (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Role removed
 *       403:
 *         description: Admin only
 */
router.delete(
  '/:userId/roles/:roleId',
  requireRoles('Admin'),
  validate(userIdValidator),
  userController.removeRole.bind(userController)
);

/**
 * @swagger
 * /users/{userId}:
 *   delete:
 *     summary: Delete user (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       400:
 *         description: Cannot delete user with existing related records
 *       403:
 *         description: Admin only
 *       404:
 *         description: User not found
 *       409:
 *         description: Cannot delete user due to foreign key constraints (user has existing appointments, communications, or other records)
 */
router.delete(
  '/:userId',
  requireRoles('Admin'),
  validate(userIdValidator),
  userController.deleteUser.bind(userController)
);

/**
 * @swagger
 * /users/{userId}/activate:
 *   patch:
 *     summary: Activate user (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: User activated
 *       403:
 *         description: Admin only
 */
router.patch(
  '/:userId/activate',
  requireRoles('Admin'),
  validate(userIdValidator),
  userController.activateUser.bind(userController)
);

/**
 * @swagger
 * /users/{userId}/deactivate:
 *   patch:
 *     summary: Deactivate user (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: User deactivated
 *       403:
 *         description: Admin only
 */
router.patch(
  '/:userId/deactivate',
  requireRoles('Admin'),
  validate(userIdValidator),
  userController.deactivateUser.bind(userController)
);

/**
 * @swagger
 * /users/{userId}/permissions:
 *   get:
 *     summary: Get user permissions
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: List of user permissions
 */
router.get(
  '/:userId/permissions',
  validate(userIdValidator),
  roleController.getUserPermissions.bind(roleController)
);

/**
 * @swagger
 * /users/{userId}/roles:
 *   get:
 *     summary: Get user roles
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: List of user roles
 */
router.get(
  '/:userId/roles',
  validate(userIdValidator),
  roleController.getUserRoles.bind(roleController)
);

/**
 * @swagger
 * /users/{userId}/activity:
 *   get:
 *     summary: Get user activity log (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: User activity log
 *       403:
 *         description: Admin only
 */
router.get(
  '/:userId/activity',
  requireRoles('Admin'),
  validate(activityQueryValidator),
  userController.getUserActivity.bind(userController)
);

/**
 * @swagger
 * /users/{userId}/login-history:
 *   get:
 *     summary: Get user login history (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: User login history
 *       403:
 *         description: Admin only
 */
router.get(
  '/:userId/login-history',
  requireRoles('Admin'),
  validate(activityQueryValidator),
  userController.getUserLoginHistory.bind(userController)
);

export default router;