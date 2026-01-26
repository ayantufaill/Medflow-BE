import { Router } from 'express';
import { allergyController } from '../controllers/allergy.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  createAllergyValidator,
  updateAllergyValidator,
  allergyIdValidator,
  getAllergiesQueryValidator,
} from '../validators/allergy.validator';

const router = Router();

// All allergy routes require authentication
router.use(authenticate);

// Create allergy
router.post(
  '/',
  validate(createAllergyValidator),
  allergyController.createAllergy.bind(allergyController)
);

// Get all allergies for a patient (using query param patient_id)
router.get(
  '/',
  validate(getAllergiesQueryValidator),
  allergyController.getAllergies.bind(allergyController)
);

// Get allergy by ID
router.get(
  '/:id',
  validate(allergyIdValidator),
  allergyController.getAllergyById.bind(allergyController)
);

// Update allergy
router.put(
  '/:id',
  validate([...allergyIdValidator, ...updateAllergyValidator]),
  allergyController.updateAllergy.bind(allergyController)
);

// Delete allergy (soft delete)
router.delete(
  '/:id',
  validate(allergyIdValidator),
  allergyController.deleteAllergy.bind(allergyController)
);

export default router;

