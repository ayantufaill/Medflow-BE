import { Router } from 'express';
import { formTemplateController } from '../controllers/form-template.controller';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  templateIdParamValidator,
  createFormTemplateValidator,
  updateFormTemplateValidator,
} from '../validators/form-template.validator';

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * /form-templates:
 *   get:
 *     summary: List portal form templates
 *     tags: [Form Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: includeInactive
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: List of form templates
 */
router.get('/', formTemplateController.getAllTemplates.bind(formTemplateController));

/**
 * @swagger
 * /form-templates/{templateId}:
 *   get:
 *     summary: Get a single form template by its slug
 *     tags: [Form Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Form template
 *       404:
 *         description: Template not found
 */
router.get(
  '/:templateId',
  validate(templateIdParamValidator),
  formTemplateController.getTemplateByTemplateId.bind(formTemplateController)
);

/**
 * @swagger
 * /form-templates:
 *   post:
 *     summary: Create a new form template (Admin only)
 *     tags: [Form Templates]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [templateId, name, fields]
 *             properties:
 *               templateId: { type: string, example: "new-patient-intake" }
 *               name: { type: string }
 *               description: { type: string }
 *               isActive: { type: boolean }
 *               fields:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [key, label, type]
 *                   properties:
 *                     key: { type: string }
 *                     label: { type: string }
 *                     type: { type: string, enum: [text, textarea, email, number, phone, date, boolean, select, radio] }
 *                     required: { type: boolean }
 *                     options:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           value: { type: string }
 *                           label: { type: string }
 *                     order: { type: integer }
 *     responses:
 *       201:
 *         description: Form template created
 *       409:
 *         description: templateId already exists
 */
router.post(
  '/',
  requireRoles('Admin', 'Super Admin'),
  validate(createFormTemplateValidator),
  formTemplateController.createTemplate.bind(formTemplateController)
);

/**
 * @swagger
 * /form-templates/{templateId}:
 *   put:
 *     summary: Update a form template (Admin only)
 *     tags: [Form Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Form template updated
 *       404:
 *         description: Template not found
 */
router.put(
  '/:templateId',
  requireRoles('Admin', 'Super Admin'),
  validate(updateFormTemplateValidator),
  formTemplateController.updateTemplate.bind(formTemplateController)
);

/**
 * @swagger
 * /form-templates/{templateId}/deactivate:
 *   patch:
 *     summary: Soft-disable a form template (Admin only) — past submissions still reference its templateId
 *     tags: [Form Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Form template deactivated
 *       404:
 *         description: Template not found
 */
router.patch(
  '/:templateId/deactivate',
  requireRoles('Admin', 'Super Admin'),
  validate(templateIdParamValidator),
  formTemplateController.deactivateTemplate.bind(formTemplateController)
);

export default router;
