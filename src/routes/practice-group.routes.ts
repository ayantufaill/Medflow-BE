import { Router } from 'express';
import { practiceGroupController } from '../controllers/practice-group.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validation.middleware';
import { PLATFORM_ADMIN_PERMISSIONS } from '../types/auth.types';
import {
  createPracticeGroupValidator,
  groupIdParamValidator,
  createBranchValidator,
  createGroupAdminValidator,
  updateGroupValidator,
} from '../validators/practice-group.validator';

const router = Router();
router.use(authenticate);

// Onboarding/offboarding a practice and cross-group listing are Super Admin
// only (platform:manage_practice_groups — 'Admin' still passes via its '*'
// wildcard, so this isn't a regression for existing deployments).
// GET /:groupId and GET /:groupId/users are the exception: a Group Admin may
// also reach those, but only for their own group — enforced inside the
// controller (assertCanOperateOnGroup), not by this middleware, since the
// permission alone can't express "only if it's your group".
const requirePlatformAdmin = requirePermission(PLATFORM_ADMIN_PERMISSIONS.MANAGE_PRACTICE_GROUPS);

/**
 * @swagger
 * /practice-groups:
 *   post:
 *     summary: Create a new practice group (onboard a new independent practice)
 *     tags: [Practice Groups]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               config: { type: object }
 *     responses:
 *       201:
 *         description: Practice group created
 */
router.post(
  '/',
  requirePlatformAdmin,
  validate(createPracticeGroupValidator),
  practiceGroupController.createGroup.bind(practiceGroupController)
);

/**
 * @swagger
 * /practice-groups:
 *   get:
 *     summary: List all practice groups with their branches
 *     tags: [Practice Groups]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of practice groups
 */
router.get('/', requirePlatformAdmin, practiceGroupController.getAllGroups.bind(practiceGroupController));

/**
 * @swagger
 * /practice-groups/{groupId}:
 *   get:
 *     summary: Get a practice group and its branches
 *     tags: [Practice Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Practice group detail
 *       404:
 *         description: Practice group not found
 */
router.get(
  '/:groupId',
  validate(groupIdParamValidator),
  practiceGroupController.getGroupById.bind(practiceGroupController)
);

/**
 * @swagger
 * /practice-groups/{groupId}:
 *   patch:
 *     summary: Rename and/or deactivate a practice group (offboarding — never hard-deletes)
 *     tags: [Practice Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               isActive: { type: boolean }
 *     responses:
 *       200:
 *         description: Practice group updated
 *       404:
 *         description: Practice group not found
 */
router.patch(
  '/:groupId',
  requirePlatformAdmin,
  validate(updateGroupValidator),
  practiceGroupController.updateGroup.bind(practiceGroupController)
);

/**
 * @swagger
 * /practice-groups/{groupId}/users:
 *   get:
 *     summary: List every user assigned to a branch within this group
 *     tags: [Practice Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Users in this group
 *       403:
 *         description: Not a Super Admin or this group's Group Admin
 *       404:
 *         description: Practice group not found
 */
router.get(
  '/:groupId/users',
  validate(groupIdParamValidator),
  practiceGroupController.getGroupUsers.bind(practiceGroupController)
);

/**
 * @swagger
 * /practice-groups/{groupId}/branches:
 *   post:
 *     summary: Provision a new branch (clinic) under a practice group
 *     tags: [Practice Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               address: { type: string }
 *               city: { type: string }
 *               state: { type: string }
 *               zip: { type: string }
 *               phone: { type: string }
 *     responses:
 *       201:
 *         description: Branch created
 *       404:
 *         description: Practice group not found
 */
router.post(
  '/:groupId/branches',
  requirePlatformAdmin,
  validate(createBranchValidator),
  practiceGroupController.createBranch.bind(practiceGroupController)
);

/**
 * @swagger
 * /practice-groups/{groupId}/admin:
 *   post:
 *     summary: Create the first Group Admin user for a practice group, assigned to one of its branches
 *     tags: [Practice Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, firstName, lastName, clinicId]
 *             properties:
 *               email: { type: string }
 *               firstName: { type: string }
 *               lastName: { type: string }
 *               clinicId:
 *                 type: string
 *                 description: A branch id from POST /practice-groups/{groupId}/branches
 *     responses:
 *       201:
 *         description: Admin user created — an email verification link was sent to set their password
 *       404:
 *         description: Practice group or branch not found
 */
router.post(
  '/:groupId/admin',
  requirePlatformAdmin,
  validate(createGroupAdminValidator),
  practiceGroupController.createGroupAdmin.bind(practiceGroupController)
);

export default router;
