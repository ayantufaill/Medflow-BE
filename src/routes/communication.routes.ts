import { Router } from 'express';
import { param } from 'express-validator';
import { communicationController } from '../controllers/communication.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  updateSettingsValidator,
  templateValidator,
  templateIdParamValidator,
  campaignValidator,
  campaignIdParamValidator,
  questionnaireValidator,
  questionnaireIdParamValidator,
  gapFillValidator,
  gapFillSettingsValidator,
  updateReviewSettingsValidator,
} from '../validators/communication.validator';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /communication/settings:
 *   get:
 *     summary: Get general communication settings
 *     tags: [Communication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Communication settings
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/settings',
  requirePermission('settings.read'),
  communicationController.getSettings.bind(communicationController)
);

/**
 * @swagger
 * /communication/settings:
 *   put:
 *     summary: Update general communication settings
 *     tags: [Communication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               skippedDays:
 *                 type: array
 *                 items: { type: string }
 *               emailConfig:
 *                 type: object
 *               textConfig:
 *                 type: object
 *               reminders:
 *                 type: array
 *               socialLinks:
 *                 type: object
 *               mapCoords:
 *                 type: object
 *     responses:
 *       200:
 *         description: Settings updated
 *       400:
 *         description: Invalid input
 */
router.put(
  '/settings',
  requirePermission('settings.update'),
  validate(updateSettingsValidator),
  communicationController.updateSettings.bind(communicationController)
);

/**
 * @swagger
 * /communication/templates:
 *   get:
 *     summary: Get all communication templates
 *     tags: [Communication]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema: { type: integer }
 *         description: Optional template category type (1-5)
 *     responses:
 *       200:
 *         description: List of templates
 */
router.get(
  '/templates',
  requirePermission('settings.read'),
  communicationController.getTemplates.bind(communicationController)
);

/**
 * @swagger
 * /communication/templates/{id}:
 *   get:
 *     summary: Get template by ID
 *     tags: [Communication]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Template details
 *       404:
 *         description: Template not found
 */
router.get(
  '/templates/:id',
  requirePermission('settings.read'),
  validate(templateIdParamValidator),
  communicationController.getTemplateById.bind(communicationController)
);

/**
 * @swagger
 * /communication/templates:
 *   post:
 *     summary: Create a new template
 *     tags: [Communication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - description
 *               - bodyText
 *               - templateType
 *             properties:
 *               description: { type: string }
 *               subject: { type: string }
 *               bodyText: { type: string }
 *               templateType: { type: integer, minimum: 1, maximum: 5 }
 *     responses:
 *       201:
 *         description: Template created
 */
router.post(
  '/templates',
  requirePermission('settings.update'),
  validate(templateValidator),
  communicationController.createTemplate.bind(communicationController)
);

/**
 * @swagger
 * /communication/templates/{id}:
 *   put:
 *     summary: Update template
 *     tags: [Communication]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               description: { type: string }
 *               subject: { type: string }
 *               bodyText: { type: string }
 *               templateType: { type: integer }
 *     responses:
 *       200:
 *         description: Template updated
 */
router.put(
  '/templates/:id',
  requirePermission('settings.update'),
  validate([...templateIdParamValidator, ...templateValidator]),
  communicationController.updateTemplate.bind(communicationController)
);

/**
 * @swagger
 * /communication/templates/{id}:
 *   delete:
 *     summary: Delete template
 *     tags: [Communication]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Template deleted
 */
router.delete(
  '/templates/:id',
  requirePermission('settings.update'),
  validate(templateIdParamValidator),
  communicationController.deleteTemplate.bind(communicationController)
);

/**
 * @swagger
 * /communication/campaigns:
 *   get:
 *     summary: Get all campaigns (paginated)
 *     tags: [Communication]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: List of campaigns
 */
router.get(
  '/campaigns',
  requirePermission('settings.read'),
  communicationController.getCampaigns.bind(communicationController)
);

/**
 * @swagger
 * /communication/campaigns/metrics:
 *   get:
 *     summary: Get overall campaigns metrics
 *     tags: [Communication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Campaigns metrics summary
 */
router.get(
  '/campaigns/metrics',
  requirePermission('settings.read'),
  communicationController.getCampaignMetrics.bind(communicationController)
);

/**
 * @swagger
 * /communication/campaigns/{id}:
 *   get:
 *     summary: Get campaign by ID
 *     tags: [Communication]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Campaign details
 */
router.get(
  '/campaigns/:id',
  requirePermission('settings.read'),
  validate(campaignIdParamValidator),
  communicationController.getCampaignById.bind(communicationController)
);

/**
 * @swagger
 * /communication/campaigns:
 *   post:
 *     summary: Create email campaign (Draft or Sent)
 *     tags: [Communication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - subject
 *               - body
 *               - status
 *             properties:
 *               subject: { type: string }
 *               body: { type: string }
 *               status: { type: string, enum: [Draft, Sent] }
 *               targetAudienceId: { type: string }
 *     responses:
 *       201:
 *         description: Campaign created
 */
router.post(
  '/campaigns',
  requirePermission('settings.update'),
  validate(campaignValidator),
  communicationController.createCampaign.bind(communicationController)
);

/**
 * @swagger
 * /communication/campaigns/{id}:
 *   put:
 *     summary: Update campaign
 *     tags: [Communication]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               subject: { type: string }
 *               body: { type: string }
 *               status: { type: string }
 *               targetAudienceId: { type: string }
 *     responses:
 *       200:
 *         description: Campaign updated
 */
router.put(
  '/campaigns/:id',
  requirePermission('settings.update'),
  validate([...campaignIdParamValidator, ...campaignValidator]),
  communicationController.updateCampaign.bind(communicationController)
);

/**
 * @swagger
 * /communication/campaigns/{id}:
 *   delete:
 *     summary: Delete campaign
 *     tags: [Communication]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Campaign deleted
 */
router.delete(
  '/campaigns/:id',
  requirePermission('settings.update'),
  validate(campaignIdParamValidator),
  communicationController.deleteCampaign.bind(communicationController)
);

/**
 * @swagger
 * /communication/questionnaires:
 *   get:
 *     summary: Get all custom and system questionnaires
 *     tags: [Communication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Custom and system questionnaires
 */
router.get(
  '/questionnaires',
  requirePermission('settings.read'),
  communicationController.getQuestionnaires.bind(communicationController)
);

/**
 * @swagger
 * /communication/questionnaires/{id}:
 *   get:
 *     summary: Get questionnaire details (and questions)
 *     tags: [Communication]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Questionnaire details and questions
 */
router.get(
  '/questionnaires/:id',
  requirePermission('settings.read'),
  communicationController.getQuestionnaireById.bind(communicationController)
);

/**
 * @swagger
 * /communication/questionnaires:
 *   post:
 *     summary: Create new custom questionnaire
 *     tags: [Communication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - description
 *             properties:
 *               description: { type: string }
 *               questions:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - name
 *                     - type
 *                   properties:
 *                     name: { type: string }
 *                     type: { type: string }
 *                     choices: { type: array, items: { type: string } }
 *     responses:
 *       201:
 *         description: Questionnaire created
 */
router.post(
  '/questionnaires',
  requirePermission('settings.update'),
  validate(questionnaireValidator),
  communicationController.createQuestionnaire.bind(communicationController)
);

/**
 * @swagger
 * /communication/questionnaires/{id}:
 *   put:
 *     summary: Update questionnaire
 *     tags: [Communication]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               description: { type: string }
 *               questions:
 *                 type: array
 *     responses:
 *       200:
 *         description: Questionnaire updated
 */
router.put(
  '/questionnaires/:id',
  requirePermission('settings.update'),
  validate([param('id').isInt({ min: 1 }), ...questionnaireValidator]),
  communicationController.updateQuestionnaire.bind(communicationController)
);

/**
 * @swagger
 * /communication/questionnaires/{id}:
 *   delete:
 *     summary: Delete questionnaire
 *     tags: [Communication]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Questionnaire deleted
 */
router.delete(
  '/questionnaires/:id',
  requirePermission('settings.update'),
  validate([param('id').isInt({ min: 1 })]),
  communicationController.deleteQuestionnaire.bind(communicationController)
);

/**
 * @swagger
 * /communication/gap-fills:
 *   get:
 *     summary: Get all gap fills configurations
 *     tags: [Communication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Gap fill configurations list
 */
router.get(
  '/gap-fills',
  requirePermission('settings.read'),
  communicationController.getGapFills.bind(communicationController)
);

/**
 * @swagger
 * /communication/gap-fills/settings:
 *   get:
 *     summary: Get gap fills settings
 *     tags: [Communication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Gap fill settings
 */
router.get(
  '/gap-fills/settings',
  requirePermission('settings.read'),
  communicationController.getGapFillSettings.bind(communicationController)
);

/**
 * @swagger
 * /communication/gap-fills/settings:
 *   post:
 *     summary: Create/Update gap fills settings
 *     tags: [Communication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               unscheduledNotificationEnabled: { type: boolean }
 *               showBookNow: { type: boolean }
 *               skipDays: { type: number }
 *     responses:
 *       200:
 *         description: Gap fill settings saved
 */
router.post(
  '/gap-fills/settings',
  requirePermission('settings.update'),
  validate(gapFillSettingsValidator),
  communicationController.saveGapFillSettings.bind(communicationController)
);

/**
 * @swagger
 * /communication/gap-fills:
 *   post:
 *     summary: Create/Update gap fill configuration
 *     tags: [Communication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - triggerType
 *               - templateId
 *               - isActive
 *               - scheduleOffsetDays
 *               - maxOffers
 *             properties:
 *               id: { type: string }
 *               triggerType: { type: string }
 *               templateId: { type: string }
 *               isActive: { type: boolean }
 *               scheduleOffsetDays: { type: integer }
 *               maxOffers: { type: integer }
 *     responses:
 *       200:
 *         description: Gap fill configuration saved
 */
router.post(
  '/gap-fills',
  requirePermission('settings.update'),
  validate(gapFillValidator),
  communicationController.saveGapFill.bind(communicationController)
);

/**
 * @swagger
 * /communication/gap-fills/{id}:
 *   delete:
 *     summary: Delete gap fill configuration
 *     tags: [Communication]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Gap fill configuration deleted
 */
router.delete(
  '/gap-fills/:id',
  requirePermission('settings.update'),
  communicationController.deleteGapFill.bind(communicationController)
);

/**
 * @swagger
 * /communication/reviews/settings:
 *   get:
 *     summary: Get review settings
 *     tags: [Communication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Review settings
 */
router.get(
  '/reviews/settings',
  requirePermission('settings.read'),
  communicationController.getReviewSettings.bind(communicationController)
);

/**
 * @swagger
 * /communication/reviews/settings:
 *   put:
 *     summary: Update review settings
 *     tags: [Communication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - isActive
 *               - sendDelayHours
 *               - channels
 *               - customMessageText
 *             properties:
 *               isActive: { type: boolean }
 *               sendDelayHours: { type: integer }
 *               channels:
 *                 type: array
 *                 items: { type: string }
 *               googleReviewUrl: { type: string }
 *               facebookReviewUrl: { type: string }
 *               customMessageText: { type: string }
 *     responses:
 *       200:
 *         description: Review settings updated
 */
router.put(
  '/reviews/settings',
  requirePermission('settings.update'),
  validate(updateReviewSettingsValidator),
  communicationController.updateReviewSettings.bind(communicationController)
);

export default router;
