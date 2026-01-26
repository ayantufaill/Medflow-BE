import { Router } from 'express';
import { body } from 'express-validator';
import { patientController } from '../controllers/patient.controller';
import { patientInsuranceController } from '../controllers/patient-insurance.controller';
import { allergyController } from '../controllers/allergy.controller';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  patientIdValidator,
  createPatientValidator,
  updatePatientValidator,
  patientSearchValidator,
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
