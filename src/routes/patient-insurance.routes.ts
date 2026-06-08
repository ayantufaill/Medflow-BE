import { Router } from 'express';
import { patientInsuranceController } from '../controllers/patient-insurance.controller';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { patientIdValidator } from '../validators/patient.validator';
import { createPatientInsuranceValidator, updatePatientInsuranceValidator, patientInsuranceIdValidator } from '../validators/insurance.validator';

const router = Router();
router.use(authenticate);

/**
 * @swagger
 * /patients/{patientId}/insurance:
 *   get:
 *     summary: Get patient insurances
 *     tags: [Patient Insurance]
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
 *         description: List of insurances
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
 *                     $ref: '#/components/schemas/PatientInsurance'
 *       403: 
 *         description: Forbidden
 *       404:
 *         description: Patient not found
 * 
 *   post:
 *     summary: Add insurance to patient
 *     tags: [Patient Insurance]
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
 *               - policyNumber
 *               - subscriberName
 *               - subscriberDateOfBirth
 *             properties:
 *               insuranceType:
 *                 type: string
 *                 enum: [primary, secondary, tertiary]
 *                 example: primary
 *               insuranceCompanyId:
 *                 type: integer
 *                 example: 1
 *               relationshipToPatient:
 *                 type: string
 *                 enum: [self, spouse, child, parent, other]
 *                 example: self
 *               effectiveDate:
 *                 type: string
 *                 format: date-time
 *                 example: 2024-01-01T00:00:00.000Z
 *               policyNumber:
 *                 type: string
 *                 example: POL123456
 *               subscriberName:
 *                 type: string
 *                 example: John Doe
 *               subscriberDateOfBirth:
 *                 type: string
 *                 format: date-time
 *                 example: 1990-01-01T00:00:00.000Z
 *               subscriberId:
 *                 type: string
 *                 example: SUB123
 *                 nullable: true
 *               employer:
 *                 type: string
 *                 example: ABC Corp
 *                 nullable: true
 *               isActive:
 *                 type: boolean
 *                 example: true
 *                 default: true
 *           example:
 *             insuranceType: primary
 *             insuranceCompanyId: 1
 *             relationshipToPatient: self
 *             effectiveDate: 2024-01-01T00:00:00.000Z
 *             policyNumber: POL123456
 *             subscriberName: John Doe
 *             subscriberDateOfBirth: 1990-01-01T00:00:00.000Z
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
 *                   properties:
 *                     insurance:
 *                       $ref: '#/components/schemas/PatientInsurance'
 *       400: 
 *         description: Validation error
 *       403: 
 *         description: Forbidden
 *       404:
 *         description: Patient or Insurance company not found
 */
router.get('/:patientId/insurance', requireRoles('Receptionist', 'Admin'), validate(patientIdValidator), patientInsuranceController.getPatientInsurances.bind(patientInsuranceController));
router.post('/:patientId/insurance', requireRoles('Receptionist', 'Admin'), validate([...patientIdValidator, ...createPatientInsuranceValidator]), patientInsuranceController.createPatientInsurance.bind(patientInsuranceController));

/**
 * @swagger
 * /patients/{patientId}/insurance/{patientInsuranceId}:
 *   get:
 *     summary: Get patient insurance by ID
 *     tags: [Patient Insurance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: integer }
 *         example: 1
 *       - in: path
 *         name: patientInsuranceId
 *         required: true
 *         schema: { type: integer }
 *         example: 1
 *     responses:
 *       200: 
 *         description: Insurance details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/PatientInsurance'
 *       403: 
 *         description: Forbidden
 *       404: 
 *         description: Insurance not found
 * 
 *   put:
 *     summary: Update patient insurance
 *     tags: [Patient Insurance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: integer }
 *         example: 1
 *       - in: path
 *         name: patientInsuranceId
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
 *               insuranceType:
 *                 type: string
 *                 enum: [primary, secondary, tertiary]
 *                 example: secondary
 *               insuranceCompanyId:
 *                 type: integer
 *                 example: 1
 *               relationshipToPatient:
 *                 type: string
 *                 enum: [self, spouse, child, parent, other]
 *                 example: spouse
 *               effectiveDate:
 *                 type: string
 *                 format: date-time
 *                 example: 2024-06-01T00:00:00.000Z
 *               policyNumber:
 *                 type: string
 *                 example: POL789012
 *               subscriberName:
 *                 type: string
 *                 example: Jane Doe
 *               subscriberDateOfBirth:
 *                 type: string
 *                 format: date-time
 *                 example: 1992-05-15T00:00:00.000Z
 *               subscriberId:
 *                 type: string
 *                 example: SUB456
 *               employer:
 *                 type: string
 *                 example: XYZ Inc
 *               isActive:
 *                 type: boolean
 *                 example: false
 *           example:
 *             policyNumber: POL789012
 *             isActive: false
 *     responses:
 *       200: 
 *         description: Insurance updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/PatientInsurance'
 *       400: 
 *         description: Validation error
 *       403: 
 *         description: Forbidden
 *       404: 
 *         description: Insurance not found
 * 
 *   delete:
 *     summary: Delete patient insurance
 *     tags: [Patient Insurance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: integer }
 *         example: 1
 *       - in: path
 *         name: patientInsuranceId
 *         required: true
 *         schema: { type: integer }
 *         example: 1
 *     responses:
 *       200: 
 *         description: Insurance deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *       403: 
 *         description: Forbidden
 *       404: 
 *         description: Insurance not found
 */
router.get('/:patientId/insurance/:patientInsuranceId', requireRoles('Receptionist', 'Admin'), validate([...patientIdValidator, ...patientInsuranceIdValidator]), patientInsuranceController.getPatientInsuranceById.bind(patientInsuranceController));
router.put('/:patientId/insurance/:patientInsuranceId', requireRoles('Receptionist', 'Admin'), validate([...patientIdValidator, ...patientInsuranceIdValidator, ...updatePatientInsuranceValidator]), patientInsuranceController.updatePatientInsurance.bind(patientInsuranceController));
router.delete('/:patientId/insurance/:patientInsuranceId', requireRoles('Receptionist', 'Admin'), validate([...patientIdValidator, ...patientInsuranceIdValidator]), patientInsuranceController.deletePatientInsurance.bind(patientInsuranceController));

export default router;