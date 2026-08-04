import { Router } from 'express';
import { clinicalNoteController } from '../controllers/clinical-note.controller';
import { authenticate } from '../middleware/auth.middleware';
import { resolveBranchAccess } from '../middleware/branchAccess.middleware';
import { enterTenantContext } from '../middleware/tenantContext.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  clinicalNoteIdValidator,
  patientIdParamValidator,
  appointmentIdParamValidator,
  providerIdParamValidator,
  templateIdParamValidator,
  createClinicalNoteValidator,
  updateClinicalNoteValidator,
  saveDraftValidator,
  createFromTemplateValidator,
  attachmentValidator,
  clinicalNoteQueryValidator,
  paginationQueryValidator,
} from '../validators/clinical-note.validator';

const router = Router();

/**
 * @swagger
 * /clinical-notes:
 *   get:
 *     summary: Get all clinical notes
 *     tags: [Clinical Notes]
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
 *         schema: { type: string, enum: [draft, signed] }
 *     responses:
 *       200:
 *         description: List of clinical notes
 */
router.get(
  '/',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('clinical-notes.read'),
  validate(clinicalNoteQueryValidator),
  clinicalNoteController.getAllClinicalNotes
);

/**
 * @swagger
 * /clinical-notes/patient/{patientId}:
 *   get:
 *     summary: Get clinical notes by patient
 *     tags: [Clinical Notes]
 *     security:
 *       - bearerAuth: []
 *     parameters: 
 *       - in: path
 *         name: patientId
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
 *         description: List of patient clinical notes
 */
router.get(
  '/patient/:patientId',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('clinical-notes.read'),
  validate([...patientIdParamValidator, ...paginationQueryValidator]),
  clinicalNoteController.getClinicalNotesByPatient
);

/**
 * @swagger
 * /clinical-notes/patient/{patientId}/medical-history:
 *   get:
 *     summary: Get patient medical history
 *     tags: [Clinical Notes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Patient medical history
 */
router.get(
  '/patient/:patientId/medical-history',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('clinical-notes.read'),
  validate(patientIdParamValidator),
  clinicalNoteController.getPatientMedicalHistory
);

/**
 * @swagger
 * /clinical-notes/appointment/{appointmentId}:
 *   get:
 *     summary: Get clinical note by appointment
 *     tags: [Clinical Notes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Clinical note for appointment
 *       404:
 *         description: No note found for this appointment
 */
router.get(
  '/appointment/:appointmentId',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('clinical-notes.read'),
  validate(appointmentIdParamValidator),
  clinicalNoteController.getClinicalNoteByAppointment
);

/**
 * @swagger
 * /clinical-notes/unsigned/{providerId}:
 *   get:
 *     summary: Get unsigned notes for a provider
 *     tags: [Clinical Notes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: providerId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: List of unsigned notes
 */
router.get(
  '/unsigned/:providerId',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('clinical-notes.read'),
  validate(providerIdParamValidator),
  clinicalNoteController.getUnsignedNotes
);

/**
 * @swagger
 * /clinical-notes/{clinicalNoteId}:
 *   get:
 *     summary: Get clinical note by ID
 *     tags: [Clinical Notes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clinicalNoteId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Clinical note details
 *       404:
 *         description: Clinical note not found
 */
router.get(
  '/:clinicalNoteId',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('clinical-notes.read'),
  validate(clinicalNoteIdValidator),
  clinicalNoteController.getClinicalNoteById
);

/**
 * @swagger
 * /clinical-notes:
 *   post:
 *     summary: Create new clinical note
 *     tags: [Clinical Notes]
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
 *               - appointmentId
 *             properties:
 *               patientId:
 *                 type: integer
 *               appointmentId:
 *                 type: integer
 *               content:
 *                 type: string
 *               diagnosis:
 *                 type: string
 *               treatment:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Clinical note created
 */
router.post(
  '/',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('clinical-notes.create'),
  validate(createClinicalNoteValidator),
  clinicalNoteController.createClinicalNote
);

/**
 * @swagger
 * /clinical-notes/from-template/{templateId}:
 *   post:
 *     summary: Create clinical note from template
 *     tags: [Clinical Notes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - patientId
 *               - appointmentId
 *             properties:
 *               patientId:
 *                 type: integer
 *               appointmentId:
 *                 type: integer
 *               customContent:
 *                 type: object
 *     responses:
 *       201:
 *         description: Clinical note created from template
 */
router.post(
  '/from-template/:templateId',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('clinical-notes.create'),
  validate([...templateIdParamValidator, ...createFromTemplateValidator]),
  clinicalNoteController.createNoteFromTemplate
);

/**
 * @swagger
 * /clinical-notes/{clinicalNoteId}:
 *   put:
 *     summary: Update clinical note
 *     tags: [Clinical Notes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clinicalNoteId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *               diagnosis:
 *                 type: string
 *               treatment:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Clinical note updated
 *       404:
 *         description: Clinical note not found
 */
router.put(
  '/:clinicalNoteId',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('clinical-notes.update'),
  validate([...clinicalNoteIdValidator, ...updateClinicalNoteValidator]),
  clinicalNoteController.updateClinicalNote
);

/**
 * @swagger
 * /clinical-notes/{clinicalNoteId}/draft:
 *   put:
 *     summary: Save clinical note as draft
 *     tags: [Clinical Notes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clinicalNoteId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *     responses:
 *       200:
 *         description: Draft saved
 */
router.put(
  '/:clinicalNoteId/draft',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('clinical-notes.update'),
  validate([...clinicalNoteIdValidator, ...saveDraftValidator]),
  clinicalNoteController.saveDraft
);

/**
 * @swagger
 * /clinical-notes/{clinicalNoteId}/sign:
 *   post:
 *     summary: Sign clinical note (finalize)
 *     tags: [Clinical Notes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clinicalNoteId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Clinical note signed
 *       400:
 *         description: Cannot sign - note is empty
 *       404:
 *         description: Clinical note not found
 */
router.post(
  '/:clinicalNoteId/sign',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('clinical-notes.sign'),
  validate(clinicalNoteIdValidator),
  clinicalNoteController.signClinicalNote
);

/**
 * @swagger
 * /clinical-notes/{clinicalNoteId}/attachments:
 *   post:
 *     summary: Add attachment to clinical note
 *     tags: [Clinical Notes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clinicalNoteId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - documentId
 *             properties:
 *               documentId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Attachment added
 */
router.post(
  '/:clinicalNoteId/attachments',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('clinical-notes.update'),
  validate([...clinicalNoteIdValidator, ...attachmentValidator]),
  clinicalNoteController.addAttachment
);

/**
 * @swagger
 * /clinical-notes/{clinicalNoteId}/attachments:
 *   delete:
 *     summary: Remove attachment from clinical note
 *     tags: [Clinical Notes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clinicalNoteId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - documentId
 *             properties:
 *               documentId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Attachment removed
 */
router.delete(
  '/:clinicalNoteId/attachments',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('clinical-notes.update'),
  validate([...clinicalNoteIdValidator, ...attachmentValidator]),
  clinicalNoteController.removeAttachment
);

/**
 * @swagger
 * /clinical-notes/{clinicalNoteId}:
 *   delete:
 *     summary: Delete clinical note
 *     tags: [Clinical Notes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clinicalNoteId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Clinical note deleted
 *       404:
 *         description: Clinical note not found
 */
router.delete(
  '/:clinicalNoteId',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('clinical-notes.delete'),
  validate(clinicalNoteIdValidator),
  clinicalNoteController.deleteClinicalNote
);

export default router;