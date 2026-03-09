import { Router } from 'express';
import { body } from 'express-validator';
import { patientController } from '../controllers/patient.controller';
import { patientInsuranceController } from '../controllers/patient-insurance.controller';
import { insurancePlanController } from '../controllers/insurance-plan.controller';
import { allergyController } from '../controllers/allergy.controller';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  patientIdValidator,
  patientRequestIdValidator,
  createPatientValidator,
  updatePatientValidator,
  patientSearchValidator,
  patientWorkspaceMetaValidator,
  createPatientUpdateRequestValidator,
  applyPatientReconciliationValidator,
  patientCommunicationValidator,
  patientMedicalHistoryValidator,
  patientDentalHistoryValidator,
} from '../validators/patient.validator';
import {
  createPatientInsuranceValidator,
  updatePatientInsuranceValidator,
  patientInsuranceIdValidator,
} from '../validators/insurance.validator';
import {
  createPatientAllergyValidator,
  updateAllergyValidator,
  allergyIdParamValidator,
} from '../validators/allergy.validator';

const router = Router();

// All patient routes require authentication
router.use(authenticate);

// Patient routes
// Get all patients (with search and pagination)
router.get(
  '/',
  requireRoles('Receptionist', 'Admin'),
  validate(patientSearchValidator),
  patientController.getAllPatients.bind(patientController)
);

// Search patients (alias for getAllPatients)
router.get(
  '/search',
  requireRoles('Receptionist', 'Admin'),
  validate(patientSearchValidator),
  patientController.searchPatients.bind(patientController)
);

// Check for duplicate patients
router.post(
  '/check-duplicates',
  requireRoles('Receptionist', 'Admin'),
  validate([
    body('firstName').notEmpty().withMessage('First name is required'),
    body('lastName').notEmpty().withMessage('Last name is required'),
    body('dateOfBirth').notEmpty().withMessage('Date of birth is required').isISO8601().withMessage('Date of birth must be a valid date'),
  ]),
  patientController.checkDuplicates.bind(patientController)
);

// Create new patient
router.post(
  '/',
  requireRoles('Receptionist', 'Admin'),
  validate(createPatientValidator),
  patientController.createPatient.bind(patientController)
);

// Get patient account balance
router.get(
  '/:patientId/balance',
  requireRoles('Receptionist', 'Admin', 'Billing Staff'),
  validate(patientIdValidator),
  patientController.getPatientBalance.bind(patientController)
);

// Get patient by ID
router.get(
  '/:patientId',
  requireRoles('Receptionist', 'Admin'),
  validate(patientIdValidator),
  patientController.getPatientById.bind(patientController)
);

router.get(
  '/:patientId/workspace',
  requireRoles('Receptionist', 'Admin', 'Doctor', 'Provider'),
  validate(patientIdValidator),
  patientController.getPatientWorkspace.bind(patientController)
);

router.get(
  '/:patientId/medical-history',
  requireRoles('Receptionist', 'Admin', 'Doctor', 'Provider'),
  validate(patientIdValidator),
  patientController.getStructuredMedicalHistory.bind(patientController)
);

router.patch(
  '/:patientId/medical-history',
  requireRoles('Receptionist', 'Admin', 'Doctor', 'Provider'),
  validate([...patientIdValidator, ...patientMedicalHistoryValidator]),
  patientController.updateStructuredMedicalHistory.bind(patientController)
);

router.get(
  '/:patientId/dental-history',
  requireRoles('Receptionist', 'Admin', 'Doctor', 'Provider'),
  validate(patientIdValidator),
  patientController.getDentalHistory.bind(patientController)
);

router.patch(
  '/:patientId/dental-history',
  requireRoles('Receptionist', 'Admin', 'Doctor', 'Provider'),
  validate([...patientIdValidator, ...patientDentalHistoryValidator]),
  patientController.updateDentalHistory.bind(patientController)
);

router.patch(
  '/:patientId/workspace',
  requireRoles('Receptionist', 'Admin'),
  validate([...patientIdValidator, ...patientWorkspaceMetaValidator]),
  patientController.updatePatientWorkspaceMeta.bind(patientController)
);

// Update patient
router.put(
  '/:patientId',
  requireRoles('Receptionist', 'Admin'),
  validate([...patientIdValidator, ...updatePatientValidator]),
  patientController.updatePatient.bind(patientController)
);

// Delete patient (soft delete)
router.delete(
  '/:patientId',
  requireRoles('Admin'),
  validate(patientIdValidator),
  patientController.deletePatient.bind(patientController)
);

router.get(
  '/:patientId/update-requests',
  requireRoles('Receptionist', 'Admin', 'Doctor', 'Provider'),
  validate(patientIdValidator),
  patientController.getPatientUpdateRequests.bind(patientController)
);

router.post(
  '/:patientId/update-requests',
  requireRoles('Receptionist', 'Admin'),
  validate([...patientIdValidator, ...createPatientUpdateRequestValidator]),
  patientController.createPatientUpdateRequest.bind(patientController)
);

router.get(
  '/:patientId/reconciliation/:requestId',
  requireRoles('Receptionist', 'Admin', 'Doctor', 'Provider'),
  validate([...patientIdValidator, ...patientRequestIdValidator]),
  patientController.getPatientReconciliation.bind(patientController)
);

router.post(
  '/:patientId/reconciliation/:requestId/apply',
  requireRoles('Receptionist', 'Admin'),
  validate([...patientIdValidator, ...patientRequestIdValidator, ...applyPatientReconciliationValidator]),
  patientController.applyPatientReconciliation.bind(patientController)
);

router.get(
  '/:patientId/audit-history',
  requireRoles('Receptionist', 'Admin', 'Doctor', 'Provider'),
  validate(patientIdValidator),
  patientController.getPatientAuditHistory.bind(patientController)
);

router.get(
  '/:patientId/communications',
  requireRoles('Receptionist', 'Admin', 'Doctor', 'Provider'),
  validate(patientIdValidator),
  patientController.getPatientCommunications.bind(patientController)
);

router.post(
  '/:patientId/communications/send',
  requireRoles('Receptionist', 'Admin', 'Doctor', 'Provider'),
  validate([...patientIdValidator, ...patientCommunicationValidator]),
  patientController.createPatientCommunication.bind(patientController)
);

router.get(
  '/:patientId/coverages',
  requireRoles('Receptionist', 'Admin', 'Billing Staff'),
  validate(patientIdValidator),
  insurancePlanController.getPatientCoverages.bind(insurancePlanController)
);

router.post(
  '/:patientId/coverages',
  requireRoles('Receptionist', 'Admin', 'Billing Staff'),
  validate([...patientIdValidator, ...createPatientInsuranceValidator]),
  insurancePlanController.createPatientCoverage.bind(insurancePlanController)
);

router.get(
  '/:patientId/reports/summary',
  requireRoles('Receptionist', 'Admin', 'Doctor', 'Provider'),
  validate(patientIdValidator),
  patientController.getPatientReportSummary.bind(patientController)
);

router.get(
  '/:patientId/reports/showcase',
  requireRoles('Receptionist', 'Admin', 'Doctor', 'Provider'),
  validate(patientIdValidator),
  patientController.getPatientReportShowcase.bind(patientController)
);

router.get(
  '/:patientId/reports/concerns',
  requireRoles('Receptionist', 'Admin', 'Doctor', 'Provider'),
  validate(patientIdValidator),
  patientController.getPatientReportConcerns.bind(patientController)
);

router.post(
  '/:patientId/reports/refresh',
  requireRoles('Receptionist', 'Admin', 'Doctor', 'Provider'),
  validate(patientIdValidator),
  patientController.refreshPatientReports.bind(patientController)
);

// Patient Insurance routes
// Get all insurances for a patient
router.get(
  '/:patientId/insurance',
  requireRoles('Receptionist', 'Admin'),
  validate(patientIdValidator),
  patientInsuranceController.getPatientInsurances.bind(patientInsuranceController)
);

// Create patient insurance
router.post(
  '/:patientId/insurance',
  requireRoles('Receptionist', 'Admin'),
  validate([...patientIdValidator, ...createPatientInsuranceValidator]),
  patientInsuranceController.createPatientInsurance.bind(patientInsuranceController)
);

// Get patient insurance by ID
router.get(
  '/:patientId/insurance/:patientInsuranceId',
  requireRoles('Receptionist', 'Admin'),
  validate([...patientIdValidator, ...patientInsuranceIdValidator]),
  patientInsuranceController.getPatientInsuranceById.bind(patientInsuranceController)
);

// Update patient insurance
router.put(
  '/:patientId/insurance/:patientInsuranceId',
  requireRoles('Receptionist', 'Admin'),
  validate([...patientIdValidator, ...patientInsuranceIdValidator, ...updatePatientInsuranceValidator]),
  patientInsuranceController.updatePatientInsurance.bind(patientInsuranceController)
);

// Delete patient insurance
router.delete(
  '/:patientId/insurance/:patientInsuranceId',
  requireRoles('Receptionist', 'Admin'),
  validate([...patientIdValidator, ...patientInsuranceIdValidator]),
  patientInsuranceController.deletePatientInsurance.bind(patientInsuranceController)
);

// Patient Allergy routes
// Get all allergies for a patient
router.get(
  '/:patientId/allergies',
  validate(patientIdValidator),
  requireRoles('Receptionist', 'Doctor', 'Admin'),
  allergyController.getPatientAllergies.bind(allergyController)
);

// Create patient allergy
router.post(
  '/:patientId/allergies',
  requireRoles('Receptionist', 'Doctor', 'Admin'),
  validate([...patientIdValidator, ...createPatientAllergyValidator]),
  allergyController.createPatientAllergy.bind(allergyController)
);

// Get allergy by ID
router.get(
  '/:patientId/allergies/:allergyId',
  requireRoles('Receptionist', 'Doctor', 'Admin'),
  validate([...patientIdValidator, ...allergyIdParamValidator]),
  allergyController.getAllergyById.bind(allergyController)
);

// Update patient allergy
router.put(
  '/:patientId/allergies/:allergyId',
  requireRoles('Receptionist', 'Doctor', 'Admin'),
  validate([...patientIdValidator, ...allergyIdParamValidator, ...updateAllergyValidator]),
  allergyController.updatePatientAllergy.bind(allergyController)
);

// Delete patient allergy
router.delete(
  '/:patientId/allergies/:allergyId',
  requireRoles('Receptionist', 'Doctor', 'Admin'),
  validate([...patientIdValidator, ...allergyIdParamValidator]),
  allergyController.deletePatientAllergy.bind(allergyController)
);

export default router;
