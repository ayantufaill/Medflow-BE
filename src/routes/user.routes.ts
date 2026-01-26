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

// Create user (Admin only) - creates inactive user and sends verification link
router.post(
  '/',
  requireRoles('Admin'),
  validate(createUserValidator),
  userController.createUser.bind(userController)
);

// Get all users (Admin only)
router.get(
  '/',
  requireRoles('Admin'),
  validate(queryValidator),
  userController.getAllUsers.bind(userController)
);

// Get users by role name (Admin only)
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

// Get user by ID
router.get(
  '/:userId',
  validate(userIdValidator),
  userController.getUserById.bind(userController)
);

// Update user (Admin can update any user, users can only update themselves)
router.put(
  '/:userId',
  validate([...userIdValidator, ...updateUserValidator]),
  userController.updateUser.bind(userController)
);

// Update own profile
router.put(
  '/profile/me',
  validate(updateUserValidator),
  userController.updateProfile.bind(userController)
);

// Change password
router.post(
  '/profile/change-password',
  validate(changePasswordValidator),
  userController.changePassword.bind(userController)
);

// Assign role (Admin only)
router.post(
  '/:userId/roles',
  requireRoles('Admin'),
  validate([...userIdValidator, ...assignRoleValidator]),
  userController.assignRole.bind(userController)
);

// Remove role (Admin only)
router.delete(
  '/:userId/roles/:roleId',
  requireRoles('Admin'),
  validate(userIdValidator),
  userController.removeRole.bind(userController)
);

// Delete user (Admin only)
router.delete(
  '/:userId',
  requireRoles('Admin'),
  validate(userIdValidator),
  userController.deleteUser.bind(userController)
);

// Activate user (Admin only)
router.patch(
  '/:userId/activate',
  requireRoles('Admin'),
  validate(userIdValidator),
  userController.activateUser.bind(userController)
);

// Deactivate user (Admin only)
router.patch(
  '/:userId/deactivate',
  requireRoles('Admin'),
  validate(userIdValidator),
  userController.deactivateUser.bind(userController)
);

// Get user permissions
router.get(
  '/:userId/permissions',
  validate(userIdValidator),
  roleController.getUserPermissions.bind(roleController)
);

// Get user roles
router.get(
  '/:userId/roles',
  validate(userIdValidator),
  roleController.getUserRoles.bind(roleController)
);

// Get user activity (Admin only)
router.get(
  '/:userId/activity',
  requireRoles('Admin'),
  validate(activityQueryValidator),
  userController.getUserActivity.bind(userController)
);

// Get user login history (Admin only)
router.get(
  '/:userId/login-history',
  requireRoles('Admin'),
  validate(activityQueryValidator),
  userController.getUserLoginHistory.bind(userController)
);

export default router;

