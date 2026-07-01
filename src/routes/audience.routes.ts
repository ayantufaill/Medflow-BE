import { Router } from 'express';
import { audienceController } from '../controllers/audience.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  saveAudienceValidator,
  audienceIdParamValidator,
} from '../validators/audience.validator';

const router = Router();

/**
 * @swagger
 * /audiences:
 *   get:
 *     summary: Retrieve all saved audience segments
 *     tags: [Audiences]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of audience segments
 */
router.get(
  '/',
  authenticate,
  requirePermission('audiences.read'),
  audienceController.getAllAudiences.bind(audienceController)
);

/**
 * @swagger
 * /audiences:
 *   post:
 *     summary: Save a new audience segment
 *     tags: [Audiences]
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
 *               - kind
 *             properties:
 *               name:
 *                 type: string
 *               kind:
 *                 type: string
 *                 enum: [Patient, Procedures]
 *               filters:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       201:
 *         description: Audience segment successfully saved
 */
router.post(
  '/',
  authenticate,
  requirePermission('audiences.write'),
  validate(saveAudienceValidator),
  audienceController.saveAudience.bind(audienceController)
);

/**
 * @swagger
 * /audiences/{audienceId}:
 *   delete:
 *     summary: Delete a saved audience segment
 *     tags: [Audiences]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: audienceId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Audience segment successfully deleted
 */
router.delete(
  '/:audienceId',
  authenticate,
  requirePermission('audiences.write'),
  validate(audienceIdParamValidator),
  audienceController.deleteAudience.bind(audienceController)
);

export default router;
