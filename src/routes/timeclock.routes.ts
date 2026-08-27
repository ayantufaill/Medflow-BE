import { Router } from 'express';
import { timeClockController } from '../controllers/timeclock.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Protect all time clock endpoints
router.use(authenticate);

/**
 * @swagger
 * /timeclock/timesheets:
 *   get:
 *     summary: Get timesheet records grouped by employee
 *     tags: [TimeClock]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *       - in: query
 *         name: dateRange
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Aggregated timesheets and summary statistics
 */
router.get('/timesheets', (req, res, next) => timeClockController.getTimesheets(req, res, next));

/**
 * @swagger
 * /timeclock/record:
 *   post:
 *     summary: Add a new time clock record (Clock In / Clock Out / Break)
 *     tags: [TimeClock]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - date
 *               - time
 *               - recordType
 *             properties:
 *               user:
 *                 type: string
 *               employeeNum:
 *                 type: string
 *               date:
 *                 type: string
 *               time:
 *                 type: string
 *               recordType:
 *                 type: string
 *                 enum: [Clock In, Clock Out, Break]
 *               note:
 *                 type: string
 *     responses:
 *       201:
 *         description: Time clock record created successfully
 */
router.post('/record', (req, res, next) => timeClockController.addTimeClockRecord(req, res, next));

export default router;
