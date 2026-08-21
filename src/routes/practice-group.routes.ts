import { Router } from 'express';
import { practiceGroupController } from '../controllers/practice-group.controller';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  createPracticeGroupValidator,
  groupIdParamValidator,
  createBranchValidator,
  createGroupAdminValidator,
} from '../validators/practice-group.validator';

const router = Router();
router.use(authenticate);

// NOTE: gated to the existing 'Admin' role for now, same as the rest of this
// app's most sensitive endpoints. In a real multi-tenant cloud deployment,
// provisioning a brand-new, unrelated practice should be gated to a distinct
// platform/super-admin permission instead — 'Admin' today is a per-practice
// role, so any existing practice's Admin could otherwise provision other,
// unrelated practices. Flagging as a known gap rather than inventing a new
// role tier that wasn't asked for.
router.use(requireRoles('Admin'));

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
router.get('/', practiceGroupController.getAllGroups.bind(practiceGroupController));

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
  validate(createGroupAdminValidator),
  practiceGroupController.createGroupAdmin.bind(practiceGroupController)
);

export default router;
