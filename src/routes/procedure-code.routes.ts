import { Router } from 'express';
import { procedureCodeController } from '../controllers/procedure-code.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

/**
 * @swagger
 * /procedure-codes:
 *   get:
 *     summary: Get all dental procedure codes
 *     tags: [Procedure Codes]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of dental procedure codes
 */
router.get('/', procedureCodeController.getAllProcedureCodes.bind(procedureCodeController));

export default router;