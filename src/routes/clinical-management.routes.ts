import { Router } from 'express';
import { clinicalManagementController } from '../controllers/clinical-management.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Secure all endpoints with authentication middleware
router.use(authenticate);

// ✅ ADD THIS ROOT GET TO FIX THE 404 TEST
router.get(
  '/',
  (req, res) => {
    res.json({ success: true, message: 'Clinical management endpoint' });
  }
);

/**
 * @swagger
 * /clinical-management/products:
 *   get:
 *     summary: Retrieve active products and choices
 *     tags: [Clinical Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Products structure
 *   post:
 *     summary: Create new product category
 *     tags: [Clinical Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, section]
 *             properties:
 *               name: { type: string }
 *               section: { type: string }
 *     responses:
 *       210:
 *         description: Category created
 */
router.get('/products', clinicalManagementController.getProducts.bind(clinicalManagementController));
/**
 * @swagger
 * /clinical-management/products:
 *   post:
 *     summary: Post products
 *     tags: [Clinical Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */

router.post('/products', clinicalManagementController.createProductCategory.bind(clinicalManagementController));

/**
 * @swagger
 * /clinical-management/products/{categoryId}/choices:
 *   post:
 *     summary: Add product choice to category
 *     tags: [Clinical Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               isDefault: { type: boolean }
 *               quickList: { type: boolean }
 *               isRecommended: { type: boolean }
 *               price: { type: number }
 *               code: { type: string }
 *     responses:
 *       201:
 *         description: Choice created
 */
router.post('/products/:categoryId/choices', clinicalManagementController.createProductChoice.bind(clinicalManagementController));

/**
 * @swagger
 * /clinical-management/products/choices/{choiceId}:
 *   put:
 *     summary: Update product choice configuration
 *     tags: [Clinical Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: choiceId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               isDefault: { type: boolean }
 *               quickList: { type: boolean }
 *               isRecommended: { type: boolean }
 *               price: { type: number }
 *               code: { type: string }
 *     responses:
 *       200:
 *         description: Choice updated
 */
router.put('/products/choices/:choiceId', clinicalManagementController.updateProductChoice.bind(clinicalManagementController));

/**
 * @swagger
 * /clinical-management/products/{categoryId}:
 *   delete:
 *     summary: Deactivate product category
 *     tags: [Clinical Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Category deactivated
 */
router.delete('/products/:categoryId', clinicalManagementController.deactivateProductCategory.bind(clinicalManagementController));

/**
 * @swagger
 * /clinical-management/products/choices/{choiceId}:
 *   delete:
 *     summary: Deactivate product choice
 *     tags: [Clinical Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: choiceId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Choice deactivated
 */
router.delete('/products/choices/:choiceId', clinicalManagementController.deactivateProductChoice.bind(clinicalManagementController));

// Checklists
/**
 * @swagger
 * /clinical-management/checklists:
 *   get:
 *     summary: Retrieve checklist categories and checklists
 *     tags: [Clinical Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Checklists configuration
 */
router.get('/checklists', clinicalManagementController.getChecklists.bind(clinicalManagementController));

/**
 * @swagger
 * /clinical-management/checklists/categories:
 *   post:
 *     summary: Create new checklist category
 *     tags: [Clinical Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *     responses:
 *       201:
 *         description: Category created
 */
router.post('/checklists/categories', clinicalManagementController.createChecklistCategory.bind(clinicalManagementController));

/**
 * @swagger
 * /clinical-management/checklists:
 *   post:
 *     summary: Create checklist template
 *     tags: [Clinical Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [categoryName, name, shortName]
 *             properties:
 *               categoryName: { type: string }
 *               name: { type: string }
 *               shortName: { type: string }
 *               isTreatment: { type: boolean }
 *               isHygiene: { type: boolean }
 *               iconId: { type: string }
 *     responses:
 *       201:
 *         description: Checklist created
 */
router.post('/checklists', clinicalManagementController.createChecklist.bind(clinicalManagementController));

/**
 * @swagger
 * /clinical-management/checklists/{checklistId}/items:
 *   post:
 *     summary: Add item to checklist
 *     tags: [Clinical Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: checklistId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [text]
 *             properties:
 *               text: { type: string }
 *               choices: { type: array, items: { type: string } }
 *               products: { type: array, items: { type: string } }
 *     responses:
 *       201:
 *         description: Checklist item created
 */
router.post('/checklists/:checklistId/items', clinicalManagementController.createChecklistItem.bind(clinicalManagementController));

/**
 * @swagger
 * /clinical-management/checklists/items/{itemId}/choice:
 *   post:
 *     summary: Add choice option to checklist item
 *     tags: [Clinical Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *     responses:
 *       200:
 *         description: Choice added successfully
 */
router.post('/checklists/items/:itemId/choice', clinicalManagementController.addChoiceToChecklistItem.bind(clinicalManagementController));

/**
 * @swagger
 * /clinical-management/checklists/items/{itemId}/product:
 *   post:
 *     summary: Add product reference to checklist item
 *     tags: [Clinical Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *     responses:
 *       200:
 *         description: Product added successfully
 */
router.post('/checklists/items/:itemId/product', clinicalManagementController.addProductToChecklistItem.bind(clinicalManagementController));

/**
 * @swagger
 * /clinical-management/checklists/{checklistId}:
 *   put:
 *     summary: Update checklist configuration
 *     tags: [Clinical Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: checklistId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               shortName: { type: string }
 *               isTreatment: { type: boolean }
 *               isHygiene: { type: boolean }
 *               iconId: { type: string }
 *     responses:
 *       200:
 *         description: Checklist updated
 *   delete:
 *     summary: Delete checklist
 *     tags: [Clinical Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: checklistId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Checklist deleted
 */
router.put('/checklists/:checklistId', clinicalManagementController.updateChecklist.bind(clinicalManagementController));
/**
 * @swagger
 * /clinical-management/checklists/{checklistId}:
 *   delete:
 *     summary: Delete checklists :checklistId
 *     tags: [Clinical Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: checklistId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */

router.delete('/checklists/:checklistId', clinicalManagementController.deleteChecklist.bind(clinicalManagementController));

/**
 * @swagger
 * /clinical-management/checklists/items/{itemId}:
 *   delete:
 *     summary: Delete checklist item
 *     tags: [Clinical Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Item deleted
 */
router.delete('/checklists/items/:itemId', clinicalManagementController.deleteChecklistItem.bind(clinicalManagementController));

// Prescription Templates
/**
 * @swagger
 * /clinical-management/prescription-templates:
 *   get:
 *     summary: Get prescription templates
 *     tags: [Clinical Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Templates list
 *   post:
 *     summary: Create prescription template
 *     tags: [Clinical Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, drug, sig, disp, refills]
 *             properties:
 *               name: { type: string }
 *               drug: { type: string }
 *               sig: { type: string }
 *               disp: { type: string }
 *               refills: { type: string }
 *     responses:
 *       201:
 *         description: Template created
 */
router.get('/prescription-templates', clinicalManagementController.getPrescriptionTemplates.bind(clinicalManagementController));
/**
 * @swagger
 * /clinical-management/prescription-templates:
 *   post:
 *     summary: Post prescription-templates
 *     tags: [Clinical Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */

router.post('/prescription-templates', clinicalManagementController.createPrescriptionTemplate.bind(clinicalManagementController));

/**
 * @swagger
 * /clinical-management/prescription-templates/{templateId}:
 *   put:
 *     summary: Update prescription template
 *     tags: [Clinical Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               drug: { type: string }
 *               sig: { type: string }
 *               disp: { type: string }
 *               refills: { type: string }
 *     responses:
 *       200:
 *         description: Template updated
 *   delete:
 *     summary: Delete prescription template
 *     tags: [Clinical Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Template deleted
 */
router.put('/prescription-templates/:templateId', clinicalManagementController.updatePrescriptionTemplate.bind(clinicalManagementController));
/**
 * @swagger
 * /clinical-management/prescription-templates/{templateId}:
 *   delete:
 *     summary: Delete prescription-templates :templateId
 *     tags: [Clinical Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */

router.delete('/prescription-templates/:templateId', clinicalManagementController.deletePrescriptionTemplate.bind(clinicalManagementController));

// System Settings
/**
 * @swagger
 * /clinical-management/settings:
 *   get:
 *     summary: Get clinical settings
 *     tags: [Clinical Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Key-value settings map
 *   put:
 *     summary: Update a clinical setting
 *     tags: [Clinical Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [key, value]
 *             properties:
 *               key: { type: string }
 *               value: { type: string }
 *     responses:
 *       200:
 *         description: Setting updated
 */
router.get('/settings', clinicalManagementController.getSystemSettings.bind(clinicalManagementController));
/**
 * @swagger
 * /clinical-management/settings:
 *   put:
 *     summary: Put settings
 *     tags: [Clinical Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */

router.put('/settings', clinicalManagementController.updateSystemSetting.bind(clinicalManagementController));

// Recare Config
/**
 * @swagger
 * /clinical-management/recare-config:
 *   get:
 *     summary: Get recare schedule config
 *     tags: [Clinical Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Configuration parameters
 *   put:
 *     summary: Save/Update recare schedule config
 *     tags: [Clinical Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               intervalMonths: { type: integer }
 *               autoReminder: { type: boolean }
 *     responses:
 *       200:
 *         description: Config updated
 */
router.get('/recare-config', clinicalManagementController.getRecareConfig.bind(clinicalManagementController));
/**
 * @swagger
 * /clinical-management/recare-config:
 *   put:
 *     summary: Put recare-config
 *     tags: [Clinical Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */

router.put('/recare-config', clinicalManagementController.updateRecareConfig.bind(clinicalManagementController));

// Treatment Plan Presentation Config
/**
 * @swagger
 * /clinical-management/treatment-plan-presentations:
 *   get:
 *     summary: Get treatment plan presentation display configuration
 *     tags: [Clinical Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Configuration parameters
 *   put:
 *     summary: Save/Update treatment plan presentation configuration
 *     tags: [Clinical Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               showHeader: { type: boolean }
 *               showFooter: { type: boolean }
 *               themeColor: { type: string }
 *     responses:
 *       200:
 *         description: Config updated
 */
router.get('/treatment-plan-presentations', clinicalManagementController.getTreatmentPlanPresentationConfig.bind(clinicalManagementController));
/**
 * @swagger
 * /clinical-management/treatment-plan-presentations:
 *   put:
 *     summary: Put treatment-plan-presentations
 *     tags: [Clinical Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */

router.put('/treatment-plan-presentations', clinicalManagementController.updateTreatmentPlanPresentationConfig.bind(clinicalManagementController));

// Informed Consent Templates
/**
 * @swagger
 * /clinical-management/consent-templates:
 *   get:
 *     summary: Get informed consent templates
 *     tags: [Clinical Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Consents list
 *   post:
 *     summary: Create informed consent template
 *     tags: [Clinical Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, content]
 *             properties:
 *               name: { type: string }
 *               content: { type: string }
 *     responses:
 *       201:
 *         description: Consent template created
 */
router.get('/consent-templates', clinicalManagementController.getInformedConsents.bind(clinicalManagementController));
/**
 * @swagger
 * /clinical-management/consent-templates:
 *   post:
 *     summary: Post consent-templates
 *     tags: [Clinical Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */

router.post('/consent-templates', clinicalManagementController.createInformedConsent.bind(clinicalManagementController));

/**
 * @swagger
 * /clinical-management/consent-templates/{templateId}:
 *   put:
 *     summary: Update informed consent template
 *     tags: [Clinical Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               content: { type: string }
 *     responses:
 *       200:
 *         description: Consent template updated
 *   delete:
 *     summary: Delete informed consent template
 *     tags: [Clinical Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Consent template deleted
 */
router.put('/consent-templates/:templateId', clinicalManagementController.updateInformedConsent.bind(clinicalManagementController));
/**
 * @swagger
 * /clinical-management/consent-templates/{templateId}:
 *   delete:
 *     summary: Delete consent-templates :templateId
 *     tags: [Clinical Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */

router.delete('/consent-templates/:templateId', clinicalManagementController.deleteInformedConsent.bind(clinicalManagementController));

// Pre & Post-Ops Instruction Templates
/**
 * @swagger
 * /clinical-management/instruction-templates:
 *   get:
 *     summary: Get pre/post-op care templates
 *     tags: [Clinical Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Instruction list
 *   post:
 *     summary: Create pre/post-op template
 *     tags: [Clinical Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, type, content]
 *             properties:
 *               name: { type: string }
 *               type: { type: string }
 *               content: { type: string }
 *     responses:
 *       210:
 *         description: Template created
 */
router.get('/instruction-templates', clinicalManagementController.getPrePostOps.bind(clinicalManagementController));
/**
 * @swagger
 * /clinical-management/instruction-templates:
 *   post:
 *     summary: Post instruction-templates
 *     tags: [Clinical Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */

router.post('/instruction-templates', clinicalManagementController.createPrePostOp.bind(clinicalManagementController));

/**
 * @swagger
 * /clinical-management/instruction-templates/{templateId}:
 *   put:
 *     summary: Update pre/post-op template
 *     tags: [Clinical Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               type: { type: string }
 *               content: { type: string }
 *     responses:
 *       200:
 *         description: Template updated
 *   delete:
 *     summary: Delete instruction template
 *     tags: [Clinical Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Template deleted
 */
router.put('/instruction-templates/:templateId', clinicalManagementController.updatePrePostOp.bind(clinicalManagementController));
/**
 * @swagger
 * /clinical-management/instruction-templates/{templateId}:
 *   delete:
 *     summary: Delete instruction-templates :templateId
 *     tags: [Clinical Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */

router.delete('/instruction-templates/:templateId', clinicalManagementController.deletePrePostOp.bind(clinicalManagementController));

export default router;