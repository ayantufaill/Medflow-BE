import { Router } from 'express';
import { patientReferralController } from '../controllers/patient-referral.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  getPatientReferralsValidator,
  createPatientReferralValidator
} from '../validators/patient-referral.validator';

const router = Router();

/**
 * @swagger
 * /patient-referrals:
 *   get:
 *     summary: Get all patient referrals
 *     tags: [Patient Referrals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: patientId
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: List of patient referrals
 */
router.get(
  '/',
  authenticate,
  requirePermission('clinical-notes.read'),
  validate(getPatientReferralsValidator),
  patientReferralController.getPatientReferrals
);

/**
 * @swagger
 * /patient-referrals:
 *   post:
 *     summary: Create a new patient referral
 *     tags: [Patient Referrals]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               patientId:
 *                 type: string
 *               specialist:
 *                 type: string
 *               specialty:
 *                 type: string
 *               reason:
 *                 type: string
 *     responses:
 *       201:
 *         description: Patient referral created successfully
 */
router.post(
  '/',
  authenticate,
  requirePermission('clinical-notes.update'),
  validate(createPatientReferralValidator),
  patientReferralController.createPatientReferral
);

export default router;
