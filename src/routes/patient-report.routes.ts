import { Router } from 'express';
import { param, query } from 'express-validator';
import { patientReportController } from '../controllers/patient-report.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validation.middleware';

const router = Router();

/**
 * @swagger
 * /patients/{patientId}/report:
 *   get:
 *     summary: Generate a comprehensive patient clinical report
 *     description: |
 *       Aggregates all clinical exam data for a patient and returns report-ready findings
 *       with risk scores across gum health, tooth decay, bite alignment, appearance,
 *       and medical factors. Also includes home care recommendations, primary concerns,
 *       and a showcase of completed treatments.
 *
 *       If `appointmentId` is provided, fetches exams for that specific appointment.
 *       If omitted, automatically finds the most recent appointment with clinical exam data.
 *     tags: [Patient Report]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: string }
 *         description: Patient ID
 *         example: "123"
 *       - in: query
 *         name: appointmentId
 *         required: false
 *         schema: { type: string }
 *         description: Optional appointment ID to scope exams to a specific visit
 *         example: "456"
 *     responses:
 *       200:
 *         description: Successfully generated patient report
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     riskAssessment:
 *                       type: object
 *                       properties:
 *                         gumHealth: { type: object }
 *                         toothDecay: { type: object }
 *                         biteAlignment: { type: object }
 *                         appearance: { type: object }
 *                         medicalFactors: { type: object }
 *                     homeCare:
 *                       type: object
 *                       properties:
 *                         oralHygiene: { type: object }
 *                         flossing: { type: object }
 *                         products: { type: object }
 *                     concerns:
 *                       type: object
 *                       properties:
 *                         primaryConcern: { type: string }
 *                         concernType: { type: string }
 *                         templateKey: { type: string }
 *                     showcase:
 *                       type: object
 *                       properties:
 *                         completedTreatments: { type: array }
 *                     metadata:
 *                       type: object
 *                       properties:
 *                         patientId: { type: string }
 *                         appointmentId: { type: string, nullable: true }
 *                         examDate: { type: string, format: date-time, nullable: true }
 *                         providerName: { type: string, nullable: true }
 *       400:
 *         description: Validation error — invalid patientId
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       403:
 *         description: Forbidden — missing clinical-notes.read permission
 *       404:
 *         description: Patient not found
 */
router.get(
  '/:patientId/report',
  authenticate,
  requirePermission('clinical-notes.read'),
  validate([
    param('patientId').isString().notEmpty().withMessage('patientId is required'),
    query('appointmentId').optional().isString().withMessage('appointmentId must be a string'),
  ]),
  patientReportController.getPatientReport
);

export default router;
