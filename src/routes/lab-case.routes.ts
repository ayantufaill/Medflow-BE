import { Router } from 'express';
import { labCaseController } from '../controllers/lab-case.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  getLabCasesValidator,
  labCaseIdValidator,
  createLabCaseValidator,
  updateLabCaseValidator,
  getLabsValidator,
  createLabValidator
} from '../validators/lab-case.validator';

const router = Router();

/**
 * @swagger
 * /lab-cases/laboratories:
 *   get:
 *     summary: Fetch all laboratories
 *     tags: [Lab Cases]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: includeHidden
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Successfully fetched laboratories
 */
router.get(
  '/laboratories',
  authenticate,
  requirePermission('clinical-notes.read'),
  validate(getLabsValidator),
  labCaseController.getAllLaboratories
);

/**
 * @swagger
 * /lab-cases/laboratories:
 *   post:
 *     summary: Create a new laboratory
 *     tags: [Lab Cases]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               description:
 *                 type: string
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *               address:
 *                 type: string
 *               city:
 *                 type: string
 *               state:
 *                 type: string
 *               zip:
 *                 type: string
 *     responses:
 *       201:
 *         description: Successfully created laboratory
 */
router.post(
  '/laboratories',
  authenticate,
  requirePermission('clinical-notes.update'),
  validate(createLabValidator),
  labCaseController.createLaboratory
);

/**
 * @swagger
 * /lab-cases:
 *   get:
 *     summary: Fetch all lab cases (paginated, filtered, sorted)
 *     tags: [Lab Cases]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: patientId
 *         schema:
 *           type: string
 *       - in: query
 *         name: tab
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successfully fetched lab cases
 */
router.get(
  '/',
  authenticate,
  requirePermission('clinical-notes.read'),
  validate(getLabCasesValidator),
  labCaseController.getAllLabCases
);

/**
 * @swagger
 * /lab-cases/{id}:
 *   get:
 *     summary: Fetch a specific lab case by ID
 *     tags: [Lab Cases]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successfully fetched lab case
 */
router.get(
  '/:id',
  authenticate,
  requirePermission('clinical-notes.read'),
  validate(labCaseIdValidator),
  labCaseController.getLabCaseById
);

/**
 * @swagger
 * /lab-cases:
 *   post:
 *     summary: Create a new lab case
 *     tags: [Lab Cases]
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
 *               laboratoryId:
 *                 type: string
 *               appointmentId:
 *                 type: string
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *               sharedOn:
 *                 type: string
 *                 format: date-time
 *               instructions:
 *                 type: string
 *               labFee:
 *                 type: number
 *               providerNum:
 *                 type: string
 *     responses:
 *       201:
 *         description: Successfully created lab case
 */
router.post(
  '/',
  authenticate,
  requirePermission('clinical-notes.update'),
  validate(createLabCaseValidator),
  labCaseController.createLabCase
);

/**
 * @swagger
 * /lab-cases/{id}:
 *   patch:
 *     summary: Update an existing lab case
 *     tags: [Lab Cases]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               laboratoryId:
 *                 type: string
 *               appointmentId:
 *                 type: string
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *               dateSent:
 *                 type: string
 *                 format: date-time
 *               dateReceived:
 *                 type: string
 *                 format: date-time
 *               dateChecked:
 *                 type: string
 *                 format: date-time
 *               instructions:
 *                 type: string
 *               labFee:
 *                 type: number
 *               invoiceNum:
 *                 type: string
 *     responses:
 *       200:
 *         description: Successfully updated lab case
 */
router.patch(
  '/:id',
  authenticate,
  requirePermission('clinical-notes.update'),
  (req, res, next) => {
    console.log('🔥 PATCH /lab-cases/:id reached!');
    next();
  },
  validate([...labCaseIdValidator, ...updateLabCaseValidator]),
  labCaseController.updateLabCase
);

/**
 * @swagger
 * /lab-cases/{id}/status:
 *   patch:
 *     summary: Update lab case status
 *     tags: [Lab Cases]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Successfully updated lab case status
 */
router.patch(
  '/:id/status',
  authenticate,
  requirePermission('clinical-notes.update'),
  (req, res, next) => {
    console.log('🔥 PATCH /lab-cases/:id/status reached!');
    next();
  },
  validate(labCaseIdValidator),
  labCaseController.updateLabCaseStatus
);

/**
 * @swagger
 * /lab-cases/{id}:
 *   delete:
 *     summary: Delete a lab case
 *     tags: [Lab Cases]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successfully deleted lab case
 */
router.delete(
  '/:id',
  authenticate,
  requirePermission('clinical-notes.delete'),
  (req, res, next) => {
    console.log('🔥 DELETE /lab-cases/:id reached!');
    next();
  },
  validate(labCaseIdValidator),
  labCaseController.deleteLabCase
);

export default router;