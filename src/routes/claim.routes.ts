import { Router } from 'express';
import { claimController } from '../controllers/claim.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { createManualClaimValidator } from '../validators/claim.validator';
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
  batchSubmitValidator,
  recordBatchPaymentValidator,
  batchInvoicesValidator,
  quickStatusUpdateValidator,
  paymentIdParamValidator,
  uncompleteProceduresValidator,
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
 * /claims/tab-summary:
 *   get:
 *     summary: Get claims statistics and counts for tabs
 *     tags: [Claims]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tab summary counts
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/tab-summary',
  authenticate,
  requirePermission('claims.read'),
  claimController.getTabSummary.bind(claimController)
);

/**
 * @swagger
 * /claims/outstanding:
 *   get:
 *     summary: Get outstanding claims (aging report)
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
 *         name: dateRange
 *         schema: { type: string, enum: [none, 0_30, 31_60, 61_90, 90_plus] }
 *       - in: query
 *         name: groupBy
 *         schema: { type: string, enum: [none, carrier, patient, provider] }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of outstanding claims
 */
router.get(
  '/outstanding',
  authenticate,
  requirePermission('claims.read'),
  claimController.getOutstandingClaims.bind(claimController)
);

/**
 * @swagger
 * /claims/outstanding-for-allocation:
 *   get:
 *     summary: Get outstanding claims list specifically formatted for payment check allocation dropdowns
 *     tags: [Claims]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of outstanding claims for check allocation
 */
router.get(
  '/outstanding-for-allocation',
  authenticate,
  requirePermission('claims.read'),
  claimController.getOutstandingClaimsForAllocation.bind(claimController)
);

/**
 * @swagger
 * /claims/predeterminations:
 *   get:
 *     summary: Get predetermination claims (PreAuth)
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
 *         name: patientId
 *         schema: { type: string }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of predeterminations
 */
router.get(
  '/predeterminations',
  authenticate,
  requirePermission('claims.read'),
  claimController.getPredeterminations.bind(claimController)
);

/**
 * @swagger
 * /claims/dentical-reports:
 *   get:
 *     summary: Get Dentical remittance and eligibility reports
 *     tags: [Claims]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of Dentical reports
 */
router.get(
  '/dentical-reports',
  authenticate,
  requirePermission('claims.read'),
  claimController.getDenticalReports.bind(claimController)
);

/**
 * @swagger
 * /claims/era-reports:
 *   get:
 *     summary: Get ERA reports
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
 *         name: eraTab
 *         schema: { type: string, enum: [active, voided] }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of ERA reports
 */
router.get(
  '/era-reports',
  authenticate,
  requirePermission('claims.read'),
  claimController.getEraReports.bind(claimController)
);

/**
 * @swagger
 * /claims/pending-procedures:
 *   get:
 *     summary: Get procedures pending claim creation grouped by patient
 *     tags: [Claims]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of pending procedures
 */
router.get(
  '/pending-procedures',
  authenticate,
  requirePermission('claims.read'),
  claimController.getPendingProcedures.bind(claimController)
);

/**
 * @swagger
 * /claims/batch-payments:
 *   get:
 *     summary: Get batch payments recorded
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
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of batch payments
 */
router.get(
  '/batch-payments',
  authenticate,
  requirePermission('claims.read'),
  claimController.getBatchPayments.bind(claimController)
);

/**
 * @swagger
 * /claims/batch-submit:
 *   post:
 *     summary: Submit multiple claims in a batch
 *     tags: [Claims]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - claimIds
 *             properties:
 *               claimIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               submissionType:
 *                 type: string
 *                 enum: [electronic, paper]
 *     responses:
 *       200:
 *         description: Batch submission results
 */
router.post(
  '/batch-submit',
  authenticate,
  requirePermission('claims.process'),
  validate(batchSubmitValidator),
  claimController.batchSubmitClaims.bind(claimController)
);

/**
 * @swagger
 * /claims/batch-payment:
 *   post:
 *     summary: Record a batch payment check or EFT from insurance carrier
 *     tags: [Claims]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - paymentRef
 *               - carrierId
 *               - paymentDate
 *               - checkAmount
 *               - allocations
 *             properties:
 *               paymentRef:
 *                 type: string
 *               carrierId:
 *                 type: string
 *               paymentDate:
 *                 type: string
 *                 format: date
 *               checkAmount:
 *                 type: number
 *               allocations:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - claimId
 *                     - paidAmount
 *                     - writeOff
 *                   properties:
 *                     claimId:
 *                       type: string
 *                     paidAmount:
 *                       type: number
 *                     writeOff:
 *                       type: number
 *     responses:
 *       200:
 *         description: Batch payment recorded successfully
 */
router.post(
  '/batch-payment',
  authenticate,
  requirePermission('claims.process'),
  validate(recordBatchPaymentValidator),
  claimController.recordBatchPayment.bind(claimController)
);

/**
 * @swagger
 * /claims/batch-payment/{paymentId}/eob:
 *   post:
 *     summary: Upload EOB (Explanation of Benefits) document for a batch payment
 *     tags: [Claims]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema: { type: string }
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
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: EOB document uploaded successfully
 */
router.post(
  '/batch-payment/:paymentId/eob',
  authenticate,
  requirePermission('claims.update'),
  validate(paymentIdParamValidator),
  uploadDocumentMiddleware.any(),
  claimController.uploadEOB.bind(claimController)
);

/**
 * @swagger
 * /claims/batch-invoices:
 *   post:
 *     summary: Generate batch statements/invoices for patients
 *     tags: [Claims]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - patientIds
 *             properties:
 *               patientIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               deliveryPreference:
 *                 type: string
 *                 enum: [Email & SMS, Email, SMS, Mail]
 *     responses:
 *       200:
 *         description: Batch invoices generated
 */
router.post(
  '/batch-invoices',
  authenticate,
  requirePermission('claims.create'),
  validate(batchInvoicesValidator),
  claimController.generateBatchInvoices.bind(claimController)
);

/**
 * @swagger
 * /claims/procedures/uncomplete:
 *   post:
 *     summary: Revert multiple completed procedures back to treatment-planned status
 *     tags: [Claims]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - procedureIds
 *             properties:
 *               procedureIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Procedures uncompleted successfully
 */
router.post(
  '/procedures/uncomplete',
  authenticate,
  requirePermission('claims.update'),
  validate(uncompleteProceduresValidator),
  claimController.uncompleteProcedures.bind(claimController)
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

/**
 * @swagger
 * /claims/{claimId}/clearinghouse:
 *   get:
 *     summary: Get clearinghouse transmission status for a claim
 *     tags: [Claims]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: claimId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Clearinghouse transmission details
 */
router.get(
  '/:claimId/clearinghouse',
  authenticate,
  requirePermission('claims.read'),
  validate(claimIdValidator),
  claimController.getClearinghouseStatus.bind(claimController)
);

/**
 * @swagger
 * /claims/{claimId}/quick-status:
 *   post:
 *     summary: Quick status update for a claim with a tracking note
 *     tags: [Claims]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: claimId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *               note:
 *                 type: string
 *     responses:
 *       200:
 *         description: Claim status updated successfully
 */
router.post(
  '/:claimId/quick-status',
  authenticate,
  requirePermission('claims.update'),
  validate([...claimIdValidator, ...quickStatusUpdateValidator]),
  claimController.quickStatusUpdate.bind(claimController)
);

/**
 * @swagger
 * /claims/manual:
 *   post:
 *     summary: Create a manual claim from selected procedures
 *     description: Creates a claim using specifically selected procedure items from one or more invoices. Allows overriding providers, selecting insurance, and adding narrative notes.
 *     tags: [Claims]
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
 *               - insuranceId
 *               - treatingProviderId
 *               - billingEntityId
 *               - selectedItems
 *             properties:
 *               patientId:
 *                 type: string
 *                 description: ID of the patient
 *                 example: "12345"
 *               insuranceId:
 *                 type: string
 *                 description: ID of the insurance plan
 *                 example: "67890"
 *               treatingProviderId:
 *                 type: string
 *                 description: ID of the treating provider
 *                 example: "100"
 *               billingEntityId:
 *                 type: string
 *                 description: ID of the billing entity/provider
 *                 example: "101"
 *               claimType:
 *                 type: string
 *                 enum: [Manual, Electronic]
 *                 description: Type of claim submission
 *                 default: Manual
 *                 example: "Manual"
 *               description:
 *                 type: string
 *                 description: Brief description of the claim
 *                 example: "Routine dental procedures"
 *               note:
 *                 type: string
 *                 description: Additional narrative notes
 *                 example: "Patient requires prior authorization"
 *               selectedItems:
 *                 type: array
 *                 description: List of procedures to include in the claim
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required:
 *                     - invoiceId
 *                     - itemId
 *                     - amount
 *                   properties:
 *                     invoiceId:
 *                       type: string
 *                       description: ID of the invoice containing the procedure
 *                       example: "12345"
 *                     itemId:
 *                       type: string
 *                       description: ID of the procedure/item to include
 *                       example: "67890"
 *                     amount:
 *                       type: number
 *                       description: Amount to claim for this procedure
 *                       example: 150.00
 *     responses:
 *       201:
 *         description: Manual claim created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Manual claim created successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       example: "12345"
 *                     claimNumber:
 *                       type: string
 *                       example: "CLM001234"
 *                     patientId:
 *                       type: string
 *                       example: "12345"
 *                     insuranceId:
 *                       type: string
 *                       example: "67890"
 *                     treatingProviderId:
 *                       type: string
 *                       example: "100"
 *                     billingEntityId:
 *                       type: string
 *                       example: "101"
 *                     claimType:
 *                       type: string
 *                       example: "Manual"
 *                     totalAmount:
 *                       type: number
 *                       example: 350.00
 *                     status:
 *                       type: string
 *                       example: "W"
 *                     statusDisplay:
 *                       type: string
 *                       example: "Waiting"
 *                     note:
 *                       type: string
 *                       example: "Patient requires prior authorization"
 *                     description:
 *                       type: string
 *                       example: "Routine dental procedures"
 *                     selectedItems:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           invoiceId:
 *                             type: string
 *                           itemId:
 *                             type: string
 *                           amount:
 *                             type: number
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     createdBy:
 *                       type: string
 *       400:
 *         description: Validation error - missing required fields or invalid data
 *       401:
 *         description: Unauthorized - missing or invalid token
 *       403:
 *         description: Forbidden - missing claims.create permission
 *       404:
 *         description: Patient, insurance, provider, or billing entity not found
 *       409:
 *         description: Conflict - duplicate claim
 *       500:
 *         description: Internal server error
 */
router.post(
  '/manual',
  authenticate,
  requirePermission('claims.create'),
  validate(createManualClaimValidator),
  claimController.createManualClaim.bind(claimController)
);

export default router;