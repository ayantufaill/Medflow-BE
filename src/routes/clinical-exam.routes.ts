import { Router } from 'express';
import { clinicalExamController } from '../controllers/clinical-exam.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  examTypeParamValidator,
  appointmentIdParamValidator,
  patientIdParamValidator,
  upsertExamValidator,
} from '../validators/clinical-exam.validator';

const router = Router();

// ✅ ADD THIS ROOT GET TO FIX THE 404 TEST
router.get(
  '/',
  authenticate,
  requirePermission('clinical-notes.read'),
  (req, res) => {
    res.json({ success: true, message: 'Clinical exams endpoint' });
  }
);

/**
 * @swagger
 * /clinical-exams/{examType}/{appointmentId}:
 *   get:
 *     summary: Fetch a specific clinical exam by appointment and type
 *     description: Returns the structured exam record for the given appointment and exam type, or null if no exam has been created yet. "biomechanical" and "functional" exams are stored as user preference records rather than dedicated tables.
 *     tags: [Clinical Exams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: examType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [radiographic, tmj, head-neck, tooth-structure, teeth-structure, morphological, periodontal, dentofacial, airway, biomechanical, functional, dentofacial-opinion, periodontal-opinion]
 *         description: Type of clinical exam to fetch
 *         example: "periodontal"
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema: { type: integer }
 *         description: Appointment ID (AptNum) the exam is associated with
 *         example: 1
 *     responses:
 *       200:
 *         description: Successfully fetched exam (or null if not found)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     id: { type: string, example: "1" }
 *                     examType: { type: string, example: "periodontal" }
 *                     patientId: { type: string, example: "1" }
 *                     appointmentId: { type: string, example: "1" }
 *                     providerId: { type: string, example: "1" }
 *                     isSigned: { type: boolean, example: false }
 *                     signedBy: { type: string, nullable: true, example: null }
 *                     signedAt: { type: string, format: date-time, nullable: true }
 *                     examData:
 *                       type: object
 *                       description: Structured exam findings; shape varies by examType
 *                     createdAt: { type: string, format: date-time }
 *                     updatedAt: { type: string, format: date-time }
 *                     createdBy: { type: string, example: "1" }
 *                     updatedBy: { type: string, example: "1" }
 *       400:
 *         description: Validation error — invalid examType or appointmentId
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       403:
 *         description: Forbidden — missing clinical-notes.read permission
 */
router.get(
  '/:examType/:appointmentId',
  authenticate,
  requirePermission('clinical-notes.read'),
  validate([...examTypeParamValidator, ...appointmentIdParamValidator]),
  clinicalExamController.getExamByAppointment
);

/**
 * @swagger
 * /clinical-exams/{examType}/{appointmentId}:
 *   put:
 *     summary: Create or update a specific clinical exam by appointment and type
 *     description: |
 *       Creates a new exam record if none exists for the appointment, or updates the existing one.
 *       Fails with 403 if the exam is already signed and locked.
 *       "biomechanical" and "functional" exams are stored as user preference records rather than dedicated tables.
 *       The `examData` field shape varies by examType — see the request body examples for periodontal, teeth-structure, and radiographic payloads.
 *       Maximum examData payload size: 10MB.
 *     tags: [Clinical Exams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: examType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [radiographic, tmj, head-neck, tooth-structure, teeth-structure, morphological, periodontal, dentofacial, airway, biomechanical, functional, dentofacial-opinion, periodontal-opinion]
 *         description: Type of clinical exam to create or update
 *         example: "periodontal"
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema: { type: integer }
 *         description: Appointment ID (AptNum) the exam is associated with
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [patientId, providerId, examData]
 *             properties:
 *               patientId:
 *                 type: string
 *                 description: ID of the patient this exam belongs to
 *                 example: "1"
 *               providerId:
 *                 type: string
 *                 description: ID of the provider performing the exam
 *                 example: "1"
 *               examData:
 *                 type: object
 *                 description: Structured exam findings; shape varies depending on examType
 *           examples:
 *             periodontal:
 *               summary: Periodontal exam with pocket depths, bleeding, recession
 *               value:
 *                 patientId: "1"
 *                 providerId: "1"
 *                 examData:
 *                   pocketDepths:
 *                     "1": { buccal: [3, 2, 3], lingual: [2, 3, 2] }
 *                     "2": { buccal: [4, 3, 4], lingual: [3, 3, 3] }
 *                   bleedingOnProbing:
 *                     "1": { buccal: [false, false, true], lingual: [false, false, false] }
 *                   recession:
 *                     "1": { buccal: [0, 0, 1], lingual: [0, 0, 0] }
 *                   furcation: { "3": 1, "14": 2 }
 *                   mobility: { "8": 1, "24": 0 }
 *                   notes: "Generalized moderate periodontitis"
 *             teeth-structure:
 *               summary: Teeth structure exam with per-tooth conditions
 *               value:
 *                 patientId: "1"
 *                 providerId: "1"
 *                 examData:
 *                   teeth:
 *                     "3": { condition: "caries", surfaces: ["MO"], severity: "moderate", notes: "Class II MO caries" }
 *                     "14": { condition: "fracture", surfaces: ["B"], severity: "mild", notes: "Craze line on buccal" }
 *                     "19": { condition: "restoration", surfaces: ["MOD"], material: "composite", status: "intact" }
 *                   generalNotes: "Generalized attrition on anterior teeth"
 *                   wearPattern: "Moderate bruxism-related wear"
 *             radiographic:
 *               summary: Radiographic exam with regional findings
 *               value:
 *                 patientId: "1"
 *                 providerId: "1"
 *                 examData:
 *                   findings:
 *                     - region: "maxillary right"
 *                       toothNumbers: [2, 3, 4]
 *                       finding: "Periapical radiolucency"
 *                       severity: "moderate"
 *                       notes: "3mm radiolucency at apex of #3"
 *                   boneLoss: { "maxillary right": "mild", "mandibular left": "moderate" }
 *                   radiographType: "full mouth series"
 *                   notes: "No significant pathology noted"
 *     responses:
 *       200:
 *         description: Successfully created or updated exam
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     exam:
 *                       $ref: '#/components/schemas/ClinicalExamRecord'
 *                 message: { type: string, example: "periodontal exam saved successfully" }
 *       400:
 *         description: Validation error — missing or invalid fields, or examData exceeds 10MB
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       403:
 *         description: Forbidden — missing clinical-notes.update permission, or exam is signed and locked
 */
router.put(
  '/:examType/:appointmentId',
  authenticate,
  requirePermission('clinical-notes.update'),
  validate([...examTypeParamValidator, ...appointmentIdParamValidator, ...upsertExamValidator]),
  clinicalExamController.upsertExam
);

/**
 * @swagger
 * /clinical-exams/{examType}/{appointmentId}/sign:
 *   post:
 *     summary: Sign and lock a specific clinical exam
 *     description: Marks the exam as signed by the authenticated user, recording the signing provider and timestamp. Once signed, the exam can no longer be edited via PUT. Fails with 404 if no exam exists yet, and 400 if already signed.
 *     tags: [Clinical Exams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: examType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [radiographic, tmj, head-neck, tooth-structure, teeth-structure, morphological, periodontal, dentofacial, airway, biomechanical, functional, dentofacial-opinion, periodontal-opinion]
 *         description: Type of clinical exam to sign
 *         example: "periodontal"
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema: { type: integer }
 *         description: Appointment ID (AptNum) the exam is associated with
 *         example: 1
 *     responses:
 *       200:
 *         description: Successfully signed and locked the exam
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     id: { type: string, example: "1" }
 *                     examType: { type: string, example: "periodontal" }
 *                     patientId: { type: string, example: "1" }
 *                     appointmentId: { type: string, example: "1" }
 *                     providerId: { type: string, example: "1" }
 *                     isSigned: { type: boolean, example: true }
 *                     signedBy: { type: string, example: "1" }
 *                     signedAt: { type: string, format: date-time }
 *                     examData:
 *                       type: object
 *                       description: Structured exam findings; shape varies by examType
 *                     createdAt: { type: string, format: date-time }
 *                     updatedAt: { type: string, format: date-time }
 *                     createdBy: { type: string, example: "1" }
 *                     updatedBy: { type: string, example: "1" }
 *       400:
 *         description: Exam is already signed
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       403:
 *         description: Forbidden — missing clinical-notes.sign permission
 *       404:
 *         description: No exam found for this appointment and exam type
 */
router.post(
  '/:examType/:appointmentId/sign',
  authenticate,
  requirePermission('clinical-notes.sign'),
  validate([...examTypeParamValidator, ...appointmentIdParamValidator]),
  clinicalExamController.signExam
);

/**
 * @swagger
 * /clinical-exams/{examType}/{appointmentId}:
 *   delete:
 *     summary: Delete a specific clinical exam
 *     description: Permanently deletes the exam record for the given appointment and exam type. Fails with 404 if no exam exists, and 403 if the exam is already signed and locked.
 *     tags: [Clinical Exams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: examType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [radiographic, tmj, head-neck, tooth-structure, teeth-structure, morphological, periodontal, dentofacial, airway, biomechanical, functional, dentofacial-opinion, periodontal-opinion]
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Exam deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { nullable: true, example: null }
 *                 message: { type: string, example: "radiographic exam deleted successfully" }
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — exam is signed and locked
 *       404:
 *         description: Exam not found
 */
router.delete(
  '/:examType/:appointmentId',
  authenticate,
  requirePermission('clinical-notes.delete'),
  validate([...examTypeParamValidator, ...appointmentIdParamValidator]),
  clinicalExamController.deleteExam
);

/**
 * @swagger
 * /clinical-exams/history/{examType}/patient/{patientId}:
 *   get:
 *     summary: Fetch chronological list of exam history entries for a patient by type
 *     description: |
 *       Returns an array of objects containing the date and associated appointmentId when exams
 *       of the given type were created for the patient, sorted in ascending chronological order.
 *       The appointmentId can be used to load the full exam via GET /clinical-exams/{examType}/{appointmentId}.
 *     tags: [Clinical Exams]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: examType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [radiographic, tmj, head-neck, tooth-structure, teeth-structure, morphological, periodontal, dentofacial, airway, biomechanical, functional, dentofacial-opinion, periodontal-opinion]
 *         description: Type of clinical exam
 *         example: "periodontal"
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: integer }
 *         description: Patient ID
 *         example: 1
 *     responses:
 *       200:
 *         description: Successfully fetched exam history
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     dates:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/ExamHistoryEntry'
 *             example:
 *               success: true
 *               data:
 *                 dates:
 *                   - date: "2026-01-15T10:30:00.000Z"
 *                     appointmentId: "101"
 *                   - date: "2026-03-20T14:00:00.000Z"
 *                     appointmentId: "205"
 *       400:
 *         description: Validation error — invalid examType or patientId
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       403:
 *         description: Forbidden — missing clinical-notes.read permission
 */
router.get(
  '/history/:examType/patient/:patientId',
  authenticate,
  requirePermission('clinical-notes.read'),
  validate([...examTypeParamValidator, ...patientIdParamValidator]),
  clinicalExamController.getExamHistoryDates
);

export default router;