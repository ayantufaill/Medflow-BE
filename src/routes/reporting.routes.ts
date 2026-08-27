import { Router } from 'express';
import { reportingController } from '../controllers/reporting.controller';
import { authenticate } from '../middleware/auth.middleware';
import { resolveBranchAccess } from '../middleware/branchAccess.middleware';
import { enterTenantContext } from '../middleware/tenantContext.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  saveReportValidator,
  runReportValidator,
  reportIdParamValidator,
  archiveReportValidator,
} from '../validators/reporting.validator';

const router = Router();

/**
 * @swagger
 * /reports/definitions:
 *   get:
 *     summary: Retrieve all saved report definitions
 *     tags: [Reporting]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of saved report definitions
 */
router.get(
  '/definitions',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('reports.read'),
  reportingController.getSavedReports.bind(reportingController)
);

/**
 * @swagger
 * /reports/definitions:
 *   post:
 *     summary: Save a new report definition
 *     tags: [Reporting]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - kind
 *               - columns
 *             properties:
 *               name:
 *                 type: string
 *               kind:
 *                 type: string
 *                 enum: [Patient, Procedures]
 *               filters:
 *                 type: array
 *                 items:
 *                   type: object
 *               columns:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Report definition successfully saved
 */
router.post(
  '/definitions',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('reports.write'),
  validate(saveReportValidator),
  reportingController.saveReport.bind(reportingController)
);

/**
 * @swagger
 * /reports/definitions/{reportId}:
 *   delete:
 *     summary: Delete a saved report definition
 *     tags: [Reporting]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Report definition successfully deleted
 */
router.delete(
  '/definitions/:reportId',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('reports.write'),
  validate(reportIdParamValidator),
  reportingController.deleteReport.bind(reportingController)
);

/**
 * @swagger
 * /reports/run:
 *   post:
 *     summary: Execute a dynamic report
 *     tags: [Reporting]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - kind
 *               - columns
 *             properties:
 *               kind:
 *                 type: string
 *                 enum: [Patient, Procedures]
 *               filters:
 *                 type: array
 *                 items:
 *                   type: object
 *               columns:
 *                 type: array
 *                 items:
 *                   type: string
 *               page:
 *                 type: integer
 *               limit:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Report results successfully compiled
 */
router.post(
  '/run',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('reports.read'),
  validate(runReportValidator),
  reportingController.runReport.bind(reportingController)
);

import { dashboardMetricsController } from '../controllers/dashboard-metrics.controller';

/**
 * @swagger
 * /reports/denial-rates:
 *   get:
 *     summary: Retrieve denial rate metrics grouped by carrier
 *     tags: [Reporting]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Denial rates successfully compiled
 */
router.get(
  '/denial-rates',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('reports.read'),
  reportingController.getDenialRates.bind(reportingController)
);

/**
 * @swagger
 * /reports/dashboard/metrics:
 *   get:
 *     summary: Retrieve dashboard metrics and graph data
 *     tags: [Reporting]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Reference date for report (default today)
 *       - in: query
 *         name: range
 *         schema:
 *           type: string
 *           enum: [Daily, Weekly, Monthly, Yearly]
 *         description: Reporting period granularity (default Daily)
 *       - in: query
 *         name: providerId
 *         schema:
 *           type: string
 *         description: Filter metrics by a specific provider ID, or 'All' (default All)
 *     responses:
 *       200:
 *         description: Dashboard metrics compiled successfully
 */
router.get(
  '/dashboard/metrics',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('reports.read'),
  dashboardMetricsController.getMetrics.bind(dashboardMetricsController)
);

/**
 * @swagger
 * /reports/dashboard/goals:
 *   get:
 *     summary: Retrieve dashboard goals settings
 *     tags: [Reporting]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current dashboard goals settings
 */
router.get(
  '/dashboard/goals',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('reports.read'),
  dashboardMetricsController.getGoals.bind(dashboardMetricsController)
);

/**
 * @swagger
 * /reports/dashboard/goals:
 *   put:
 *     summary: Update dashboard goals settings
 *     tags: [Reporting]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               dentistHourlyGoal:
 *                 type: number
 *               hygienistHourlyGoal:
 *                 type: number
 *               collectionPercentGoal:
 *                 type: number
 *               newPatientsGoal:
 *                 type: number
 *               monthlyVisitsGoal:
 *                 type: number
 *               hygieneVisitsPercent:
 *                 type: number
 *               treatmentVisitsPercent:
 *                 type: number
 *               reappointmentPercentGoal:
 *                 type: number
 *               newPtCaseAcceptPercent:
 *                 type: number
 *               existingPtCaseAcceptPercent:
 *                 type: number
 *     responses:
 *       200:
 *         description: Dashboard goals updated successfully
 */
router.put(
  '/dashboard/goals',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('reports.write'),
  dashboardMetricsController.updateGoals.bind(dashboardMetricsController)
);

import { reportGenerationController } from '../controllers/report-generation.controller';

/**
 * @swagger
 * /reports/financial/{reportName}:
 *   get:
 *     summary: Retrieve financial report data by name
 *     tags: [Reporting]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reportName
 *         required: true
 *         schema:
 *           type: string
 *         description: Name of the financial report (e.g., aging, production, deposit-slips, adjustment)
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Reference date for report (default today)
 *       - in: query
 *         name: range
 *         schema:
 *           type: string
 *           enum: [Daily, Weekly, Monthly, Yearly]
 *         description: Reporting period granularity (default Daily)
 *     responses:
 *       200:
 *         description: Financial report data compiled successfully
 */
router.get(
  '/financial/:reportName',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('reports.read'),
  reportGenerationController.getFinancialReport.bind(reportGenerationController)
);

/**
 * @swagger
 * /reports/clinical/{reportName}:
 *   get:
 *     summary: Retrieve clinical report data by name
 *     tags: [Reporting]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reportName
 *         required: true
 *         schema:
 *           type: string
 *         description: Name of the clinical report (e.g., recare, unsigned-progress-notes, rx)
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Reference date for report (default today)
 *       - in: query
 *         name: range
 *         schema:
 *           type: string
 *           enum: [Daily, Weekly, Monthly, Yearly]
 *         description: Reporting period granularity (default Daily)
 *     responses:
 *       200:
 *         description: Clinical report data compiled successfully
 */
router.get(
  '/clinical/:reportName',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('reports.read'),
  reportGenerationController.getClinicalReport.bind(reportGenerationController)
);

/**
 * @swagger
 * /reports/patient/{reportName}:
 *   get:
 *     summary: Retrieve patient report data by name
 *     tags: [Reporting]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reportName
 *         required: true
 *         schema:
 *           type: string
 *         description: Name of the patient report (e.g., insurance-coverage, cancelled-appointments, duplicate-patients)
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Reference date for report (default today)
 *       - in: query
 *         name: range
 *         schema:
 *           type: string
 *           enum: [Daily, Weekly, Monthly, Yearly]
 *         description: Reporting period granularity (default Daily)
 *     responses:
 *       200:
 *         description: Patient report data compiled successfully
 */
router.get(
  '/patient/:reportName',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('reports.read'),
  reportGenerationController.getPatientReport.bind(reportGenerationController)
);

/**
 * @swagger
 * /reports/others/{reportName}:
 *   get:
 *     summary: Retrieve other system audit/login report data by name
 *     tags: [Reporting]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reportName
 *         required: true
 *         schema:
 *           type: string
 *         description: Name of the report (e.g., login, audit)
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Reference date for report (default today)
 *       - in: query
 *         name: range
 *         schema:
 *           type: string
 *           enum: [Daily, Weekly, Monthly, Yearly]
 *         description: Reporting period granularity (default Daily)
 *     responses:
 *       200:
 *         description: Other system report data compiled successfully
 */
router.get(
  '/others/:reportName',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('reports.read'),
  reportGenerationController.getOthersReport.bind(reportGenerationController)
);

router.post(
  '/archive',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('reports.write'),
  validate(archiveReportValidator),
  reportingController.archiveReport.bind(reportingController)
);

router.get(
  '/archive',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('reports.read'),
  reportingController.getArchivedReports.bind(reportingController)
);

router.get(
  '/archive/:reportId',
  authenticate,
  resolveBranchAccess,
  enterTenantContext,
  requirePermission('reports.read'),
  validate(reportIdParamValidator),
  reportingController.getArchivedReportById.bind(reportingController)
);

export default router;
