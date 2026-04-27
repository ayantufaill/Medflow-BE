import { Router } from 'express';
import { eraController } from '../controllers/era.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validation.middleware';
import { uploadEraFile } from '../middleware/upload.middleware';
import {
  eraIdValidator,
  eraItemIdValidator,
  eraSearchValidator,
  unmatchedSearchValidator,
  matchEraItemValidator,
} from '../validators/era.validator';

const router = Router();

/**
 * @swagger
 * /era/import:
 *   post:
 *     summary: Import ERA (Electronic Remittance Advice) file
 *     tags: [ERA]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               carrierId:
 *                 type: integer
 *                 example: 1
 *     responses:
 *       200:
 *         description: ERA file imported
 *       400:
 *         description: Invalid file format
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/import',
  authenticate,
  requirePermission('era.create'),
  uploadEraFile.any(),
  eraController.importERAFile.bind(eraController)
);

/**
 * @swagger
 * /era:
 *   get:
 *     summary: Get all ERA records
 *     tags: [ERA]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: fromDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: toDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: carrierId
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: List of ERA records
 */
router.get(
  '/',
  authenticate,
  requirePermission('era.read'),
  validate(eraSearchValidator),
  eraController.getAllERAs.bind(eraController)
);

/**
 * @swagger
 * /era/unmatched:
 *   get:
 *     summary: Get unmatched ERA items
 *     tags: [ERA]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: carrierId
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: List of unmatched items
 */
router.get(
  '/unmatched',
  authenticate,
  requirePermission('era.read'),
  validate(unmatchedSearchValidator),
  eraController.getUnmatchedItems.bind(eraController)
);

/**
 * @swagger
 * /era/items/{eraItemId}/match:
 *   post:
 *     summary: Match ERA item to a claim
 *     tags: [ERA]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eraItemId
 *         required: true
 *         schema: 
 *           type: integer
 *           example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - claimId
 *             properties:
 *               claimId:
 *                 type: string
 *                 description: Claim ID (must be a string)
 *                 example: "CLM001"
 *               notes:
 *                 type: string
 *                 description: Additional notes about the match
 *                 example: "Matched to claim CLM001"
 *     responses:
 *       200:
 *         description: ERA item matched
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Item or claim not found
 */
router.post(
  '/items/:eraItemId/match',
  authenticate,
  requirePermission('era.update'),
  validate([...eraItemIdValidator, ...matchEraItemValidator]),
  eraController.matchERAItem.bind(eraController)
);

/**
 * @swagger
 * /era/{eraId}:
 *   get:
 *     summary: Get ERA by ID
 *     tags: [ERA]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eraId
 *         required: true
 *         schema: 
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: ERA details
 *       404:
 *         description: ERA not found
 */
router.get(
  '/:eraId',
  authenticate,
  requirePermission('era.read'),
  validate(eraIdValidator),
  eraController.getERAById.bind(eraController)
);

/**
 * @swagger
 * /era/{eraId}/items:
 *   get:
 *     summary: Get ERA items by ERA ID
 *     tags: [ERA]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eraId
 *         required: true
 *         schema: 
 *           type: integer
 *           example: 1
 *       - in: query
 *         name: isMatched
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: List of ERA items
 */
router.get(
  '/:eraId/items',
  authenticate,
  requirePermission('era.read'),
  validate(eraIdValidator),
  eraController.getERAItems.bind(eraController)
);

/**
 * @swagger
 * /era/{eraId}/auto-post:
 *   post:
 *     summary: Auto-post payments from ERA
 *     tags: [ERA]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: eraId
 *         required: true
 *         schema: 
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: Payments posted automatically
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       400:
 *         description: Some items could not be matched
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: ERA not found
 */
router.post(
  '/:eraId/auto-post',
  authenticate,
  requirePermission('era.update'),
  validate(eraIdValidator),
  eraController.autoPostPayments.bind(eraController)
);

export default router;