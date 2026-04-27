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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: string
 *                     enum:
 *                       - XRAY
 *                       - LAB_RESULT
 *                       - PRESCRIPTION
 *                       - CONSENT_FORM
 *                       - INSURANCE_CARD
 *                       - ID_PROOF
 *                       - MEDICAL_HISTORY
 *                       - OTHER
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
 *               - patientId
 *               - documentType
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: The document file to upload
 *               patientId:
 *                 type: integer
 *                 description: Patient ID
 *                 example: 1
 *               documentType:
 *                 type: string
 *                 description: Document type (must be one of the valid types)
 *                 enum: [XRAY, LAB_RESULT, PRESCRIPTION, CONSENT_FORM, INSURANCE_CARD, ID_PROOF, MEDICAL_HISTORY, OTHER]
 *                 example: "XRAY"
 *               description:
 *                 type: string
 *                 description: Document description
 *                 example: "Chest X-ray from March 2026"
 *     responses:
 *       201:
 *         description: Document uploaded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       400:
 *         description: Invalid input - missing patientId or documentType
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Patient not found
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
 *               - documentType
 *               - documentName
 *             properties:
 *               patientId:
 *                 type: integer
 *                 description: Patient ID (must be a valid patient ID, not 0)
 *                 example: 1
 *               documentType:
 *                 type: string
 *                 description: Document type
 *                 enum:
 *                   - XRAY
 *                   - LAB_RESULT
 *                   - PRESCRIPTION
 *                   - CONSENT_FORM
 *                   - INSURANCE_CARD
 *                   - ID_PROOF
 *                   - MEDICAL_HISTORY
 *                   - OTHER
 *                 example: "LAB_RESULT"
 *               documentName:
 *                 type: string
 *                 description: Document name/title
 *                 example: "Blood Test Results - March 2026"
 *               description:
 *                 type: string
 *                 description: Document description
 *                 example: "Complete blood count and metabolic panel"
 *               url:
 *                 type: string
 *                 format: uri
 *                 description: URL to the document (if already hosted)
 *                 example: "https://storage.example.com/documents/lab-results-001.pdf"
 *     responses:
 *       201:
 *         description: Document created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       400:
 *         description: Invalid input - invalid patient ID, document type, or missing required fields
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Patient not found
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
 *               documentName:
 *                 type: string
 *                 description: Document name
 *                 example: "Updated Blood Test Results"
 *               description:
 *                 type: string
 *                 description: Document description
 *                 example: "Updated lab results with additional tests"
 *               documentType:
 *                 type: string
 *                 description: Document type
 *                 enum: [XRAY, LAB_RESULT, PRESCRIPTION, CONSENT_FORM, INSURANCE_CARD, ID_PROOF, MEDICAL_HISTORY, OTHER]
 *                 example: "LAB_RESULT"
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
 *                 description: Clinical note ID
 *                 example: 1
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