import { Router } from 'express';
import { adminFinanceController } from '../controllers/admin-finance.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  categoryParamValidator,
  defNumParamValidator,
  keyParamValidator,
  createDefinitionValidator,
  updateDefinitionValidator,
} from '../validators/admin-finance.validator';

const router = Router();

// Secure all endpoints with authentication middleware
router.use(authenticate);

/**
 * @swagger
 * /admin-finance/definitions/{category}:
 *   get:
 *     summary: Retrieve active definitions for a category (e.g. 1 for Adjustments, 4 for Payment Types)
 *     tags: [Admin Finance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: category
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: List of definitions
 *   post:
 *     summary: Create new definition for a category
 *     tags: [Admin Finance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: category
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               value: { type: string }
 *               itemOrder: { type: integer }
 *     responses:
 *       201:
 *         description: Definition created
 */
router.get(
  '/definitions/:category',
  validate(categoryParamValidator),
  adminFinanceController.getDefinitions.bind(adminFinanceController)
);
router.post(
  '/definitions/:category',
  validate([...categoryParamValidator, ...createDefinitionValidator]),
  adminFinanceController.createDefinition.bind(adminFinanceController)
);

/**
 * @swagger
 * /admin-finance/definitions/item/{defNum}:
 *   put:
 *     summary: Update an existing definition item
 *     tags: [Admin Finance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: defNum
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
 *               value: { type: string }
 *               isHidden: { type: boolean }
 *               itemOrder: { type: integer }
 *     responses:
 *       200:
 *         description: Definition updated
 *   delete:
 *     summary: Soft delete/hide a definition item
 *     tags: [Admin Finance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: defNum
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Definition deleted
 */
router.put(
  '/definitions/item/:defNum',
  validate([...defNumParamValidator, ...updateDefinitionValidator]),
  adminFinanceController.updateDefinition.bind(adminFinanceController)
);
router.delete(
  '/definitions/item/:defNum',
  validate(defNumParamValidator),
  adminFinanceController.deleteDefinition.bind(adminFinanceController)
);

/**
 * @swagger
 * /admin-finance/settings/{key}:
 *   get:
 *     summary: Fetch serialized JSON setting by key
 *     tags: [Admin Finance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Settings object
 *   put:
 *     summary: Save/upsert serialized JSON setting by key
 *     tags: [Admin Finance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Settings saved
 */
router.get(
  '/settings/:key',
  validate(keyParamValidator),
  adminFinanceController.getSetting.bind(adminFinanceController)
);
router.put(
  '/settings/:key',
  validate(keyParamValidator),
  adminFinanceController.saveSetting.bind(adminFinanceController)
);

// Statement Forms Layouts
router.get(
  '/statement-forms',
  adminFinanceController.getStatementForms.bind(adminFinanceController)
);
router.post(
  '/statement-forms',
  adminFinanceController.createStatementForm.bind(adminFinanceController)
);
router.put(
  '/statement-forms/:id',
  adminFinanceController.updateStatementForm.bind(adminFinanceController)
);
router.delete(
  '/statement-forms/:id',
  adminFinanceController.deleteStatementForm.bind(adminFinanceController)
);

// Coverage Book Shortcuts
router.get(
  '/coverage-book-shortcuts',
  adminFinanceController.getCoverageBookShortcuts.bind(adminFinanceController)
);
router.post(
  '/coverage-book-shortcuts',
  adminFinanceController.createCoverageBookShortcut.bind(adminFinanceController)
);
router.put(
  '/coverage-book-shortcuts/:id',
  adminFinanceController.updateCoverageBookShortcut.bind(adminFinanceController)
);
router.delete(
  '/coverage-book-shortcuts/:id',
  adminFinanceController.deleteCoverageBookShortcut.bind(adminFinanceController)
);

export default router;
