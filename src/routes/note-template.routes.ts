import { Router } from 'express';
import { noteTemplateController } from '../controllers/note-template.controller';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  noteTemplateIdValidator,
  createNoteTemplateValidator,
  updateNoteTemplateValidator,
  duplicateNoteTemplateValidator,
  noteTemplateQueryValidator,
  specialtyParamValidator,
} from '../validators/note-template.validator';

const router = Router();

/**
 * @swagger
 * /note-templates:
 *   get:
 *     summary: Get all note templates
 *     tags: [Note Templates]
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
 *         name: specialty
 *         schema: { type: string }
 *       - in: query
 *         name: isActive
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: List of note templates
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/',
  authenticate,
  validate(noteTemplateQueryValidator),
  noteTemplateController.getAllNoteTemplates
);

/**
 * @swagger
 * /note-templates/active:
 *   get:
 *     summary: Get active note templates
 *     tags: [Note Templates]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of active templates
 */
router.get(
  '/active',
  authenticate,
  noteTemplateController.getActiveTemplates
);

/**
 * @swagger
 * /note-templates/specialty/{specialty}:
 *   get:
 *     summary: Get templates by specialty
 *     tags: [Note Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: specialty
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of templates for specialty
 */
router.get(
  '/specialty/:specialty',
  authenticate,
  validate(specialtyParamValidator),
  noteTemplateController.getTemplatesBySpecialty
);

/**
 * @swagger
 * /note-templates/{noteTemplateId}:
 *   get:
 *     summary: Get note template by ID
 *     tags: [Note Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: noteTemplateId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Template details
 *       404:
 *         description: Template not found
 */
router.get(
  '/:noteTemplateId',
  authenticate,
  validate(noteTemplateIdValidator),
  noteTemplateController.getNoteTemplateById
);

/**
 * @swagger
 * /note-templates:
 *   post:
 *     summary: Create new note template
 *     tags: [Note Templates]
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
 *               - content
 *             properties:
 *               name:
 *                 type: string
 *               content:
 *                 type: string
 *               specialty:
 *                 type: string
 *               category:
 *                 type: string
 *     responses:
 *       201:
 *         description: Template created
 *       403:
 *         description: Admin or Doctor only
 */
router.post(
  '/',
  authenticate,
  requireRoles('Admin', 'Provider'),
  validate(createNoteTemplateValidator),
  noteTemplateController.createNoteTemplate
);

/**
 * @swagger
 * /note-templates/{noteTemplateId}/duplicate:
 *   post:
 *     summary: Duplicate note template
 *     tags: [Note Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: noteTemplateId
 *         required: true
 *         schema: { type: integer }
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
 *     responses:
 *       201:
 *         description: Template duplicated
 */
router.post(
  '/:noteTemplateId/duplicate',
  authenticate,
  requireRoles('Admin', 'Provider'),
  validate([...noteTemplateIdValidator, ...duplicateNoteTemplateValidator]),
  noteTemplateController.duplicateNoteTemplate
);

/**
 * @swagger
 * /note-templates/{noteTemplateId}:
 *   put:
 *     summary: Update note template
 *     tags: [Note Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: noteTemplateId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               content:
 *                 type: string
 *               specialty:
 *                 type: string
 *               category:
 *                 type: string
 *     responses:
 *       200:
 *         description: Template updated
 *       404:
 *         description: Template not found
 */
router.put(
  '/:noteTemplateId',
  authenticate,
  requireRoles('Admin', 'Provider'),
  validate([...noteTemplateIdValidator, ...updateNoteTemplateValidator]),
  noteTemplateController.updateNoteTemplate
);

/**
 * @swagger
 * /note-templates/{noteTemplateId}/status:
 *   patch:
 *     summary: Toggle template status (activate/deactivate)
 *     tags: [Note Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: noteTemplateId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Template status toggled
 */
router.patch(
  '/:noteTemplateId/status',
  authenticate,
  requireRoles('Admin', 'Provider'),
  validate(noteTemplateIdValidator),
  noteTemplateController.toggleNoteTemplateStatus
);

/**
 * @swagger
 * /note-templates/{noteTemplateId}:
 *   delete:
 *     summary: Delete note template
 *     tags: [Note Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: noteTemplateId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Template deleted
 *       404:
 *         description: Template not found
 */
router.delete(
  '/:noteTemplateId',
  authenticate,
  requireRoles('Admin', 'Provider'),
  validate(noteTemplateIdValidator),
  noteTemplateController.deleteNoteTemplate
);

export default router;