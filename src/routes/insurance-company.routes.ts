import { Router } from 'express';
import { insuranceCompanyController } from '../controllers/insurance-company.controller';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  insuranceCompanyIdValidator,
  createInsuranceCompanyValidator,
  updateInsuranceCompanyValidator,
} from '../validators/insurance.validator';

const router = Router();

// All insurance company routes require authentication
router.use(authenticate);

// Get all insurance companies
router.get('/', insuranceCompanyController.getAllInsuranceCompanies.bind(insuranceCompanyController));

// Get insurance company by ID
router.get(
  '/:insuranceCompanyId',
  validate(insuranceCompanyIdValidator),
  insuranceCompanyController.getInsuranceCompanyById.bind(insuranceCompanyController)
);

// Create insurance company (Admin only)
router.post(
  '/',
  requireRoles('Admin'),
  validate(createInsuranceCompanyValidator),
  insuranceCompanyController.createInsuranceCompany.bind(insuranceCompanyController)
);

// Update insurance company (Admin only)
router.put(
  '/:insuranceCompanyId',
  requireRoles('Admin'),
  validate([...insuranceCompanyIdValidator, ...updateInsuranceCompanyValidator]),
  insuranceCompanyController.updateInsuranceCompany.bind(insuranceCompanyController)
);

// Delete insurance company (Admin only)
router.delete(
  '/:insuranceCompanyId',
  requireRoles('Admin'),
  validate(insuranceCompanyIdValidator),
  insuranceCompanyController.deleteInsuranceCompany.bind(insuranceCompanyController)
);

export default router;

