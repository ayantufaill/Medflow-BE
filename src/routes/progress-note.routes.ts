import { Router } from 'express';
import { progressNoteController } from '../controllers/progress-note.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  getProgressNotesValidator,
  createProgressNoteValidator,
  addProcedureValidator
} from '../validators/progress-note.validator';

const router = Router();

/**
 * @swagger
 * /progress-notes:
 *   get:
 *     summary: Get all progress notes
 *     description: Returns a paginated list of progress notes, optionally filtered by patient, archive tab, or category. Filtering and pagination are applied in-memory after fetching matching notes.
 *     tags: [Progress Notes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: patientId
 *         schema: { type: string }
 *         description: Filter notes by patient ID
 *         example: "1"
 *       - in: query
 *         name: tab
 *         schema: { type: string, enum: [Archived, Active] }
 *         description: Filter by archive status. "Archived" returns archived notes; any other value (or omitted) returns active (non-archived) notes.
 *         example: "Active"
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *         description: Filter by note category. "All" or omitted returns notes of every category.
 *         example: "General Notes"
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, default: 25 }
 *         description: Number of records per page
 *     responses:
 *       200:
 *         description: List of progress notes with pagination metadata
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     notes:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id: { type: string, example: "12345" }
 *                           date: { type: string, format: date-time }
 *                           procedures:
 *                             type: array
 *                             items: { type: string }
 *                             example: ["D0120", "D2750"]
 *                           description: { type: string }
 *                           provider: { type: string, example: "Dr. Sarah Mitchell" }
 *                           signedBy: { type: string, example: "Dr. Sarah Mitchell" }
 *                           signedDate: { type: string, format: date-time }
 *                           category: { type: string, example: "General Notes" }
 *                           isExpanded: { type: boolean, example: false }
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page: { type: integer, example: 1 }
 *                         limit: { type: integer, example: 25 }
 *                         total: { type: integer, description: "Total count after filters applied" }
 *                         pages: { type: integer }
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       403:
 *         description: Forbidden — missing clinical-notes.read permission
 */
router.get(
  '/',
  authenticate,
  requirePermission('clinical-notes.read'),
  validate(getProgressNotesValidator),
  progressNoteController.getProgressNotes
);

/**
 * @swagger
 * /progress-notes:
 *   post:
 *     summary: Create a new progress note
 *     description: Creates a new progress note for a patient. The note is stored as a structured commlog entry.
 *     tags: [Progress Notes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [patientId, category, description, providerId]
 *             properties:
 *               patientId:
 *                 type: string
 *                 description: ID of the patient this note belongs to
 *                 example: "1"
 *               category:
 *                 type: string
 *                 description: Note category (e.g. "exam", "treatment", "soap")
 *                 example: "exam"
 *               description:
 *                 type: string
 *                 description: Free-text content of the progress note
 *                 example: "Routine checkup completed - no issues found"
 *               providerId:
 *                 type: string
 *                 description: ID of the provider who authored the note
 *                 example: "1"
 *     responses:
 *       201:
 *         description: Progress note created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     progressNote:
 *                       type: object
 *                       properties:
 *                         id: { type: string }
 *                         date: { type: string, format: date-time }
 *                         procedures:
 *                           type: array
 *                           items: { type: string }
 *                         description: { type: string }
 *                         provider: { type: string }
 *                         signedBy: { type: string }
 *                         signedDate: { type: string, format: date-time }
 *                         category: { type: string }
 *                         isExpanded: { type: boolean }
 *                 message: { type: string, example: "Progress note created successfully" }
 *       400:
 *         description: Validation error — missing or invalid fields
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       403:
 *         description: Forbidden — missing clinical-notes.update permission
 */
router.post(
  '/',
  authenticate,
  requirePermission('clinical-notes.update'),
  validate(createProgressNoteValidator),
  progressNoteController.createProgressNote
);

/**
 * @swagger
 * /progress-notes/{id}/procedures:
 *   post:
 *     summary: Add a procedure to a progress note
 *     description: Appends a procedure code to an existing progress note's procedure list.
 *     tags: [Progress Notes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: ID of the progress note to update
 *         example: "12345"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [procedureCode]
 *             properties:
 *               procedureCode:
 *                 type: string
 *                 description: ADA procedure code to add
 *                 example: "D0120"
 *     responses:
 *       200:
 *         description: Procedure added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     message: { type: string, example: "Procedure added successfully" }
 *                     procedures:
 *                       type: array
 *                       items: { type: string }
 *                       example: ["D0120", "D2140"]
 *                 message: { type: string, example: "Procedure added successfully" }
 *       400:
 *         description: Validation error — missing procedureCode
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       403:
 *         description: Forbidden — missing clinical-notes.update permission
 *       404:
 *         description: Progress note not found
 *       422:
 *         description: Cannot add procedures to a signed progress note
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: false }
 *                 error:
 *                   type: object
 *                   properties:
 *                     message: { type: string, example: "Cannot add procedures to a signed progress note" }
 */
router.post(
  '/:id/procedures',
  authenticate,
  requirePermission('clinical-notes.update'),
  validate(addProcedureValidator),
  progressNoteController.addProcedure
);

/**
 * @swagger
 * /progress-notes/{id}:
 *   put:
 *     summary: Update a progress note
 *     description: Updates the description and/or category of an existing progress note
 *     tags: [Progress Notes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: ID of the progress note to update
 *         example: "12345"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               description:
 *                 type: string
 *                 description: Updated description/content of the note
 *                 example: "Updated: Patient reported improvement"
 *               category:
 *                 type: string
 *                 description: Updated category
 *                 example: "follow-up"
 *     responses:
 *       200:
 *         description: Progress note updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     progressNote:
 *                       type: object
 *                       properties:
 *                         id: { type: string }
 *                         date: { type: string, format: date-time }
 *                         procedures:
 *                           type: array
 *                           items: { type: string }
 *                         description: { type: string }
 *                         provider: { type: string }
 *                         signedBy: { type: string }
 *                         signedDate: { type: string, format: date-time }
 *                         category: { type: string }
 *                         isExpanded: { type: boolean }
 *                 message: { type: string, example: "Progress note updated successfully" }
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       403:
 *         description: Forbidden — missing clinical-notes.update permission
 *       404:
 *         description: Progress note not found
 *       422:
 *         description: Cannot edit a signed progress note — sign/lock immutability guard
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: false }
 *                 error:
 *                   type: object
 *                   properties:
 *                     message: { type: string, example: "Cannot edit a signed progress note" }
 */
router.put(
  '/:id',
  authenticate,
  requirePermission('clinical-notes.update'),
  progressNoteController.updateProgressNote
);

/**
 * @swagger
 * /progress-notes/{id}/archive:
 *   patch:
 *     summary: Archive a progress note
 *     description: Marks a progress note as archived by setting isArchived to true
 *     tags: [Progress Notes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: ID of the progress note to archive
 *         example: "12345"
 *     responses:
 *       200:
 *         description: Progress note archived successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     progressNote:
 *                       type: object
 *                       properties:
 *                         id: { type: string }
 *                         date: { type: string, format: date-time }
 *                         procedures:
 *                           type: array
 *                           items: { type: string }
 *                         description: { type: string }
 *                         provider: { type: string }
 *                         signedBy: { type: string }
 *                         signedDate: { type: string, format: date-time }
 *                         category: { type: string }
 *                         isArchived: { type: boolean, example: true }
 *                         isExpanded: { type: boolean }
 *                 message: { type: string, example: "Progress note archived successfully" }
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       403:
 *         description: Forbidden — missing clinical-notes.update permission
 *       404:
 *         description: Progress note not found
 */
router.patch(
  '/:id/archive',
  authenticate,
  requirePermission('clinical-notes.update'),
  progressNoteController.archiveProgressNote
);

/**
 * @swagger
 * /progress-notes/{id}/unarchive:
 *   patch:
 *     summary: Unarchive a progress note
 *     description: Removes archive status from a progress note by setting isArchived to false
 *     tags: [Progress Notes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: ID of the progress note to unarchive
 *         example: "12345"
 *     responses:
 *       200:
 *         description: Progress note unarchived successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     progressNote:
 *                       type: object
 *                       properties:
 *                         id: { type: string }
 *                         date: { type: string, format: date-time }
 *                         procedures:
 *                           type: array
 *                           items: { type: string }
 *                         description: { type: string }
 *                         provider: { type: string }
 *                         signedBy: { type: string }
 *                         signedDate: { type: string, format: date-time }
 *                         category: { type: string }
 *                         isArchived: { type: boolean, example: false }
 *                         isExpanded: { type: boolean }
 *                 message: { type: string, example: "Progress note unarchived successfully" }
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       403:
 *         description: Forbidden — missing clinical-notes.update permission
 *       404:
 *         description: Progress note not found
 */
router.patch(
  '/:id/unarchive',
  authenticate,
  requirePermission('clinical-notes.update'),
  progressNoteController.unarchiveProgressNote
);

/**
 * @swagger
 * /progress-notes/{id}/sign:
 *   patch:
 *     summary: Sign a progress note
 *     description: Marks a progress note as signed by updating signedBy and signedDate
 *     tags: [Progress Notes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: ID of the progress note to sign
 *         example: "12345"
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               signedBy:
 *                 type: string
 *                 description: Name of the person signing (defaults to current user)
 *                 example: "Dr. Sarah Mitchell"
 *     responses:
 *       200:
 *         description: Progress note signed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     progressNote:
 *                       type: object
 *                       properties:
 *                         id: { type: string }
 *                         date: { type: string, format: date-time }
 *                         procedures:
 *                           type: array
 *                           items: { type: string }
 *                         description: { type: string }
 *                         provider: { type: string }
 *                         signedBy: { type: string }
 *                         signedDate: { type: string, format: date-time }
 *                         category: { type: string }
 *                         isArchived: { type: boolean }
 *                         status: { type: string, example: "signed" }
 *                         isExpanded: { type: boolean }
 *                 message: { type: string, example: "Progress note signed successfully" }
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       403:
 *         description: Forbidden — missing clinical-notes.update permission
 *       404:
 *         description: Progress note not found
 */
router.patch(
  '/:id/sign',
  authenticate,
  requirePermission('clinical-notes.update'),
  progressNoteController.signProgressNote
);

/**
 * @swagger
 * /progress-notes/{id}/export:
 *   get:
 *     summary: Export a progress note as PDF
 *     description: Generates and returns a PDF representation of the progress note. Returns 501 if PDF generation is unavailable.
 *     tags: [Progress Notes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: ID of the progress note to export
 *         example: "12345"
 *     responses:
 *       200:
 *         description: PDF generated successfully
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       403:
 *         description: Forbidden — missing clinical-notes.read permission
 *       404:
 *         description: Progress note not found
 *       501:
 *         description: PDF export unavailable — generation library failed to load
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: false }
 *                 error:
 *                   type: object
 *                   properties:
 *                     message: { type: string, example: "PDF export is currently unavailable: PDF generation library failed to load" }
 */
router.get(
  '/:id/export',
  authenticate,
  requirePermission('clinical-notes.read'),
  progressNoteController.exportProgressNote
);
export default router;