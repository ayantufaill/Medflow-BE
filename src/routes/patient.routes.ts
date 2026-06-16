import { Router } from 'express';
import { body } from 'express-validator';
import { patientController } from '../controllers/patient.controller';
import { insurancePlanController } from '../controllers/insurance-plan.controller';
import { allergyController } from '../controllers/allergy.controller';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  patientIdValidator, patientRequestIdValidator, createPatientValidator,
  updatePatientValidator, patientSearchValidator, patientWorkspaceMetaValidator,
  createPatientUpdateRequestValidator, applyPatientReconciliationValidator,
  patientCommunicationValidator, patientMedicalHistoryValidator, patientDentalHistoryValidator,
} from '../validators/patient.validator';
import { createPatientInsuranceValidator } from '../validators/insurance.validator';
import { createPatientAllergyValidator, updateAllergyValidator, allergyIdParamValidator } from '../validators/allergy.validator';

const router = Router();
router.use(authenticate);

/**
 * @swagger
 * /patients:
 *   get:
 *     summary: Get all patients
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200: { description: List of patients }
 *       403: { description: Forbidden }
 *   post:
 *     summary: Create a new patient
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [firstName, lastName, dateOfBirth]
 *             properties:
 *               firstName: { type: string }
 *               lastName: { type: string }
 *               dateOfBirth: { type: string, format: date }
 *               email: { type: string, format: email }
 *               phone: { type: string }
 *     responses:
 *       201: { description: Patient created }
 *       403: { description: Forbidden }
 */
router.get('/', requireRoles('Receptionist', 'Admin'), validate(patientSearchValidator), patientController.getAllPatients.bind(patientController));
router.post('/', requireRoles('Receptionist', 'Admin'), validate(createPatientValidator), patientController.createPatient.bind(patientController));

/**
 * @swagger
 * /patients/search:
 *   get:
 *     summary: Search patients
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *     responses:
 *       200: { description: Search results }
 */
router.get('/search', requireRoles('Receptionist', 'Admin'), validate(patientSearchValidator), patientController.searchPatients.bind(patientController));

/**
 * @swagger
 * /patients/check-duplicates:
 *   post:
 *     summary: Check for duplicate patients
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [firstName, lastName, dateOfBirth]
 *             properties:
 *               firstName: { type: string }
 *               lastName: { type: string }
 *               dateOfBirth: { type: string, format: date }
 *     responses:
 *       200: { description: Duplicate check result }
 */
router.post('/check-duplicates', requireRoles('Receptionist', 'Admin'), validate([
  body('firstName').notEmpty(),
  body('lastName').notEmpty(),
  body('dateOfBirth').notEmpty().isISO8601(),
]), patientController.checkDuplicates.bind(patientController));

/**
 * @swagger
 * /patients/{patientId}:
 *   get:
 *     summary: Get patient by ID
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Patient details }
 *       404: { description: Not found }
 *   put:
 *     summary: Update patient
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Patient updated }
 *   delete:
 *     summary: Delete patient (Admin only)
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Patient deleted }
 *       403: { description: Forbidden }
 */
router.get('/:patientId', requireRoles('Receptionist', 'Admin'), validate(patientIdValidator), patientController.getPatientById.bind(patientController));
router.patch('/:patientId', requireRoles('Receptionist', 'Admin'), validate([...patientIdValidator, ...updatePatientValidator]), patientController.updatePatient.bind(patientController));
router.delete('/:patientId', requireRoles('Admin'), validate(patientIdValidator), patientController.deletePatient.bind(patientController));

/**
 * @swagger
 * /patients/{patientId}/balance:
 *   get:
 *     summary: Get patient account balance
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Account balance }
 */
router.get('/:patientId/balance', requireRoles('Receptionist', 'Admin', 'Billing Staff'), validate(patientIdValidator), patientController.getPatientBalance.bind(patientController));

/**
 * @swagger
 * /patients/{patientId}/last-visit:
 *   get:
 *     summary: Get patient's last completed visit
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Last visit details }
 *       404: { description: No completed appointments found }
 */
router.get('/:patientId/last-visit', requireRoles('Receptionist', 'Admin', 'Doctor', 'Provider'), validate(patientIdValidator), patientController.getPatientLastVisit.bind(patientController));

/**
 * @swagger
 * /patients/{patientId}/workspace:
 *   get:
 *     summary: Get patient workspace
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Patient workspace }
 *   patch:
 *     summary: Update patient workspace metadata
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Workspace updated }
 */
router.get('/:patientId/workspace', requireRoles('Receptionist', 'Admin', 'Doctor', 'Provider'), validate(patientIdValidator), patientController.getPatientWorkspace.bind(patientController));
router.patch('/:patientId/workspace', requireRoles('Receptionist', 'Admin'), validate([...patientIdValidator, ...patientWorkspaceMetaValidator]), patientController.updatePatientWorkspaceMeta.bind(patientController));

/**
 * @swagger
 * /patients/{patientId}/medical-history:
 *   get:
 *     summary: Get patient medical history
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Medical history }
 *   patch:
 *     summary: Update patient medical history
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Medical history updated }
 */
router.get('/:patientId/medical-history', requireRoles('Receptionist', 'Admin', 'Doctor', 'Provider'), validate(patientIdValidator), patientController.getStructuredMedicalHistory.bind(patientController));
router.patch('/:patientId/medical-history', requireRoles('Receptionist', 'Admin', 'Doctor', 'Provider'), validate([...patientIdValidator, ...patientMedicalHistoryValidator]), patientController.updateStructuredMedicalHistory.bind(patientController));

/**
 * @swagger
 * /patients/{patientId}/dental-history:
 *   get:
 *     summary: Get patient dental history
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Dental history }
 *   patch:
 *     summary: Update patient dental history
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Dental history updated }
 */
router.get('/:patientId/dental-history', requireRoles('Receptionist', 'Admin', 'Doctor', 'Provider'), validate(patientIdValidator), patientController.getDentalHistory.bind(patientController));
router.patch('/:patientId/dental-history', requireRoles('Receptionist', 'Admin', 'Doctor', 'Provider'), validate([...patientIdValidator, ...patientDentalHistoryValidator]), patientController.updateDentalHistory.bind(patientController));


/**
 * @swagger
 * /patients/{patientId}/history:
 *   get:
 *     summary: Get patient history aggregate
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Patient history aggregate including allergies, conditions, medications and vitals }
 *       404: { description: Not found }
 */
router.get('/:patientId/history', requireRoles('Receptionist', 'Admin', 'Doctor', 'Provider'), validate(patientIdValidator), patientController.getPatientHistory.bind(patientController));
/**
 * @swagger
 * /patients/{patientId}/allergies:
 *   get:
 *     summary: Get patient allergies
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: List of allergies }
 *   post:
 *     summary: Add allergy to patient
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [allergen, reaction, severity, documentedDate]
 *             properties:
 *               allergen: { type: string, example: "Penicillin" }
 *               reaction: { type: string, example: "Hives and difficulty breathing" }
 *               severity: { type: string, enum: [mild, moderate, severe], example: "severe" }
 *               documentedBy: { type: integer, example: 1 }
 *               documentedDate: { type: string, format: date-time, example: "2026-06-16T12:00:00.000Z" }
 *               isActive: { type: boolean, example: true }
 *     responses:
 *       201: { description: Allergy added }
 */
router.get('/:patientId/allergies', validate(patientIdValidator), requireRoles('Receptionist', 'Doctor', 'Admin'), allergyController.getPatientAllergies.bind(allergyController));
router.post('/:patientId/allergies', requireRoles('Receptionist', 'Doctor', 'Admin'), validate([...patientIdValidator, ...createPatientAllergyValidator]), allergyController.createPatientAllergy.bind(allergyController));

/**
 * @swagger
 * /patients/{patientId}/allergies/{allergyId}:
 *   get:
 *     summary: Get allergy by ID
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: allergyId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Allergy details }
 *   put:
 *     summary: Update patient allergy
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: allergyId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Allergy updated }
 *   delete:
 *     summary: Delete patient allergy
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: allergyId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Allergy deleted }
 */
router.get('/:patientId/allergies/:allergyId', requireRoles('Receptionist', 'Doctor', 'Admin'), validate([...patientIdValidator, ...allergyIdParamValidator]), allergyController.getAllergyById.bind(allergyController));
router.put('/:patientId/allergies/:allergyId', requireRoles('Receptionist', 'Doctor', 'Admin'), validate([...patientIdValidator, ...allergyIdParamValidator, ...updateAllergyValidator]), allergyController.updatePatientAllergy.bind(allergyController));
router.delete('/:patientId/allergies/:allergyId', requireRoles('Receptionist', 'Doctor', 'Admin'), validate([...patientIdValidator, ...allergyIdParamValidator]), allergyController.deletePatientAllergy.bind(allergyController));

/**
 * @swagger
 * /patients/{patientId}/communications:
 *   get:
 *     summary: Get patient communications
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: List of communications }
 */
router.get('/:patientId/communications', requireRoles('Receptionist', 'Admin', 'Doctor', 'Provider'), validate(patientIdValidator), patientController.getPatientCommunications.bind(patientController));
router.post('/:patientId/communications/send', requireRoles('Receptionist', 'Admin', 'Doctor', 'Provider'), validate([...patientIdValidator, ...patientCommunicationValidator]), patientController.createPatientCommunication.bind(patientController));

router.get('/:patientId/update-requests', requireRoles('Receptionist', 'Admin', 'Doctor', 'Provider'), validate(patientIdValidator), patientController.getPatientUpdateRequests.bind(patientController));
router.post('/:patientId/update-requests', requireRoles('Receptionist', 'Admin'), validate([...patientIdValidator, ...createPatientUpdateRequestValidator]), patientController.createPatientUpdateRequest.bind(patientController));
router.get('/:patientId/reconciliation/:requestId', requireRoles('Receptionist', 'Admin', 'Doctor', 'Provider'), validate([...patientIdValidator, ...patientRequestIdValidator]), patientController.getPatientReconciliation.bind(patientController));
router.post('/:patientId/reconciliation/:requestId/apply', requireRoles('Receptionist', 'Admin'), validate([...patientIdValidator, ...patientRequestIdValidator, ...applyPatientReconciliationValidator]), patientController.applyPatientReconciliation.bind(patientController));
router.get('/:patientId/audit-history', requireRoles('Receptionist', 'Admin', 'Doctor', 'Provider'), validate(patientIdValidator), patientController.getPatientAuditHistory.bind(patientController));
router.get('/:patientId/coverages', requireRoles('Receptionist', 'Admin', 'Billing Staff'), validate(patientIdValidator), insurancePlanController.getPatientCoverages.bind(insurancePlanController));
router.post('/:patientId/coverages', requireRoles('Receptionist', 'Admin', 'Billing Staff'), validate([...patientIdValidator, ...createPatientInsuranceValidator]), insurancePlanController.createPatientCoverage.bind(insurancePlanController));
router.get('/:patientId/reports/summary', requireRoles('Receptionist', 'Admin', 'Doctor', 'Provider'), validate(patientIdValidator), patientController.getPatientReportSummary.bind(patientController));
router.get('/:patientId/reports/showcase', requireRoles('Receptionist', 'Admin', 'Doctor', 'Provider'), validate(patientIdValidator), patientController.getPatientReportShowcase.bind(patientController));
router.get('/:patientId/reports/concerns', requireRoles('Receptionist', 'Admin', 'Doctor', 'Provider'), validate(patientIdValidator), patientController.getPatientReportConcerns.bind(patientController));
router.post('/:patientId/reports/refresh', requireRoles('Receptionist', 'Admin', 'Doctor', 'Provider'), validate(patientIdValidator), patientController.refreshPatientReports.bind(patientController));

export default router;