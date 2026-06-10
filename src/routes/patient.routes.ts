import { Router } from 'express';
import { body } from 'express-validator';
import { appointmentController } from '../controllers/appointment.controller';
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
router.put('/:patientId', requireRoles('Receptionist', 'Admin'), validate([...patientIdValidator, ...updatePatientValidator]), patientController.updatePatient.bind(patientController));
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
 * /patients/{patientId}/appointments:
 *   get:
 *     summary: Get patient appointments
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *         description: Number of appointments to return (default 10)
 *     responses:
 *       200: { description: List of patient appointments }
 *       404: { description: Not found }
 */
router.get('/:patientId/appointments', requireRoles('Receptionist', 'Admin', 'Doctor', 'Provider'), validate(patientIdValidator), appointmentController.getPatientAppointments.bind(appointmentController));

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
 *         schema:
 *           type: integer
 *         description: Patient ID
 *         example: 1
 *     responses:
 *       200:
 *         description: List of allergies
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   patientId:
 *                     type: integer
 *                   allergen:
 *                     type: string
 *                   severity:
 *                     type: string
 *                   reaction:
 *                     type: string
 *                   status:
 *                     type: string
 *                   documentedDate:
 *                     type: string
 *                   notes:
 *                     type: string
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Patient not found
 * 
 *   post:
 *     summary: Add allergy to patient
 *     description: Create a new allergy record for a specific patient
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Patient ID
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - allergen
 *               - severity
 *               - reaction
 *               - documentedDate
 *             properties:
 *               allergen:
 *                 type: string
 *                 description: Name of the allergen (e.g., Penicillin, Latex, Peanuts, Shellfish)
 *                 example: "Penicillin"
 *                 minLength: 1
 *                 maxLength: 255
 *               severity:
 *                 type: string
 *                 description: Severity level of the allergy
 *                 enum: [mild, moderate, severe, life-threatening]
 *                 example: "severe"
 *               reaction:
 *                 type: string
 *                 description: Physical reaction to the allergen
 *                 example: "Hives, difficulty breathing, swelling of throat"
 *                 maxLength: 500
 *               documentedDate:
 *                 type: string
 *                 format: date
 *                 description: Date when the allergy was documented
 *                 example: "2024-03-15"
 *               status:
 *                 type: string
 *                 description: Current status of the allergy
 *                 enum: [active, inactive, resolved]
 *                 default: active
 *                 example: "active"
 *               notes:
 *                 type: string
 *                 description: Additional clinical notes or comments
 *                 example: "Patient carries EpiPen. Previous reaction required emergency room visit."
 *                 maxLength: 1000
 *               onsetDate:
 *                 type: string
 *                 format: date
 *                 description: Date when the allergy first appeared
 *                 example: "2018-06-20"
 *               diagnosedBy:
 *                 type: string
 *                 description: Name of the diagnosing provider
 *                 example: "Dr. Sarah Mitchell"
 *           example:
 *             allergen: "Penicillin"
 *             severity: "severe"
 *             reaction: "Hives, difficulty breathing, swelling"
 *             documentedDate: "2024-03-15"
 *             status: "active"
 *             notes: "Patient carries EpiPen"
 *     responses:
 *       201:
 *         description: Allergy added successfully
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
 *                   example: "Allergy added successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     patientId:
 *                       type: integer
 *                     allergen:
 *                       type: string
 *                     severity:
 *                       type: string
 *                     reaction:
 *                       type: string
 *                     documentedDate:
 *                       type: string
 *                     status:
 *                       type: string
 *                     notes:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                     updatedAt:
 *                       type: string
 *       400:
 *         description: Bad request - missing required fields or invalid data
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
 *                       example: "Allergen is required. Severity is required. Reaction is required. Documented date is required"
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       404:
 *         description: Patient not found
 *       500:
 *         description: Internal server error
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