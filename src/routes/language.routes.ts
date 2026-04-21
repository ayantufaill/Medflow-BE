import { Router } from 'express';
import { languageController } from '../controllers/language.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

/**
 * @swagger
 * /languages:
 *   get:
 *     summary: Get all supported languages
 *     tags: [Languages]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of supported languages
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       code:
 *                         type: string
 *                         example: en
 *                       name:
 *                         type: string
 *                         example: English
 *       401:
 *         description: Unauthorized
 */
router.get('/', authenticate, languageController.getAllLanguages);

export default router;