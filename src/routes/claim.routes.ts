import { Router } from 'express';
import { claimController } from '../controllers/claim.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validation.middleware';
import { uploadDocument as uploadDocumentMiddleware } from '../middleware/upload.middleware';
import {
  claimIdValidator,
  invoiceIdParamValidator,
  claimDocumentIdValidator,
  claimSearchValidator,
  createClaimFromInvoiceValidator,
  updateClaimValidator,
  resubmitClaimValidator,
} from '../validators/claim.validator';

const router = Router();

/**
 * @swagger
 * /claims:
 *   get:
 *     summary: Get all claims
 *     tags: [Claims]
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
 *         name: status
 *         schema: { type: string, enum: [draft, submitted, approved, denied, paid] }
 *       - in: query
 *         name: patientId
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: List of claims
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/',
  authenticate,
  requirePermission('claims.read'),
  validate(claimSearchValidator),
  claimController.getAllClaims.bind(claimController)
);

/**
 * @swagger
 * /claims/{claimId}:
 *   get:
 *     summary: Get claim by ID
 *     tags: [Claims]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: claimId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Claim details
 *       404:
 *         description: Claim not found
 */
router.get(
  '/:claimId',
  authenticate,
  requirePermission('claims.read'),
  validate(claimIdValidator),
  claimController.getClaimById.bind(claimController)
);

/**
 * @swagger
 * /claims/from-invoice/{invoiceId}:
 *   post:
 *     summary: Create claim from invoice
 *     tags: [Claims]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invoiceId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               insurancePlanId:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Claim created from invoice
 *       404:
 *         description: Invoice not found
 */
router.post(
  '/from-invoice/:invoiceId',
  authenticate,
  requirePermission('claims.create'),
  validate([...invoiceIdParamValidator, ...createClaimFromInvoiceValidator]),
  claimController.createClaimFromInvoice.bind(claimController)
);

/**
 * @swagger
 * /claims/{claimId}:
 *   patch:
 *     summary: Update claim
 *     tags: [Claims]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: claimId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *               amount:
 *                 type: number
 *     responses:
 *       200:
 *         description: Claim updated
 *       404:
 *         description: Claim not found
 */
router.patch(
  '/:claimId',
  authenticate,
  requirePermission('claims.update'),
  validate([...claimIdValidator, ...updateClaimValidator]),
  claimController.updateClaim.bind(claimController)
);

/**
 * @swagger
 * /claims/{claimId}/validate:
 *   post:
 *     summary: Validate claim before submission
 *     tags: [Claims]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: claimId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Validation results
 *       400:
 *         description: Validation failed
 */
router.post(
  '/:claimId/validate',
  authenticate,
  requirePermission('claims.process'),
  validate(claimIdValidator),
  claimController.validateClaim.bind(claimController)
);

/**
 * @swagger
 * /claims/{claimId}/submit:
 *   post:
 *     summary: Submit claim to insurance
 *     tags: [Claims]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: claimId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Claim submitted
 *       400:
 *         description: Claim not ready for submission
 */
router.post(
  '/:claimId/submit',
  authenticate,
  requirePermission('claims.process'),
  validate(claimIdValidator),
  claimController.submitClaim.bind(claimController)
);

/**
 * @swagger
 * /claims/{claimId}/status-history:
 *   get:
 *     summary: Get claim status history
 *     tags: [Claims]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: claimId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Status history
 */
router.get(
  '/:claimId/status-history',
  authenticate,
  requirePermission('claims.read'),
  validate(claimIdValidator),
  claimController.getClaimStatusHistory.bind(claimController)
);

/**
 * @swagger
 * /claims/{claimId}/resubmit:
 *   post:
 *     summary: Resubmit denied claim
 *     tags: [Claims]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: claimId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - correctionNotes
 *             properties:
 *               correctionNotes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Claim resubmitted
 */
router.post(
  '/:claimId/resubmit',
  authenticate,
  requirePermission('claims.update'),
  validate([...claimIdValidator, ...resubmitClaimValidator]),
  claimController.resubmitClaim.bind(claimController)
);

/**
 * @swagger
 * /claims/{claimId}/documents:
 *   post:
 *     summary: Attach document to claim
 *     tags: [Claims]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: claimId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Document attached
 */
router.post(
  '/:claimId/documents',
  authenticate,
  requirePermission('claims.update'),
  validate(claimIdValidator),
  uploadDocumentMiddleware.any(),
  claimController.attachDocument.bind(claimController)
);

/**
 * @swagger
 * /claims/{claimId}/documents:
 *   get:
 *     summary: Get claim documents
 *     tags: [Claims]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: claimId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: List of claim documents
 */
router.get(
  '/:claimId/documents',
  authenticate,
  requirePermission('claims.read'),
  validate(claimIdValidator),
  claimController.getClaimDocuments.bind(claimController)
);

/**
 * @swagger
 * /claims/{claimId}/documents/{documentId}:
 *   delete:
 *     summary: Remove document from claim
 *     tags: [Claims]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: claimId
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Document removed
 */
router.delete(
  '/:claimId/documents/:documentId',
  authenticate,
  requirePermission('claims.update'),
  validate([...claimIdValidator, ...claimDocumentIdValidator]),
  claimController.removeClaimDocument.bind(claimController)
);

export default router;