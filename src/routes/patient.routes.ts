import { Router } from 'express';
import { body } from 'express-validator';
import { patientController } from '../controllers/patient.controller';
import { patientInsuranceController } from '../controllers/patient-insurance.controller';
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
import { createPatientInsuranceValidator, updatePatientInsuranceValidator, patientInsuranceIdValidator } from '../validators/insurance.validator';
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
 *               firstName:
 *                 type: string
 *                 description: Patient's first name
 *                 example: "John"
 *               lastName:
 *                 type: string
 *                 description: Patient's last name
 *                 example: "Doe"
 *               dateOfBirth:
 *                 type: string
 *                 format: date-time
 *                 description: Date of birth in ISO-8601 format (YYYY-MM-DDThh:mm:ssZ)
 *                 example: "1990-05-15T00:00:00.000Z"
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Patient's email address
 *                 example: "john.doe@example.com"
 *               phone:
 *                 type: string
 *                 description: Patient's phone number
 *                 example: "+1234567890"
 *               gender:
 *                 type: string
 *                 enum: [male, female, non_binary, prefer_not_to_say, unknown]
 *                 description: Patient's gender (lowercase)
 *                 example: "male"
 *               address:
 *                 type: string
 *                 description: Patient's address
 *                 example: "123 Main St, City, State 12345"
 *     responses:
 *       201:
 *         description: Patient created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                 message:
 *                   type: string
 *       400:
 *         description: Bad request - invalid date format or missing required fields
 *       403:
 *         description: Forbidden - insufficient permissions
 *       409:
 *         description: Conflict - patient with same name and birthdate exists
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
 *         description: Search query (name, email, phone)
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
 *               firstName:
 *                 type: string
 *                 example: "John"
 *               lastName:
 *                 type: string
 *                 example: "Doe"
 *               dateOfBirth:
 *                 type: string
 *                 format: date-time
 *                 description: Date of birth in ISO-8601 format
 *                 example: "1990-05-15T00:00:00.000Z"
 *     responses:
 *       200: { description: Duplicate check result }
 */
router.post('/check-duplicates', requireRoles('Receptionist', 'Admin'), validate([
  body('firstName').notEmpty().withMessage('First name is required'),
  body('lastName').notEmpty().withMessage('Last name is required'),
  body('dateOfBirth')
    .notEmpty()
    .withMessage('Date of birth is required')
    .isISO8601()
    .withMessage('Date of birth must be a valid ISO-8601 date (YYYY-MM-DD or YYYY-MM-DDThh:mm:ssZ)'),
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
 *         example: 1
 *     responses:
 *       200:
 *         description: Patient details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       404:
 *         description: Patient not found
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
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *                 description: Patient's first name
 *                 example: "Jane"
 *               lastName:
 *                 type: string
 *                 description: Patient's last name
 *                 example: "Smith"
 *               dateOfBirth:
 *                 type: string
 *                 format: date-time
 *                 description: Date of birth in ISO-8601 format
 *                 example: "1990-05-15T00:00:00.000Z"
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Patient's email address
 *                 example: "jane.smith@example.com"
 *               phone:
 *                 type: string
 *                 description: Patient's phone number
 *                 example: "+1987654321"
 *               gender:
 *                 type: string
 *                 enum: [male, female, non_binary, prefer_not_to_say, unknown]
 *                 description: Patient's gender (lowercase)
 *                 example: "female"
 *               address:
 *                 type: string
 *                 description: Patient's address
 *                 example: "456 Oak Ave, City, State 67890"
 *     responses:
 *       200:
 *         description: Patient updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                 message:
 *                   type: string
 *       400:
 *         description: Bad request - invalid data format
 *       404:
 *         description: Patient not found
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
 *         example: 1
 *     responses:
 *       200:
 *         description: Patient deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       403:
 *         description: Forbidden - Admin only
 *       404:
 *         description: Patient not found
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
 *         example: 1
 *     responses:
 *       200:
 *         description: Account balance
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     patientId:
 *                       type: string
 *                     balance:
 *                       type: number
 *                     totalDue:
 *                       type: number
 *                     totalPaid:
 *                       type: number
 */
router.get('/:patientId/balance', requireRoles('Receptionist', 'Admin', 'Billing Staff'), validate(patientIdValidator), patientController.getPatientBalance.bind(patientController));

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
 *         example: 1
 *     responses:
 *       200:
 *         description: Patient workspace data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     preferences:
 *                       type: object
 *                     carePlan:
 *                       type: object
 *                     complianceTracking:
 *                       type: object
 *       404:
 *         description: Patient not found
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
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Workspace metadata to update
 *             properties:
 *               preferredDentistId:
 *                 type: string
 *                 description: ID of preferred dentist
 *                 example: "12345"
 *               preferredHygienistId:
 *                 type: string
 *                 description: ID of preferred hygienist
 *                 example: "67890"
 *               preferredLanguage:
 *                 type: string
 *                 description: Patient's preferred language
 *                 example: "Spanish"
 *               communicationPreferences:
 *                 type: object
 *                 properties:
 *                   email:
 *                     type: boolean
 *                     example: true
 *                   sms:
 *                     type: boolean
 *                     example: false
 *                   phone:
 *                     type: boolean
 *                     example: true
 *               specialInstructions:
 *                 type: string
 *                 description: Any special instructions for the patient
 *                 example: "Requires wheelchair access"
 *               emergencyContact:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                     example: "Jane Doe"
 *                   relationship:
 *                     type: string
 *                     example: "Spouse"
 *                   phone:
 *                     type: string
 *                     example: "+1987654321"
 *               consentForms:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     formId:
 *                       type: string
 *                     signedDate:
 *                       type: string
 *                       format: date-time
 *             example:
 *               preferredDentistId: "12345"
 *               preferredLanguage: "Spanish"
 *               communicationPreferences:
 *                 email: true
 *                 sms: true
 *     responses:
 *       200:
 *         description: Workspace updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                 message:
 *                   type: string
 *       400:
 *         description: Bad request - invalid data format
 *       404:
 *         description: Patient not found
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
 *         example: 1
 *     responses:
 *       200:
 *         description: Patient's structured medical history
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       404:
 *         description: Patient not found
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
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Structured medical history data
 *             required:
 *               - generalInfo
 *             properties:
 *               generalInfo:
 *                 type: object
 *                 description: General patient information
 *                 properties:
 *                   bloodType:
 *                     type: string
 *                     enum: [A+, A-, B+, B-, O+, O-, AB+, AB-]
 *                     example: "O+"
 *                   height:
 *                     type: number
 *                     description: Height in cm
 *                     example: 175
 *                   weight:
 *                     type: number
 *                     description: Weight in kg
 *                     example: 70
 *                   allergies:
 *                     type: array
 *                     items:
 *                       type: string
 *                     example: ["Penicillin", "Pollen"]
 *               conditions:
 *                 type: array
 *                 description: Chronic conditions
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                       example: "Hypertension"
 *                     diagnosedDate:
 *                       type: string
 *                       format: date
 *                       example: "2020-01-15"
 *                     status:
 *                       type: string
 *                       enum: [active, managed, resolved]
 *                       example: "managed"
 *                     notes:
 *                       type: string
 *                       example: "Controlled with medication"
 *               medications:
 *                 type: array
 *                 description: Current medications
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                       example: "Lisinopril"
 *                     dosage:
 *                       type: string
 *                       example: "10mg"
 *                     frequency:
 *                       type: string
 *                       example: "Once daily"
 *                     prescribedDate:
 *                       type: string
 *                       format: date
 *                       example: "2023-01-10"
 *                     prescribingDoctor:
 *                       type: string
 *                       example: "Dr. Smith"
 *               surgeries:
 *                 type: array
 *                 description: Past surgeries
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                       example: "Appendectomy"
 *                     date:
 *                       type: string
 *                       format: date
 *                       example: "2015-06-20"
 *                     hospital:
 *                       type: string
 *                       example: "City General Hospital"
 *                     notes:
 *                       type: string
 *                       example: "Laparoscopic procedure"
 *               familyHistory:
 *                 type: object
 *                 description: Family medical history
 *                 properties:
 *                   father:
 *                     type: object
 *                     properties:
 *                       conditions:
 *                         type: array
 *                         items:
 *                           type: string
 *                         example: ["Diabetes", "Heart Disease"]
 *                   mother:
 *                     type: object
 *                     properties:
 *                       conditions:
 *                         type: array
 *                         items:
 *                           type: string
 *                         example: ["Hypertension"]
 *                   siblings:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         condition:
 *                           type: string
 *               lifestyle:
 *                 type: object
 *                 description: Lifestyle factors
 *                 properties:
 *                   smokingStatus:
 *                     type: string
 *                     enum: [never, former, current]
 *                     example: "never"
 *                   alcoholConsumption:
 *                     type: string
 *                     enum: [none, occasional, moderate, heavy]
 *                     example: "occasional"
 *                   exerciseFrequency:
 *                     type: string
 *                     example: "3-4 times per week"
 *                   diet:
 *                     type: string
 *                     example: "Balanced diet"
 *             example:
 *               generalInfo:
 *                 bloodType: "O+"
 *                 height: 175
 *                 weight: 70
 *                 allergies: ["Penicillin"]
 *               conditions:
 *                 - name: "Hypertension"
 *                   diagnosedDate: "2020-01-15"
 *                   status: "managed"
 *               medications:
 *                 - name: "Lisinopril"
 *                   dosage: "10mg"
 *                   frequency: "Once daily"
 *               lifestyle:
 *                 smokingStatus: "never"
 *                 alcoholConsumption: "occasional"
 *     responses:
 *       200:
 *         description: Medical history updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                 message:
 *                   type: string
 *       400:
 *         description: Bad request - invalid data format
 *       404:
 *         description: Patient not found
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               lastDentalVisit:
 *                 type: string
 *                 format: date
 *               cleaningFrequency:
 *                 type: string
 *               previousProcedures:
 *                 type: array
 *                 items:
 *                   type: object
 *               concerns:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200: { description: Dental history updated }
 */
router.get('/:patientId/dental-history', requireRoles('Receptionist', 'Admin', 'Doctor', 'Provider'), validate(patientIdValidator), patientController.getDentalHistory.bind(patientController));
router.patch('/:patientId/dental-history', requireRoles('Receptionist', 'Admin', 'Doctor', 'Provider'), validate([...patientIdValidator, ...patientDentalHistoryValidator]), patientController.updateDentalHistory.bind(patientController));

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
 *         example: 1
 *     responses:
 *       200:
 *         description: List of patient allergies
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
 *                     type: object
 *       404:
 *         description: Patient not found
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
 *                 description: The allergen name
 *                 example: "Penicillin"
 *               severity:
 *                 type: string
 *                 enum: [Mild, Moderate, Severe, Life-Threatening]
 *                 description: Severity of the allergic reaction
 *                 example: "Moderate"
 *               reaction:
 *                 type: string
 *                 description: Description of the allergic reaction
 *                 example: "Hives, difficulty breathing"
 *               documentedDate:
 *                 type: string
 *                 format: date-time
 *                 description: Date when the allergy was documented
 *                 example: "2024-04-28T00:00:00.000Z"
 *               status:
 *                 type: string
 *                 enum: [Active, Inactive, Resolved]
 *                 description: Current status of the allergy
 *                 example: "Active"
 *               notes:
 *                 type: string
 *                 description: Additional notes about the allergy
 *                 example: "Patient carries EpiPen"
 *               documentedBy:
 *                 type: string
 *                 description: Name of the documenting provider
 *                 example: "Dr. Smith"
 *             example:
 *               allergen: "Penicillin"
 *               severity: "Moderate"
 *               reaction: "Hives, itching"
 *               documentedDate: "2024-04-28T00:00:00.000Z"
 *               status: "Active"
 *               notes: "Patient allergic to amoxicillin as well"
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
 *                 data:
 *                   type: object
 *                 message:
 *                   type: string
 *       400:
 *         description: Bad request - missing required fields (allergen, severity, reaction, documentedDate)
 *       404:
 *         description: Patient not found
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
 *         example: 1
 *       - in: path
 *         name: allergyId
 *         required: true
 *         schema: { type: integer }
 *         example: 1
 *     responses:
 *       200:
 *         description: Allergy details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       404:
 *         description: Allergy not found
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
 *         example: 1
 *       - in: path
 *         name: allergyId
 *         required: true
 *         schema: { type: integer }
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Fields to update (all are optional, but at least one is required)
 *             properties:
 *               allergen:
 *                 type: string
 *                 description: The allergen name
 *                 example: "Amoxicillin"
 *               severity:
 *                 type: string
 *                 enum: [Mild, Moderate, Severe, Life-Threatening]
 *                 description: Severity of the allergic reaction
 *                 example: "Severe"
 *               reaction:
 *                 type: string
 *                 description: Description of the allergic reaction
 *                 example: "Anaphylaxis, swelling"
 *               status:
 *                 type: string
 *                 enum: [Active, Inactive, Resolved]
 *                 description: Current status of the allergy
 *                 example: "Active"
 *               notes:
 *                 type: string
 *                 description: Additional notes about the allergy
 *                 example: "Patient now carries two EpiPens"
 *             example:
 *               severity: "Severe"
 *               notes: "Patient now carries two EpiPens"
 *     responses:
 *       200:
 *         description: Allergy updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                 message:
 *                   type: string
 *       400:
 *         description: Bad request - invalid data format
 *       404:
 *         description: Allergy not found
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
 *         example: 1
 *       - in: path
 *         name: allergyId
 *         required: true
 *         schema: { type: integer }
 *         example: 1
 *     responses:
 *       200:
 *         description: Allergy deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       404:
 *         description: Allergy not found
 */
router.get('/:patientId/allergies/:allergyId', requireRoles('Receptionist', 'Doctor', 'Admin'), validate([...patientIdValidator, ...allergyIdParamValidator]), allergyController.getAllergyById.bind(allergyController));
router.put('/:patientId/allergies/:allergyId', requireRoles('Receptionist', 'Doctor', 'Admin'), validate([...patientIdValidator, ...allergyIdParamValidator, ...updateAllergyValidator]), allergyController.updatePatientAllergy.bind(allergyController));
router.delete('/:patientId/allergies/:allergyId', requireRoles('Receptionist', 'Doctor', 'Admin'), validate([...patientIdValidator, ...allergyIdParamValidator]), allergyController.deletePatientAllergy.bind(allergyController));

router.get('/:patientId/insurance', requireRoles('Receptionist', 'Admin'), validate(patientIdValidator), patientInsuranceController.getPatientInsurances.bind(patientInsuranceController));

/**
 * @swagger
 * /patients/{patientId}/insurance:
 *   post:
 *     summary: Add insurance to patient
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: integer }
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - insuranceType
 *               - insuranceCompanyId
 *               - relationshipToPatient
 *               - effectiveDate
 *               - subscriberDateOfBirth
 *               - policyNumber
 *               - subscriberName
 *             properties:
 *               insuranceType:
 *                 type: string
 *                 enum: [primary, secondary, tertiary]
 *                 description: Type of insurance coverage
 *                 example: "primary"
 *               insuranceCompanyId:
 *                 type: string
 *                 description: ID of the insurance company
 *                 example: "12345"
 *               relationshipToPatient:
 *                 type: string
 *                 description: Relationship of subscriber to patient
 *                 example: "Self"
 *               effectiveDate:
 *                 type: string
 *                 format: date-time
 *                 description: Date when insurance coverage starts
 *                 example: "2024-01-01T00:00:00.000Z"
 *               subscriberDateOfBirth:
 *                 type: string
 *                 format: date-time
 *                 description: Date of birth of the insurance subscriber
 *                 example: "1985-06-15T00:00:00.000Z"
 *               policyNumber:
 *                 type: string
 *                 description: Insurance policy number
 *                 example: "POL-123456789"
 *               subscriberName:
 *                 type: string
 *                 description: Name of the insurance subscriber
 *                 example: "John Doe"
 *               groupNumber:
 *                 type: string
 *                 description: Insurance group number (optional)
 *                 example: "GRP-98765"
 *               expirationDate:
 *                 type: string
 *                 format: date-time
 *                 description: Date when insurance coverage ends (optional)
 *                 example: "2024-12-31T00:00:00.000Z"
 *               isActive:
 *                 type: boolean
 *                 description: Whether the insurance is active
 *                 default: true
 *                 example: true
 *               notes:
 *                 type: string
 *                 description: Additional notes about the insurance
 *                 example: "Primary insurance through employer"
 *             example:
 *               insuranceType: "primary"
 *               insuranceCompanyId: "12345"
 *               relationshipToPatient: "Self"
 *               effectiveDate: "2024-01-01T00:00:00.000Z"
 *               subscriberDateOfBirth: "1985-06-15T00:00:00.000Z"
 *               policyNumber: "POL-123456789"
 *               subscriberName: "John Doe"
 *               groupNumber: "GRP-98765"
 *               isActive: true
 *               notes: "Primary insurance through employer"
 *     responses:
 *       201:
 *         description: Insurance added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                 message:
 *                   type: string
 *       400:
 *         description: Bad request - missing required fields
 *       404:
 *         description: Patient not found or insurance company not found
 */
router.post('/:patientId/insurance', requireRoles('Receptionist', 'Admin'), validate([...patientIdValidator, ...createPatientInsuranceValidator]), patientInsuranceController.createPatientInsurance.bind(patientInsuranceController));

// ... rest of the routes remain the same ...

export default router;