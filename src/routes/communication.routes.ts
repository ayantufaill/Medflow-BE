import { Router } from 'express';
import { param } from 'express-validator';
import { communicationController } from '../controllers/communication.controller';
import { authenticate } from '../middleware/auth.middleware';
import { resolveBranchAccess } from '../middleware/branchAccess.middleware';
import { enterTenantContext } from '../middleware/tenantContext.middleware';
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
  bulkTextValidator,
  bulkEmailValidator,
  emailDomainValidator,
  emailPreferencesValidator,
  messagingPracticeDetailsValidator,
  messagingNumberSearchValidator,
  messagingNumberSelectValidator,
  automationListValidator,
  automationCreateValidator,
  automationUpdateValidator,
  automationActiveValidator,
  automationIdParamValidator,
} from '../validators/communication.validator';

const router = Router();

// All routes require authentication
router.use(authenticate);
router.use(resolveBranchAccess);
router.use(enterTenantContext);

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
 * /communication/email-domain:
 *   get:
 *     summary: Get the practice's email sending domain, its DNS records and verification status
 *     tags: [Communication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Email domain state (status is "not_configured" when no domain is set)
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/email-domain',
  requirePermission('settings.read'),
  communicationController.getEmailDomain.bind(communicationController)
);

/**
 * @swagger
 * /communication/email-domain:
 *   put:
 *     summary: Set or change the email sending domain and generate new DNS records
 *     tags: [Communication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [domain]
 *             properties:
 *               domain:
 *                 type: string
 *                 example: yourpractice.com
 *     responses:
 *       200:
 *         description: Domain saved with status "pending" and fresh DNS records
 *       400:
 *         description: Invalid domain, or the domain is already the current one
 */
router.put(
  '/email-domain',
  requirePermission('settings.update'),
  validate(emailDomainValidator),
  communicationController.setEmailDomain.bind(communicationController)
);

/**
 * @swagger
 * /communication/email-domain/verify:
 *   post:
 *     summary: Check the domain's DNS records against live DNS and update the verification status
 *     tags: [Communication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Updated state; each record carries "found" and status is verified, pending or failed
 *       400:
 *         description: No email domain has been set up yet
 */
router.post(
  '/email-domain/verify',
  requirePermission('settings.update'),
  communicationController.verifyEmailDomain.bind(communicationController)
);

/**
 * @swagger
 * /communication/email-preferences:
 *   get:
 *     summary: Get the 'Sent From' and 'Reply To' addresses for patient emails
 *     tags: [Communication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Saved addresses, or defaults derived from the email domain and practice email
 *   put:
 *     summary: Update the 'Sent From' and 'Reply To' addresses
 *     tags: [Communication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sentFromEmail, replyToEmail]
 *             properties:
 *               sentFromEmail: { type: string, example: noreply@yourpractice.com }
 *               replyToEmail: { type: string, example: info@yourpractice.com }
 *     responses:
 *       200:
 *         description: Preferences saved
 *       400:
 *         description: Invalid email, or 'Sent From' does not use the verified email domain
 */
router.get(
  '/email-preferences',
  requirePermission('settings.read'),
  communicationController.getEmailPreferences.bind(communicationController)
);

router.put(
  '/email-preferences',
  requirePermission('settings.update'),
  validate(emailPreferencesValidator),
  communicationController.updateEmailPreferences.bind(communicationController)
);

/**
 * @swagger
 * /communication/messaging-service:
 *   get:
 *     summary: Get the practice's two-way SMS number and its status (active, pending or inactive)
 *     tags: [Communication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Messaging service state
 */
router.get(
  '/messaging-service',
  requirePermission('settings.read'),
  communicationController.getMessagingService.bind(communicationController)
);

/**
 * @swagger
 * /communication/messaging-service/practice-details:
 *   get:
 *     summary: Number Selection step 1 - business details carriers register the number against
 *     tags: [Communication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Saved details, or defaults from Practice Info. Only the EIN's last 4 digits are returned.
 *   put:
 *     summary: Confirm practice details for number registration
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
 *               legalBusinessName: { type: string }
 *               doingBusinessAs: { type: string }
 *               ein: { type: string, description: Full EIN, only when changing it. Only the last 4 digits are stored. }
 *               businessType: { type: string, example: Limited liability company }
 *               phoneNumber: { type: string, example: "2015006314" }
 *               website: { type: string }
 *               address: { type: string }
 *               address2: { type: string }
 *               city: { type: string }
 *               state: { type: string, example: NJ }
 *               zip: { type: string, example: 07446-1926 }
 *     responses:
 *       200:
 *         description: Details saved
 *       400:
 *         description: Per-field errors in error.details.fields
 */
router.get(
  '/messaging-service/practice-details',
  requirePermission('settings.read'),
  communicationController.getMessagingPracticeDetails.bind(communicationController)
);

router.put(
  '/messaging-service/practice-details',
  requirePermission('settings.update'),
  validate(messagingPracticeDetailsValidator),
  communicationController.updateMessagingPracticeDetails.bind(communicationController)
);

/**
 * @swagger
 * /communication/messaging-service/available-numbers:
 *   get:
 *     summary: Number Selection step 2 - SMS-capable numbers available in an area code
 *     tags: [Communication]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: areaCode
 *         required: true
 *         schema: { type: string, example: "201" }
 *     responses:
 *       200:
 *         description: List of 10-digit numbers (Twilio inventory when configured)
 *       400:
 *         description: Invalid area code
 */
router.get(
  '/messaging-service/available-numbers',
  requirePermission('settings.read'),
  validate(messagingNumberSearchValidator),
  communicationController.searchMessagingNumbers.bind(communicationController)
);

/**
 * @swagger
 * /communication/messaging-service/number:
 *   post:
 *     summary: Select a messaging number (saved as pending carrier registration; not purchased)
 *     tags: [Communication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phoneNumber]
 *             properties:
 *               phoneNumber: { type: string, example: "2015550142" }
 *     responses:
 *       200:
 *         description: Messaging service with status "pending"
 *       400:
 *         description: Invalid number, practice details not confirmed, or already the current number
 */
router.post(
  '/messaging-service/number',
  requirePermission('settings.update'),
  validate(messagingNumberSelectValidator),
  communicationController.selectMessagingNumber.bind(communicationController)
);

/**
 * @swagger
 * components:
 *   schemas:
 *     AutomationTiming:
 *       oneOf:
 *         - type: object
 *           required: [type, event]
 *           properties:
 *             type: { type: string, enum: [event] }
 *             event: { type: string, example: When Appointment Created }
 *         - type: object
 *           required: [type, amount, unit, direction, anchor]
 *           properties:
 *             type: { type: string, enum: [offset] }
 *             amount: { type: integer, minimum: 1, maximum: 365, example: 7 }
 *             unit: { type: string, enum: [Hours, Days, Weeks] }
 *             direction: { type: string, enum: [Before, After] }
 *             anchor: { type: string, example: Confirmed Appointment }
 *     AutomationInput:
 *       type: object
 *       required: [timing, channel, body]
 *       properties:
 *         timing: { $ref: '#/components/schemas/AutomationTiming' }
 *         channel: { type: string, enum: [Preferred, SMS, Email, "Email, SMS"] }
 *         subject: { type: string, description: Email subject (ignored for SMS) }
 *         body: { type: string, maxLength: 1000, example: "Hi {Patient: First Name}, see you tomorrow at {Appointment: Time}." }
 */

/**
 * @swagger
 * /communication/automations:
 *   get:
 *     summary: List a category's automated messages with overview counts
 *     description: The first call seeds starter messages for every category.
 *     tags: [Communication]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         required: true
 *         schema:
 *           type: string
 *           enum: [pre-appointment, post-appointment, recall-reminders, incomplete-forms, payment-reminders]
 *     responses:
 *       200:
 *         description: "{ category, messages, overview: { actions, totalSent, recipients } }"
 *       400:
 *         description: Unknown category
 *   post:
 *     summary: Create an automated message in a category
 *     tags: [Communication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/AutomationInput'
 *               - type: object
 *                 required: [category]
 *                 properties:
 *                   category: { type: string, example: recall-reminders }
 *     responses:
 *       201:
 *         description: Created message (active)
 *       400:
 *         description: Timing not valid for the category, bad channel, or empty message
 */
router.get(
  '/automations',
  requirePermission('settings.read'),
  validate(automationListValidator),
  communicationController.getAutomations.bind(communicationController)
);

router.post(
  '/automations',
  requirePermission('settings.update'),
  validate(automationCreateValidator),
  communicationController.createAutomation.bind(communicationController)
);

/**
 * @swagger
 * /communication/automations/{id}:
 *   put:
 *     summary: Update an automated message's timing, channel and content
 *     tags: [Communication]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/AutomationInput' }
 *     responses:
 *       200:
 *         description: Updated message
 *       400:
 *         description: Invalid input for the message's category
 *       404:
 *         description: Message not found
 *   delete:
 *     summary: Delete an automated message
 *     tags: [Communication]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Deleted
 *       404:
 *         description: Message not found
 */
router.put(
  '/automations/:id',
  requirePermission('settings.update'),
  validate(automationUpdateValidator),
  communicationController.updateAutomation.bind(communicationController)
);

router.delete(
  '/automations/:id',
  requirePermission('settings.update'),
  validate(automationIdParamValidator),
  communicationController.deleteAutomation.bind(communicationController)
);

/**
 * @swagger
 * /communication/automations/{id}/active:
 *   patch:
 *     summary: Turn an automated message on or off
 *     tags: [Communication]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [active]
 *             properties:
 *               active: { type: boolean }
 *     responses:
 *       200:
 *         description: Updated message
 *       404:
 *         description: Message not found
 */
router.patch(
  '/automations/:id/active',
  requirePermission('settings.update'),
  validate(automationActiveValidator),
  communicationController.setAutomationActive.bind(communicationController)
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

/**
 * @swagger
 * /communication/bulk-text:
 *   post:
 *     summary: Send bulk SMS to multiple patients
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
 *               - patientIds
 *               - message
 *             properties:
 *               patientIds:
 *                 type: array
 *                 items: { type: string }
 *               message: { type: string }
 *     responses:
 *       200:
 *         description: Bulk texts sent
 *       400:
 *         description: Invalid input
 */
router.post(
  '/bulk-text',
  requirePermission('settings.update'),
  validate(bulkTextValidator),
  communicationController.sendBulkText.bind(communicationController)
);

/**
 * @swagger
 * /communication/bulk-email:
 *   post:
 *     summary: Send bulk email to multiple patients
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
 *               - patientIds
 *               - subject
 *               - message
 *             properties:
 *               patientIds:
 *                 type: array
 *                 items: { type: string }
 *               subject: { type: string }
 *               message: { type: string }
 *     responses:
 *       200:
 *         description: Bulk email dispatch initiated
 *       400:
 *         description: Invalid input
 */
router.post(
  '/bulk-email',
  requirePermission('settings.update'),
  validate(bulkEmailValidator),
  communicationController.sendBulkEmail.bind(communicationController)
);

export default router;
