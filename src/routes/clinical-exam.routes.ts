import { Router } from 'express';
import { clinicalExamController } from '../controllers/clinical-exam.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  examTypeParamValidator,
  appointmentIdParamValidator,
  upsertExamValidator,
} from '../validators/clinical-exam.validator';

const router = Router();

// GET  /:examType/:appointmentId       → Fetch exam
/**
 * @swagger
 * /clinical-exams/{examType}/{appointmentId}:
 *   get:
 *     summary: Fetch a specific clinical exam by appointment and type
 *     tags: [Clinical Exams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: examType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [radiographic, tmj, head-neck, tooth-structure, morphological, periodontal, dentofacial, airway]
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Successfully fetched exam
 */
router.get(
  '/:examType/:appointmentId',
  authenticate,
  requirePermission('clinical-notes.read'),
  validate([...examTypeParamValidator, ...appointmentIdParamValidator]),
  clinicalExamController.getExamByAppointment
);

// PUT  /:examType/:appointmentId       → Create or Update exam
/**
 * @swagger
 * /clinical-exams/{examType}/{appointmentId}:
 *   put:
 *     summary: Create or update a specific clinical exam by appointment and type
 *     tags: [Clinical Exams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: examType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [radiographic, tmj, head-neck, tooth-structure, morphological, periodontal, dentofacial, airway]
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               patientId:
 *                 type: string
 *               providerId:
 *                 type: string
 *               examData:
 *                 type: object
 *     responses:
 *       200:
 *         description: Successfully upserted exam
 */
router.put(
  '/:examType/:appointmentId',
  authenticate,
  requirePermission('clinical-notes.update'),
  validate([...examTypeParamValidator, ...appointmentIdParamValidator, ...upsertExamValidator]),
  clinicalExamController.upsertExam
);

// POST /:examType/:appointmentId/sign  → Sign & Lock exam
/**
 * @swagger
 * /clinical-exams/{examType}/{appointmentId}/sign:
 *   post:
 *     summary: Sign and lock a specific clinical exam
 *     tags: [Clinical Exams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: examType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [radiographic, tmj, head-neck, tooth-structure, morphological, periodontal, dentofacial, airway]
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Successfully signed exam
 */
router.post(
  '/:examType/:appointmentId/sign',
  authenticate,
  requirePermission('clinical-notes.sign'),
  validate([...examTypeParamValidator, ...appointmentIdParamValidator]),
  clinicalExamController.signExam
);

export default router;
