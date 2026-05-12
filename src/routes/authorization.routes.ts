import { Router } from 'express';
import { authorizationController } from '../controllers/authorization.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  authorizationIdValidator,
  authorizationSearchValidator,
  createAuthorizationValidator,
  updateAuthorizationValidator,
} from '../validators/authorization.validator';

const router = Router();

/**
 * @swagger
 * /authorizations:
 *   get:
 *     summary: Get all authorizations
 *     tags: [Authorizations]
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
 *         name: patientId
 *         schema: { type: integer }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, approved, denied, expired] }
 *     responses:
 *       200:
 *         description: List of authorizations
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/',
  authenticate,
  requirePermission('authorizations.read'),
  validate(authorizationSearchValidator),
  authorizationController.getAllAuthorizations.bind(authorizationController)
);

/**
 * @swagger
 * /authorizations/{authorizationId}:
 *   get:
 *     summary: Get authorization by ID
 *     tags: [Authorizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: authorizationId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Authorization details
 *       404:
 *         description: Authorization not found
 */
router.get(
  '/:authorizationId',
  authenticate,
  requirePermission('authorizations.read'),
  validate(authorizationIdValidator),
  authorizationController.getAuthorizationById.bind(authorizationController)
);

/**
 * @swagger
 * /authorizations:
 *   post:
 *     summary: Request new authorization
 *     tags: [Authorizations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - patientId
 *               - procedureCode
 *               - insurancePlanId
 *             properties:
 *               patientId:
 *                 type: integer
 *               procedureCode:
 *                 type: string
 *               insurancePlanId:
 *                 type: integer
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Authorization requested
 */
router.post(
  '/',
  authenticate,
  requirePermission('authorizations.create'),
  validate(createAuthorizationValidator),
  authorizationController.requestAuthorization.bind(authorizationController)
);

/**
 * @swagger
 * /authorizations/{authorizationId}:
 *   patch:
 *     summary: Update authorization
 *     tags: [Authorizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: authorizationId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, approved, denied, expired]
 *               authorizationNumber:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Authorization updated
 *       404:
 *         description: Authorization not found
 */
router.patch(
  '/:authorizationId',
  authenticate,
  requirePermission('authorizations.update'),
  validate([...authorizationIdValidator, ...updateAuthorizationValidator]),
  authorizationController.updateAuthorization.bind(authorizationController)
);

/**
 * @swagger
 * /authorizations/{authorizationId}/status-history:
 *   get:
 *     summary: Get authorization status history
 *     tags: [Authorizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: authorizationId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Status history
 */
router.get(
  '/:authorizationId/status-history',
  authenticate,
  requirePermission('authorizations.read'),
  validate(authorizationIdValidator),
  authorizationController.getAuthorizationStatusHistory.bind(authorizationController)
);

/**
 * @swagger
 * /authorizations/{authorizationId}/print:
 *   get:
 *     summary: Print authorization form
 *     tags: [Authorizations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: authorizationId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: PDF form
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get(
  '/:authorizationId/print',
  authenticate,
  requirePermission('authorizations.read'),
  validate(authorizationIdValidator),
  authorizationController.printAuthorizationForm.bind(authorizationController)
);

export default router;