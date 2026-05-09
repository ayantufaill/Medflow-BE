import { Router } from 'express';
import { progressNoteController } from '../controllers/progress-note.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  getProgressNotesValidator,
  createProgressNoteValidator,
  addProcedureValidator
} from '../validators/progress-note.validator';

const router = Router();

/**
 * @swagger
 * /progress-notes:
 *   get:
 *     summary: Get all progress notes
 *     tags: [Progress Notes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: patientId
 *         schema: { type: string }
 *       - in: query
 *         name: tab
 *         schema: { type: string }
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: List of progress notes
 */
router.get(
  '/',
  authenticate,
  requirePermission('clinical-notes.read'),
  validate(getProgressNotesValidator),
  progressNoteController.getProgressNotes
);

/**
 * @swagger
 * /progress-notes:
 *   post:
 *     summary: Create a new progress note
 *     tags: [Progress Notes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               patientId:
 *                 type: string
 *               category:
 *                 type: string
 *               description:
 *                 type: string
 *               providerId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Progress note created successfully
 */
router.post(
  '/',
  authenticate,
  requirePermission('clinical-notes.update'),
  validate(createProgressNoteValidator),
  progressNoteController.createProgressNote
);

/**
 * @swagger
 * /progress-notes/{id}/procedures:
 *   post:
 *     summary: Add a procedure to a progress note
 *     tags: [Progress Notes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               procedureCode:
 *                 type: string
 *     responses:
 *       200:
 *         description: Procedure added successfully
 */
router.post(
  '/:id/procedures',
  authenticate,
  requirePermission('clinical-notes.update'),
  validate(addProcedureValidator),
  progressNoteController.addProcedure
);

export default router;
