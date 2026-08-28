import { Router } from 'express';
import { claimController } from '../controllers/claim.controller';
import { authenticate } from '../middleware/auth.middleware';
import { resolveBranchAccess } from '../middleware/branchAccess.middleware';
import { enterTenantContext } from '../middleware/tenantContext.middleware';
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
  voidAndRecreateValidator,
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
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('claims.read'),
  validate(claimSearchValidator),
  claimController.getAllClaims.bind(claimController)
);

/**
 * @swagger
 * /claims/{primaryClaimId}/generate-secondary:
 *   post:
 *     summary: Generate a secondary claim from a primary claim
 *     tags: [Claims]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: primaryClaimId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       201:
 *         description: Secondary claim generated successfully
 */
router.post(
  '/:primaryClaimId/generate-secondary',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('claims.write'),
  claimController.generateSecondaryClaim.bind(claimController)
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
  resolveBranchAccess,
  enterTenantContext,
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
  resolveBranchAccess,
  enterTenantContext,
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
  resolveBranchAccess,
  enterTenantContext,
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
  resolveBranchAccess,
  enterTenantContext,
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
  resolveBranchAccess,
  enterTenantContext,
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
  resolveBranchAccess,
  enterTenantContext,
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
  resolveBranchAccess,
  enterTenantContext,
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
  resolveBranchAccess,
  enterTenantContext,
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
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('claims.process'),
  validate(batchSubmitValidator),
  claimController.batchSubmitClaims.bind(claimController)
);

/**
 * @swagger
 * /claims/batch-payment:
 *   post:
 *     summary: Record a batch payment check or EFT from insurance carrier
 *     description: |
 *       Records a batch payment (check or EFT) from an insurance carrier and allocates 
 *       payments to specific claims.
 *       
 *       **IMPORTANT:** All ID fields (carrierId, claimId) must be sent as **strings**,
 *       not numbers. The validator expects string values.
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
 *                 description: Unique reference number for this batch payment (e.g., check number or EFT reference)
 *                 example: "CHK-2026-001"
 *               carrierId:
 *                 type: string
 *                 description: ID of the insurance carrier (must exist in the carrier table)
 *                 example: "1"
 *               paymentDate:
 *                 type: string
 *                 format: date
 *                 description: Date the payment was received
 *                 example: "2026-06-19"
 *               checkAmount:
 *                 type: number
 *                 description: Total amount of the check or EFT
 *                 example: 2500.00
 *               allocations:
 *                 type: array
 *                 description: List of claim payment allocations
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required:
 *                     - claimId
 *                     - paidAmount
 *                     - writeOff
 *                   properties:
 *                     claimId:
 *                       type: string
 *                       description: ID of the claim being paid (must exist in the claim table)
 *                       example: "1"
 *                     paidAmount:
 *                       type: number
 *                       description: Amount paid for this specific claim
 *                       example: 2000.00
 *                     writeOff:
 *                       type: number
 *                       description: Amount written off for this claim (adjustment)
 *                       example: 500.00
 *           examples:
 *             validRequest:
 *               summary: Valid batch payment request
 *               value:
 *                 paymentRef: "CHK-2026-001"
 *                 carrierId: "1"
 *                 paymentDate: "2026-06-19"
 *                 checkAmount: 2500.00
 *                 allocations:
 *                   - claimId: "1"
 *                     paidAmount: 2000.00
 *                     writeOff: 500.00
 *                   - claimId: "2"
 *                     paidAmount: 300.00
 *                     writeOff: 0.00
 *     responses:
 *       200:
 *         description: Batch payment recorded successfully
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
 *                   example: Batch payment recorded successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     paymentId:
 *                       type: string
 *                       description: ID of the created batch payment
 *                       example: "12345"
 *                     paymentRef:
 *                       type: string
 *                       example: "CHK-2026-001"
 *                     carrierId:
 *                       type: string
 *                       example: "1"
 *                     paymentDate:
 *                       type: string
 *                       format: date
 *                       example: "2026-06-19"
 *                     checkAmount:
 *                       type: number
 *                       example: 2500.00
 *                     allocatedAmount:
 *                       type: number
 *                       example: 2300.00
 *                     writeOffTotal:
 *                       type: number
 *                       example: 500.00
 *                     allocations:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           claimId:
 *                             type: string
 *                           paidAmount:
 *                             type: number
 *                           writeOff:
 *                             type: number
 *       400:
 *         description: Validation error - invalid request body
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       description: Detailed validation error message
 *                       example: "Carrier Id: Invalid value. Allocations[0] claim Id: Invalid value"
 *       401:
 *         description: Unauthorized - missing or invalid JWT token
 *       403:
 *         description: Forbidden - user lacks 'claims.process' permission
 *       404:
 *         description: Carrier or claim not found
 *       500:
 *         description: Internal server error
 */
router.post(
  '/batch-payment',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
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
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('claims.update'),
  validate(paymentIdParamValidator),
  uploadDocumentMiddleware.any(),
  claimController.uploadEOB.bind(claimController)
);

router.delete(
  '/batch-payment/:paymentId/eob/:eobId',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('claims.update'),
  validate(paymentIdParamValidator),
  claimController.deleteEOB.bind(claimController)
);

/**
 * @swagger
 * /claims/batch-invoices:
 *   post:
 *     summary: Generate batch statements/invoices for patients
 *     description: |
 *       Generates batch statements or invoices for multiple patients.
 *       
 *       **IMPORTANT:** 
 *       - Patient IDs should be sent as **strings** in the request body
 *       - The system will convert them to BigInt for database operations
 *       - Delivery preference is optional (defaults to "Email & SMS")
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
 *                 description: Array of patient IDs to generate invoices for
 *                 minItems: 1
 *                 items:
 *                   type: string
 *                   description: Patient ID (must exist in the patient table)
 *                   example: "1"
 *               deliveryPreference:
 *                 type: string
 *                 description: Preferred delivery method for the invoices
 *                 enum: ["Email & SMS", "Email", "SMS", "Mail"]
 *                 default: "Email & SMS"
 *                 example: "Email & SMS"
 *           examples:
 *             singlePatient:
 *               summary: Generate invoice for a single patient
 *               value:
 *                 patientIds: ["1"]
 *                 deliveryPreference: "Email"
 *             multiplePatients:
 *               summary: Generate invoices for multiple patients
 *               value:
 *                 patientIds: ["1", "2", "3"]
 *                 deliveryPreference: "Email & SMS"
 *     responses:
 *       200:
 *         description: Batch invoices generated successfully
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
 *                   example: Batch invoices generated successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalPatients:
 *                       type: integer
 *                       description: Number of patients processed
 *                       example: 3
 *                     invoicesGenerated:
 *                       type: integer
 *                       description: Number of invoices successfully generated
 *                       example: 3
 *                     deliveryMethod:
 *                       type: string
 *                       description: Delivery method used
 *                       example: "Email & SMS"
 *                     patientIds:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: List of patient IDs processed
 *                       example: ["1", "2", "3"]
 *                     failedPatients:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           patientId:
 *                             type: string
 *                           reason:
 *                             type: string
 *                       description: List of patients that failed processing
 *                       example: []
 *       400:
 *         description: Validation error - invalid request body
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       description: Detailed validation error message
 *                       examples:
 *                         emptyPatientIds:
 *                           value: "patientIds must contain at least 1 items"
 *                         invalidPatientId:
 *                           value: "Invalid patient ID format"
 *       401:
 *         description: Unauthorized - missing or invalid JWT token
 *       403:
 *         description: Forbidden - user lacks 'claims.create' permission
 *       404:
 *         description: One or more patients not found
 *       500:
 *         description: Internal server error
 */
router.post(
  '/batch-invoices',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('claims.create'),
  validate(batchInvoicesValidator),
  claimController.generateBatchInvoices.bind(claimController)
);

/**
 * @swagger
 * /claims/procedures/uncomplete:
 *   post:
 *     summary: Revert multiple completed procedures back to treatment-planned status
 *     description: |
 *       Reverts completed procedures (ClaimProc) back to treatment-planned status.
 *       This is useful when procedures were marked as completed but need to be
 *       undone or resubmitted.
 *       
 *       **IMPORTANT:** 
 *       - Procedure IDs should be sent as **strings** in the request body
 *       - The system will convert them to BigInt for database operations
 *       - Only procedures with ClaimNum and ProcedureLog can be uncompleted
 *       - The procedure must have a status that allows reverting (e.g., status >= 1)
 *       - After uncompletion, the procedure is moved to treatment-planned status
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
 *                 description: Array of ClaimProc IDs (procedure IDs) to revert
 *                 minItems: 1
 *                 items:
 *                   type: string
 *                   description: ClaimProc ID (must exist in the claimproc table)
 *                   example: "12345"
 *           examples:
 *             singleProcedure:
 *               summary: Revert a single procedure
 *               value:
 *                 procedureIds: ["12345"]
 *             multipleProcedures:
 *               summary: Revert multiple procedures
 *               value:
 *                 procedureIds: ["12345", "67890", "11111"]
 *     responses:
 *       200:
 *         description: Procedures uncompleted successfully
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
 *                   example: 3 procedures uncompleted successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalProcessed:
 *                       type: integer
 *                       description: Total number of procedures requested
 *                       example: 3
 *                     successful:
 *                       type: integer
 *                       description: Number of procedures successfully reverted
 *                       example: 2
 *                     failed:
 *                       type: integer
 *                       description: Number of procedures that failed to revert
 *                       example: 1
 *                     results:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           procedureId:
 *                             type: string
 *                             description: The procedure ID
 *                           status:
 *                             type: string
 *                             enum: [success, failed]
 *                           message:
 *                             type: string
 *                             description: Status message
 *                       example:
 *                         - procedureId: "12345"
 *                           status: "success"
 *                           message: "Procedure reverted to treatment-planned status"
 *                         - procedureId: "67890"
 *                           status: "failed"
 *                           message: "Procedure not found"
 *       400:
 *         description: Validation error - invalid request body
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       description: Detailed validation error message
 *                       examples:
 *                         emptyIds:
 *                           value: "procedureIds must contain at least 1 items"
 *                         invalidProcedureId:
 *                           value: "Invalid procedure ID format"
 *                         alreadyCompleted:
 *                           value: "Procedure already completed"
 *                         noClaimAttached:
 *                           value: "Procedure has no claim attached"
 *       401:
 *         description: Unauthorized - missing or invalid JWT token
 *       403:
 *         description: Forbidden - user lacks 'claims.update' permission
 *       404:
 *         description: One or more procedures not found
 *       409:
 *         description: Conflict - procedure cannot be uncompleted (e.g., already in correct state)
 *       500:
 *         description: Internal server error
 */
router.post(
  '/procedures/uncomplete',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
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
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('claims.read'),
  validate(claimIdValidator),
  claimController.getClaimById.bind(claimController)
);

/**
 * @swagger
 * /claims/{claimId}/pdf:
 *   get:
 *     summary: Generate and retrieve the ADA Claim Form PDF
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
 *         description: PDF file buffer
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Invalid claim ID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - missing claims.read permission
 *       404:
 *         description: Claim not found
 */
router.get(
  '/:claimId/pdf',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('claims.read'),
  validate(claimIdValidator),
  claimController.getClaimPdf.bind(claimController)
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
  resolveBranchAccess,
  enterTenantContext,
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
  resolveBranchAccess,
  enterTenantContext,
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
  resolveBranchAccess,
  enterTenantContext,
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
  resolveBranchAccess,
  enterTenantContext,
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
  resolveBranchAccess,
  enterTenantContext,
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
  resolveBranchAccess,
  enterTenantContext,
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
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('claims.update'),
  validate(claimIdValidator),
  uploadDocumentMiddleware.any(),
  claimController.attachDocument.bind(claimController)
);

/**
 * @swagger
 * /claims/{claimId}/eob:
 *   post:
 *     summary: Upload EOB document directly for a claim
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
  '/:claimId/eob',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('claims.update'),
  validate(claimIdValidator),
  uploadDocumentMiddleware.any(),
  claimController.uploadClaimEOB.bind(claimController)
);

/**
 * @swagger
 * /claims/{claimId}/eob/{eobId}:
 *   delete:
 *     summary: Delete EOB document directly from a claim
 *     tags: [Claims]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: claimId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: eobId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: EOB document deleted successfully
 */
router.delete(
  '/:claimId/eob/:eobId',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('claims.update'),
  validate(claimIdValidator),
  claimController.deleteClaimEOB.bind(claimController)
);

/**
 * @swagger
 * /claims/{claimId}/attachments:
 *   post:
 *     summary: Upload multiple attachments for a claim
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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       201:
 *         description: Attachments uploaded successfully
 */
router.post(
  '/:claimId/attachments',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('claims.update'),
  validate(claimIdValidator),
  uploadDocumentMiddleware.array('attachments'),
  claimController.uploadAttachments.bind(claimController)
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
  resolveBranchAccess,
  enterTenantContext,
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
  resolveBranchAccess,
  enterTenantContext,
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
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('claims.read'),
  validate(claimIdValidator),
  claimController.getClearinghouseStatus.bind(claimController)
);
/**
 * @swagger
 * /claims/{claimId}/quick-status:
 *   post:
 *     summary: Quick status update for a claim with a tracking note
 *     description: |
 *       Updates the status of a claim and adds a tracking note in one operation.
 *       This is useful for quick status changes without having to use separate endpoints.
 *       
 *       **Valid status values (must be one of the following):**
 *       
 *       | Status Value | Description |
 *       |--------------|-------------|
 *       | `draft` | Claim is in draft mode |
 *       | `submitted` | Claim has been submitted to insurance |
 *       | `pending` | Claim is pending review |
 *       | `paid` | Claim has been fully paid |
 *       | `partial` | Claim has been partially paid |
 *       | `partially_paid` | Claim has been partially paid (alternative) |
 *       | `accepted` | Claim has been accepted by insurance |
 *       | `denied` | Claim has been denied |
 *       | `rejected` | Claim has been rejected |
 *       | `cancelled` | Claim has been cancelled |
 *       
 *       **IMPORTANT:** 
 *       - Status must be in **lowercase** (e.g., `"accepted"`, not `"Accepted"`)
 *       - Claim ID in the path must be a valid claim ID
 *       - The claim must exist in the database
 *       - Note is optional but recommended for tracking
 *     tags: [Claims]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: claimId
 *         required: true
 *         schema:
 *           type: string
 *         description: Claim ID (must exist in the claim table)
 *         example: "1"
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
 *                 description: Status code to update the claim to
 *                 enum:
 *                   - draft
 *                   - submitted
 *                   - pending
 *                   - paid
 *                   - partial
 *                   - partially_paid
 *                   - accepted
 *                   - denied
 *                   - rejected
 *                   - cancelled
 *                 example: "accepted"
 *               note:
 *                 type: string
 *                 description: Optional tracking note explaining the status change
 *                 example: "Claim was reviewed and accepted by the insurance carrier"
 *           examples:
 *             acceptClaim:
 *               summary: Accept a claim
 *               value:
 *                 status: "accepted"
 *                 note: "Claim accepted by insurance. Payment pending."
 *             denyClaim:
 *               summary: Deny a claim with reason
 *               value:
 *                 status: "denied"
 *                 note: "Claim denied due to missing documentation. Resubmission needed."
 *             markAsPaid:
 *               summary: Mark claim as paid
 *               value:
 *                 status: "paid"
 *                 note: "Full payment received from insurance carrier."
 *             markAsSubmitted:
 *               summary: Mark claim as submitted
 *               value:
 *                 status: "submitted"
 *                 note: "Claim submitted via electronic clearinghouse."
 *             markAsDraft:
 *               summary: Revert claim to draft
 *               value:
 *                 status: "draft"
 *                 note: "Claim reverted to draft for additional review."
 *     responses:
 *       200:
 *         description: Claim status updated successfully
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
 *                   example: Claim status updated successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     claimId:
 *                       type: string
 *                       description: The claim ID that was updated
 *                       example: "1"
 *                     previousStatus:
 *                       type: string
 *                       description: The previous status of the claim
 *                       enum:
 *                         - draft
 *                         - submitted
 *                         - pending
 *                         - paid
 *                         - partial
 *                         - partially_paid
 *                         - accepted
 *                         - denied
 *                         - rejected
 *                         - cancelled
 *                       example: "submitted"
 *                     newStatus:
 *                       type: string
 *                       description: The new status of the claim
 *                       enum:
 *                         - draft
 *                         - submitted
 *                         - pending
 *                         - paid
 *                         - partial
 *                         - partially_paid
 *                         - accepted
 *                         - denied
 *                         - rejected
 *                         - cancelled
 *                       example: "accepted"
 *                     note:
 *                       type: string
 *                       description: The tracking note added
 *                       example: "Claim accepted by insurance. Payment pending."
 *                     trackingId:
 *                       type: string
 *                       description: The ID of the tracking record created
 *                       example: "12345"
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                       description: Timestamp of the update
 *                       example: "2026-06-19T10:30:00.000Z"
 *       400:
 *         description: Validation error - invalid request body
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       description: Detailed validation error message
 *                       examples:
 *                         invalidStatus:
 *                           value: "Status: Invalid status value"
 *                         missingStatus:
 *                           value: "Status: Required field"
 *                         invalidClaimId:
 *                           value: "Claim ID: Invalid value"
 *       401:
 *         description: Unauthorized - missing or invalid JWT token
 *       403:
 *         description: Forbidden - user lacks 'claims.update' permission
 *       404:
 *         description: Claim not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "Claim with ID 1 not found"
 *       409:
 *         description: Conflict - invalid status transition
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "Cannot transition from 'paid' to 'draft'"
 *       500:
 *         description: Internal server error
 */
router.post(
  '/:claimId/quick-status',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('claims.update'),
  validate([...claimIdValidator, ...quickStatusUpdateValidator]),
  claimController.quickStatusUpdate.bind(claimController)
);

/**
 * @swagger
 * /claims/{claimId}/void-and-recreate:
 *   post:
 *     summary: Void and recreate a claim
 *     description: Voids an existing submitted/processed claim and returns it to the unsent queue (readyForSubmission status), resetting submission timestamps and recording an audit trail entry.
 *     tags: [Claims]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: claimId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the claim to void and recreate
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               note:
 *                 type: string
 *                 description: Reason or note for voiding and recreating
 *                 example: "Voided and recreated - returned to unsent queue"
 *     responses:
 *       200:
 *         description: Claim voided and recreated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     claim:
 *                       $ref: '#/components/schemas/Claim'
 *                 message:
 *                   type: string
 *                   example: "Claim voided and recreated successfully"
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Claim not found
 *       500:
 *         description: Internal server error
 */
router.post(
  '/:claimId/void-and-recreate',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('claims.update'),
  validate([...claimIdValidator, ...voidAndRecreateValidator]),
  claimController.voidAndRecreate.bind(claimController)
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
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('claims.create'),
  validate(createManualClaimValidator),
  claimController.createManualClaim.bind(claimController)
);

/**
 * @swagger
 * /claims/{claimId}/attachments/link:
 *   post:
 *     summary: Link existing S3 EOB attachments to claim
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
 *               - attachments
 *             properties:
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - storagePath
 *                   properties:
 *                     filename:
 *                       type: string
 *                     storagePath:
 *                       type: string
 *     responses:
 *       200:
 *         description: Attachments linked successfully
 */
router.post(
  '/:claimId/attachments/link',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('claims.update'),
  validate(claimIdValidator),
  claimController.linkAttachments.bind(claimController)
);

export default router;

