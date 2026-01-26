import { Router } from 'express';
import { roleController } from '../controllers/role.controller';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validation.middleware';
import { body, param, query } from 'express-validator';

const router = Router();

// All role routes require authentication
router.use(authenticate);

// Get all roles (Admin only)
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

// Get role by ID (Admin only)
router.get(
  '/:roleId',
  requireRoles('Admin'),
  validate([
    param('roleId').isString().trim().notEmpty().withMessage('Role ID is required'),
  ]),
  roleController.getRoleById.bind(roleController)
);

// Create role (Admin only)
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

// Update role (Admin only)
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

// Delete role (Admin only)
router.delete(
  '/:roleId',
  requireRoles('Admin'),
  requirePermission('roles.delete'),
  validate([
    param('roleId').isString().trim().notEmpty().withMessage('Role ID is required'),
  ]),
  roleController.deleteRole.bind(roleController)
);

// Get users with a specific role (Admin only)
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

