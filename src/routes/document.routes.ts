import { Router } from 'express';
import { documentController } from '../controllers/document.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validation.middleware';
import { uploadDocument as uploadDocumentMiddleware } from '../middleware/upload.middleware';
import {
  documentIdValidator,
  patientIdParamValidator,
  appointmentIdParamValidator,
  documentQueryValidator,
  paginationQueryValidator,
  createDocumentValidator,
  updateDocumentValidator,
  attachToNoteValidator,
} from '../validators/document.validator';

const router = Router();

/**
 * @swagger
 * /documents/types:
 *   get:
 *     summary: Get document types
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of document types
 */
router.get(
  '/types',
  authenticate,
  documentController.getDocumentTypes
);

/**
 * @swagger
 * /documents:
 *   get:
 *     summary: Get all documents
 *     tags: [Documents]
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
 *         name: type
 *         schema: { type: string }
 *       - in: query
 *         name: patientId
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: List of documents
 */
router.get(
  '/',
  authenticate,
  requirePermission('documents.read'),
  validate(documentQueryValidator),
  documentController.getAllDocuments
);

/**
 * @swagger
 * /documents/patient/{patientId}:
 *   get:
 *     summary: Get documents by patient
 *     tags: [Documents]
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
 *         description: List of patient documents
 */
router.get(
  '/patient/:patientId',
  authenticate,
  requirePermission('documents.read'),
  validate([...patientIdParamValidator, ...paginationQueryValidator]),
  documentController.getDocumentsByPatient
);

/**
 * @swagger
 * /documents/appointment/{appointmentId}:
 *   get:
 *     summary: Get documents by appointment
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: List of appointment documents
 */
router.get(
  '/appointment/:appointmentId',
  authenticate,
  requirePermission('documents.read'),
  validate(appointmentIdParamValidator),
  documentController.getDocumentsByAppointment
);

/**
 * @swagger
 * /documents/{documentId}:
 *   get:
 *     summary: Get document by ID
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Document details
 *       404:
 *         description: Document not found
 */
router.get(
  '/:documentId',
  authenticate,
  requirePermission('documents.read'),
  validate(documentIdValidator),
  documentController.getDocumentById
);

/**
 * @swagger
 * /documents/upload:
 *   post:
 *     summary: Upload a document file
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               patientId:
 *                 type: integer
 *               type:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Document uploaded
 */
router.post(
  '/upload',
  authenticate,
  requirePermission('documents.create'),
  uploadDocumentMiddleware.any(),
  documentController.uploadDocument
);

/**
 * @swagger
 * /documents:
 *   post:
 *     summary: Create document record (without file upload)
 *     tags: [Documents]
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
 *               - type
 *             properties:
 *               patientId:
 *                 type: integer
 *               type:
 *                 type: string
 *               description:
 *                 type: string
 *               url:
 *                 type: string
 *     responses:
 *       201:
 *         description: Document created
 */
router.post(
  '/',
  authenticate,
  requirePermission('documents.create'),
  validate(createDocumentValidator),
  documentController.createDocument
);

/**
 * @swagger
 * /documents/{documentId}:
 *   put:
 *     summary: Update document metadata
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               description:
 *                 type: string
 *               type:
 *                 type: string
 *     responses:
 *       200:
 *         description: Document updated
 *       404:
 *         description: Document not found
 */
router.put(
  '/:documentId',
  authenticate,
  requirePermission('documents.update'),
  validate([...documentIdValidator, ...updateDocumentValidator]),
  documentController.updateDocument
);

/**
 * @swagger
 * /documents/{documentId}/attach-to-note:
 *   post:
 *     summary: Attach document to clinical note
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - clinicalNoteId
 *             properties:
 *               clinicalNoteId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Document attached to note
 *       404:
 *         description: Document or note not found
 */
router.post(
  '/:documentId/attach-to-note',
  authenticate,
  requirePermission('documents.update'),
  validate([...documentIdValidator, ...attachToNoteValidator]),
  documentController.attachToNote
);

/**
 * @swagger
 * /documents/{documentId}/unlink:
 *   post:
 *     summary: Unlink document from patient
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Document unlinked successfully
 *       404:
 *         description: Document not found
 */
router.post(
  '/:documentId/unlink',
  authenticate,
  requirePermission('documents.update'),
  validate(documentIdValidator),
  documentController.unlinkDocument
);

/**
 * @swagger
 * /documents/{documentId}:
 *   delete:
 *     summary: Delete document
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Document deleted
 *       404:
 *         description: Document not found
 */
router.delete(
  '/:documentId',
  authenticate,
  requirePermission('documents.delete'),
  validate(documentIdValidator),
  documentController.deleteDocument
);

export default router;