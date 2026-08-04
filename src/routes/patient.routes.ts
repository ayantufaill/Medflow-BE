import { Router } from 'express';
import { body } from 'express-validator';
import { appointmentController } from '../controllers/appointment.controller';
import { patientController } from '../controllers/patient.controller';
import { insurancePlanController } from '../controllers/insurance-plan.controller';
import { allergyController } from '../controllers/allergy.controller';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { resolveBranchAccess } from '../middleware/branchAccess.middleware';
import { enterTenantContext } from '../middleware/tenantContext.middleware';
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
router.use(resolveBranchAccess);
router.use(enterTenantContext);

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
 *         description: Search by name, email, phone, or patient code
 *         example: James
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *         description: Number of results per page
 *       - in: query
 *         name: isActive
 *         schema: { type: boolean }
 *         description: Filter by active/inactive status
 *       - in: query
 *         name: dobStart
 *         schema: { type: string, format: date }
 *         description: Filter by date of birth range start
 *       - in: query
 *         name: dobEnd
 *         schema: { type: string, format: date }
 *         description: Filter by date of birth range end
 *     responses:
 *       200:
 *         description: List of patients
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     patients:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id: { type: string, example: "1" }
 *                           patientCode: { type: string, example: "PAT001" }
 *                           firstName: { type: string, example: "James" }
 *                           lastName: { type: string, example: "Harrison" }
 *                           dateOfBirth: { type: string, example: "1978-04-12T00:00:00.000Z" }
 *                           email: { type: string, example: "james@example.com" }
 *                           isActive: { type: boolean, example: true }
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page: { type: integer, example: 1 }
 *                         limit: { type: integer, example: 10 }
 *                         total: { type: integer, example: 25 }
 *                         pages: { type: integer, example: 3 }
 *       401: { description: Unauthorized }
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
 *               firstName: { type: string, example: "James" }
 *               lastName: { type: string, example: "Harrison" }
 *               middleName: { type: string, example: "Robert" }
 *               dateOfBirth: { type: string, format: date, example: "1978-04-12" }
 *               gender: { type: string, enum: [male, female, other], example: "male" }
 *               email: { type: string, format: email, example: "james@example.com" }
 *               phonePrimary: { type: string, example: "12145559101" }
 *               address:
 *                 type: object
 *                 properties:
 *                   line1: { type: string, example: "142 Maple Street" }
 *                   city: { type: string, example: "Dallas" }
 *                   state: { type: string, example: "TX" }
 *                   postalCode: { type: string, example: "75201" }
 *     responses:
 *       201:
 *         description: Patient created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     patient:
 *                       type: object
 *                       properties:
 *                         _id: { type: string, example: "26" }
 *                         patientCode: { type: string, example: "PAT026" }
 *                         firstName: { type: string, example: "James" }
 *                         lastName: { type: string, example: "Harrison" }
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: false }
 *                 error:
 *                   type: object
 *                   properties:
 *                     message: { type: string, example: "firstName is required. lastName is required." }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       409:
 *         description: Duplicate patient
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: false }
 *                 error:
 *                   type: object
 *                   properties:
 *                     message: { type: string, example: "A patient already exists with given details." }
 */
router.get('/', requireRoles('Receptionist', 'Admin'), validate(patientSearchValidator), patientController.getAllPatients.bind(patientController));
/**
 * @swagger
 * /patients:
 *   post:
 *     summary: Post patient
 *     tags: [Patient]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */

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
 *         name: search
 *         schema: { type: string }
 *         description: Search term
 *         example: James
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: isActive
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     patients: { type: array, items: { type: object } }
 *                     pagination: { type: object }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
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
 *               firstName: { type: string, example: "James" }
 *               lastName: { type: string, example: "Harrison" }
 *               dateOfBirth: { type: string, format: date, example: "1978-04-12" }
 *               phonePrimary: { type: string, example: "12145559101" }
 *               email: { type: string, example: "james@example.com" }
 *     responses:
 *       200:
 *         description: Duplicate check result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     duplicates:
 *                       type: array
 *                       items: { type: object }
 *       400:
 *         description: Validation error - missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: false }
 *                 error: { type: object, properties: { message: { type: string } } }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
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
 *         example: 1
 *     responses:
 *       200:
 *         description: Patient details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     patient:
 *                       type: object
 *                       properties:
 *                         _id: { type: string, example: "1" }
 *                         patientCode: { type: string, example: "PAT001" }
 *                         firstName: { type: string, example: "James" }
 *                         lastName: { type: string, example: "Harrison" }
 *                         dateOfBirth: { type: string, example: "1978-04-12T00:00:00.000Z" }
 *                         isActive: { type: boolean, example: true }
 *       400: { description: Invalid patient ID }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404:
 *         description: Patient not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: false }
 *                 error: { type: object, properties: { message: { type: string, example: "Patient not found" } } }
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
 *               firstName: { type: string, example: "James" }
 *               lastName: { type: string, example: "Harrison" }
 *               email: { type: string, example: "james@example.com" }
 *               phonePrimary: { type: string, example: "12145559101" }
 *               isActive: { type: boolean, example: true }
 *     responses:
 *       200:
 *         description: Patient updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: object, properties: { patient: { type: object } } }
 *       400: { description: Validation error }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Patient not found }
 *   delete:
 *     summary: Delete (deactivate) patient — Admin only
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
 *         description: Patient deactivated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: object, properties: { message: { type: string, example: "Patient deactivated successfully" } } }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden - Admin only }
 *       404: { description: Patient not found }
 */
/**
 * @swagger
 * /patients/bulk-delete:
 *   post:
 *     summary: Bulk delete (deactivate) incomplete patients - Admin only
 *     tags: [Patients]
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
 *                   type: integer
 *     responses:
 *       200:
 *         description: Patients deactivated successfully
 */
router.post('/bulk-delete', requireRoles('Admin'), patientController.bulkDeletePatients.bind(patientController));

/**
 * @swagger
 * /patients/{patientId}:
 *   get:
 *     summary: Get :patientId
 *     tags: [Patient]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */

router.get('/:patientId', requireRoles('Receptionist', 'Admin'), validate(patientIdValidator), patientController.getPatientById.bind(patientController));
/**
 * @swagger
 * /patients/{patientId}:
 *   patch:
 *     summary: Patch :patientId
 *     tags: [Patient]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */

router.patch('/:patientId', requireRoles('Receptionist', 'Admin'), validate([...patientIdValidator, ...updatePatientValidator]), patientController.updatePatient.bind(patientController));
/**
 * @swagger
 * /patients/{patientId}:
 *   delete:
 *     summary: Delete :patientId
 *     tags: [Patient]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */

router.delete('/:patientId', requireRoles('Admin'), validate(patientIdValidator), patientController.deletePatient.bind(patientController));

/**
 * @swagger
 * /patients/{patientId}/family-members:
 *   post:
 *     summary: Add a family member
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               memberId: { type: string }
 *     responses:
 *       200:
 *         description: Successful response
 */
router.post('/:patientId/family-members', requireRoles('Receptionist', 'Admin'), validate(patientIdValidator), patientController.addFamilyMember.bind(patientController));

/**
 * @swagger
 * /patients/{patientId}/family-members/{memberId}:
 *   delete:
 *     summary: Remove a family member
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: memberId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Successful response
 */
router.delete('/:patientId/family-members/:memberId', requireRoles('Receptionist', 'Admin'), validate(patientIdValidator), patientController.removeFamilyMember.bind(patientController));

/**
 * @swagger
 * /patients/{patientId}/account-notes:
 *   get:
 *     summary: Get :patientId account-notes
 *     tags: [Patient]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */

router.get('/:patientId/account-notes', requireRoles('Receptionist', 'Admin', 'Billing Staff'), validate(patientIdValidator), patientController.getPatientAccountNotes.bind(patientController));
/**
 * @swagger
 * /patients/{patientId}/account-notes:
 *   post:
 *     summary: Post :patientId account-notes
 *     tags: [Patient]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */

router.post('/:patientId/account-notes', requireRoles('Receptionist', 'Admin', 'Billing Staff'), validate(patientIdValidator), patientController.createPatientAccountNote.bind(patientController));
/**
 * @swagger
 * /patients/{patientId}/account-notes/{noteId}:
 *   put:
 *     summary: Put :patientId account-notes :noteId
 *     tags: [Patient]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: noteId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */

router.put('/:patientId/account-notes/:noteId', requireRoles('Receptionist', 'Admin', 'Billing Staff'), validate(patientIdValidator), patientController.updatePatientAccountNote.bind(patientController));

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
 *         description: Account balance summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     balance: { type: number, example: 150.00 }
 *                     lastPaymentDate: { type: string, example: "2026-06-09T00:00:00.000Z", nullable: true }
 *                     overdueAmount: { type: number, example: 150.00 }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Patient not found }
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
 *         example: 1
 *     responses:
 *       200:
 *         description: Last visit details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     date: { type: string, example: "2025-12-08T09:00:00.000Z" }
 *                     providerName: { type: string, example: "Dr. Sarah Mitchell" }
 *                     appointmentType: { type: string, example: "Consultation" }
 *                     notesSummary: { type: string, example: "New patient exam and full mouth X-rays", nullable: true }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404:
 *         description: No completed appointments found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: false }
 *                 error: { type: object, properties: { message: { type: string, example: "No completed appointments found for this patient" } } }
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
 *         example: 1
 *     responses:
 *       200:
 *         description: Patient workspace data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: object, properties: { patient: { type: object } } }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Patient not found }
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
 *             properties:
 *               preferredDentistId: { type: string, example: "1" }
 *               preferredHygienistId: { type: string, example: "6" }
 *               patientFlags: { type: array, items: { type: string } }
 *     responses:
 *       200: { description: Workspace updated }
 *       400: { description: Validation error }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Patient not found }
 */
router.get('/:patientId/workspace', requireRoles('Receptionist', 'Admin', 'Doctor', 'Provider'), validate(patientIdValidator), patientController.getPatientWorkspace.bind(patientController));
/**
 * @swagger
 * /patients/{patientId}/workspace:
 *   patch:
 *     summary: Patch :patientId workspace
 *     tags: [Patient]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */

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
 *         description: Structured medical history
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     generalInfo: { type: object }
 *                     premed: { type: object }
 *                     risk: { type: object }
 *                     sections: { type: array, items: { type: object } }
 *                     medications: { type: array, items: { type: object } }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Patient not found }
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
 *             properties:
 *               generalInfo: { type: object }
 *               premed: { type: object }
 *               risk: { type: object }
 *               sections: { type: array, items: { type: object } }
 *               medications: { type: array, items: { type: object } }
 *     responses:
 *       200: { description: Medical history updated }
 *       400: { description: Validation error }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Patient not found }
 */
router.get('/:patientId/medical-history', requireRoles('Receptionist', 'Admin', 'Doctor', 'Provider'), validate(patientIdValidator), patientController.getStructuredMedicalHistory.bind(patientController));
/**
 * @swagger
 * /patients/{patientId}/medical-history:
 *   patch:
 *     summary: Patch :patientId medical-history
 *     tags: [Patient]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */

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
 *         example: 1
 *     responses:
 *       200:
 *         description: Dental history including procedures, notes, x-rays
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     generalInfo: { type: object }
 *                     personalHistory: { type: array, items: { type: object } }
 *                     procedures: { type: array, items: { type: object } }
 *                     xrays: { type: array, items: { type: object } }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Patient not found }
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
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               generalInfo: { type: object }
 *               personalHistory: { type: array, items: { type: object } }
 *               review: { type: object }
 *     responses:
 *       200: { description: Dental history updated }
 *       400: { description: Validation error }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Patient not found }
 */
router.get('/:patientId/dental-history', requireRoles('Receptionist', 'Admin', 'Doctor', 'Provider'), validate(patientIdValidator), patientController.getDentalHistory.bind(patientController));
/**
 * @swagger
 * /patients/{patientId}/dental-history:
 *   patch:
 *     summary: Patch :patientId dental-history
 *     tags: [Patient]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */

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
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *         description: Number of appointments to return
 *     responses:
 *       200:
 *         description: List of patient appointments
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     appointments: { type: array, items: { type: object } }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Patient not found }
 */
router.get('/:patientId/appointments', requireRoles('Receptionist', 'Admin', 'Doctor', 'Provider'), validate(patientIdValidator), appointmentController.getPatientAppointments.bind(appointmentController));
router.get('/:patientId/family-appointments', requireRoles('Receptionist', 'Admin', 'Doctor', 'Provider'), validate(patientIdValidator), patientController.getPatientFamilyAppointments.bind(patientController));

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
 *         example: 1
 *     responses:
 *       200:
 *         description: Patient history including allergies, conditions, medications, vitals, family history
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     diagnoses: { type: array, items: { type: object } }
 *                     medicalConditions: { type: array, items: { type: object } }
 *                     medications: { type: array, items: { type: object } }
 *                     allergies: { type: array, items: { type: object } }
 *                     surgicalHistory: { type: array, items: { type: object } }
 *                     familyHistory: { type: array, items: { type: object } }
 *                     vitals: { type: object }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Patient not found }
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
 *         example: 1
 *     responses:
 *       200:
 *         description: List of patient allergies
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     allergies:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id: { type: string, example: "1" }
 *                           name: { type: string, example: "Penicillin" }
 *                           reaction: { type: string, example: "Hives and rash" }
 *                           isActive: { type: boolean, example: true }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Patient not found }
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
 *             required: [allergen, reaction, documentedDate]
 *             properties:
 *               allergen: { type: string, example: "Penicillin" }
 *               reaction: { type: string, example: "Hives and rash" }
 *               severity: { type: string, enum: [mild, moderate, severe, unknown], example: "severe" }
 *               documentedDate: { type: string, format: date, example: "2024-03-15" }
 *               isActive: { type: boolean, example: true }
 *               notes: { type: string, example: "Patient carries EpiPen" }
 *     responses:
 *       201:
 *         description: Allergy added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: object, properties: { allergy: { type: object } } }
 *       400: { description: Validation error }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Patient not found }
 */
router.get('/:patientId/allergies', validate(patientIdValidator), requireRoles('Receptionist', 'Doctor', 'Admin'), allergyController.getPatientAllergies.bind(allergyController));
/**
 * @swagger
 * /patients/{patientId}/allergies:
 *   post:
 *     summary: Post :patientId allergies
 *     tags: [Patient]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */

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
 *                 success: { type: boolean, example: true }
 *                 data: { type: object, properties: { allergy: { type: object } } }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Allergy not found }
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
 *             properties:
 *               reaction: { type: string, example: "Updated reaction" }
 *               severity: { type: string, enum: [mild, moderate, severe, unknown] }
 *               isActive: { type: boolean, example: false }
 *     responses:
 *       200:
 *         description: Allergy updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: object }
 *       400: { description: Validation error }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Allergy not found }
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
 *         description: Allergy deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: object, properties: { message: { type: string, example: "Allergy deleted successfully" } } }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Allergy not found }
 */
router.get('/:patientId/allergies/:allergyId', requireRoles('Receptionist', 'Doctor', 'Admin'), validate([...patientIdValidator, ...allergyIdParamValidator]), allergyController.getAllergyById.bind(allergyController));
/**
 * @swagger
 * /patients/{patientId}/allergies/{allergyId}:
 *   put:
 *     summary: Put :patientId allergies :allergyId
 *     tags: [Patient]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: allergyId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */

router.put('/:patientId/allergies/:allergyId', requireRoles('Receptionist', 'Doctor', 'Admin'), validate([...patientIdValidator, ...allergyIdParamValidator, ...updateAllergyValidator]), allergyController.updatePatientAllergy.bind(allergyController));
/**
 * @swagger
 * /patients/{patientId}/allergies/{allergyId}:
 *   delete:
 *     summary: Delete :patientId allergies :allergyId
 *     tags: [Patient]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: allergyId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */

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
 *         example: 1
 *     responses:
 *       200:
 *         description: List of communications
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: object }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Patient not found }
 */
router.get('/:patientId/communications', requireRoles('Receptionist', 'Admin', 'Doctor', 'Provider'), validate(patientIdValidator), patientController.getPatientCommunications.bind(patientController));
/**
 * @swagger
 * /patients/{patientId}/communications/send:
 *   post:
 *     summary: Post :patientId communications send
 *     tags: [Patient]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */

router.post('/:patientId/communications/send', requireRoles('Receptionist', 'Admin', 'Doctor', 'Provider'), validate([...patientIdValidator, ...patientCommunicationValidator]), patientController.createPatientCommunication.bind(patientController));

/**
 * @swagger
 * /patients/{patientId}/update-requests:
 *   get:
 *     summary: Get :patientId update-requests
 *     tags: [Patient]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */

router.get('/:patientId/update-requests', requireRoles('Receptionist', 'Admin', 'Doctor', 'Provider'), validate(patientIdValidator), patientController.getPatientUpdateRequests.bind(patientController));
/**
 * @swagger
 * /patients/{patientId}/update-requests:
 *   post:
 *     summary: Post :patientId update-requests
 *     tags: [Patient]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */

router.post('/:patientId/update-requests', requireRoles('Receptionist', 'Admin'), validate([...patientIdValidator, ...createPatientUpdateRequestValidator]), patientController.createPatientUpdateRequest.bind(patientController));
/**
 * @swagger
 * /patients/{patientId}/reconciliation/{requestId}:
 *   get:
 *     summary: Get :patientId reconciliation :requestId
 *     tags: [Patient]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */

router.get('/:patientId/reconciliation/:requestId', requireRoles('Receptionist', 'Admin', 'Doctor', 'Provider'), validate([...patientIdValidator, ...patientRequestIdValidator]), patientController.getPatientReconciliation.bind(patientController));
/**
 * @swagger
 * /patients/{patientId}/reconciliation/{requestId}/apply:
 *   post:
 *     summary: Post :patientId reconciliation :requestId apply
 *     tags: [Patient]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */

router.post('/:patientId/reconciliation/:requestId/apply', requireRoles('Receptionist', 'Admin'), validate([...patientIdValidator, ...patientRequestIdValidator, ...applyPatientReconciliationValidator]), patientController.applyPatientReconciliation.bind(patientController));
/**
 * @swagger
 * /patients/{patientId}/audit-history:
 *   get:
 *     summary: Get :patientId audit-history
 *     tags: [Patient]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */

router.get('/:patientId/audit-history', requireRoles('Receptionist', 'Admin', 'Doctor', 'Provider'), validate(patientIdValidator), patientController.getPatientAuditHistory.bind(patientController));
/**
 * @swagger
 * /patients/{patientId}/coverages:
 *   get:
 *     summary: Get :patientId coverages
 *     tags: [Patient]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */

router.get('/:patientId/coverages', requireRoles('Receptionist', 'Admin', 'Billing Staff'), validate(patientIdValidator), insurancePlanController.getPatientCoverages.bind(insurancePlanController));
/**
 * @swagger
 * /patients/{patientId}/coverages:
 *   post:
 *     summary: Post :patientId coverages
 *     tags: [Patient]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */

router.post('/:patientId/coverages', requireRoles('Receptionist', 'Admin', 'Billing Staff'), validate([...patientIdValidator, ...createPatientInsuranceValidator]), insurancePlanController.createPatientCoverage.bind(insurancePlanController));
/**
 * @swagger
 * /patients/{patientId}/reports/summary:
 *   get:
 *     summary: Get :patientId reports summary
 *     tags: [Patient]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */

router.get('/:patientId/reports/summary', requireRoles('Receptionist', 'Admin', 'Doctor', 'Provider'), validate(patientIdValidator), patientController.getPatientReportSummary.bind(patientController));
/**
 * @swagger
 * /patients/{patientId}/reports/showcase:
 *   get:
 *     summary: Get :patientId reports showcase
 *     tags: [Patient]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */

router.get('/:patientId/reports/showcase', requireRoles('Receptionist', 'Admin', 'Doctor', 'Provider'), validate(patientIdValidator), patientController.getPatientReportShowcase.bind(patientController));
/**
 * @swagger
 * /patients/{patientId}/reports/concerns:
 *   get:
 *     summary: Get :patientId reports concerns
 *     tags: [Patient]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */

router.get('/:patientId/reports/concerns', requireRoles('Receptionist', 'Admin', 'Doctor', 'Provider'), validate(patientIdValidator), patientController.getPatientReportConcerns.bind(patientController));
/**
 * @swagger
 * /patients/{patientId}/reports/refresh:
 *   post:
 *     summary: Post :patientId reports refresh
 *     tags: [Patient]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */

router.post('/:patientId/reports/refresh', requireRoles('Receptionist', 'Admin', 'Doctor', 'Provider'), validate(patientIdValidator), patientController.refreshPatientReports.bind(patientController));

export default router;