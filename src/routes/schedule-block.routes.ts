import { Router } from 'express';
import { scheduleBlockController } from '../controllers/schedule-block.controller';
import { authenticate } from '../middleware/auth.middleware';
import { resolveBranchAccess } from '../middleware/branchAccess.middleware';
import { enterTenantContext } from '../middleware/tenantContext.middleware';

const router = Router();

// All schedule block routes require authentication
router.use(authenticate);
router.use(resolveBranchAccess);
router.use(enterTenantContext);

/**
 * @swagger
 * /schedule-blocks:
 *   get:
 *     summary: Get schedule block
 *     tags: [Schedule Block]
 *     security:
 *       - bearerAuth: []
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

router.get('/', scheduleBlockController.getBlocksForDate.bind(scheduleBlockController));
/**
 * @swagger
 * /schedule-blocks:
 *   post:
 *     summary: Post schedule block
 *     tags: [Schedule Block]
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

router.post('/', scheduleBlockController.createBlock.bind(scheduleBlockController));

/**
 * @swagger
 * /schedule-blocks/{blockId}:
 *   put:
 *     summary: Update schedule block
 *     tags: [Schedule Block]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: blockId
 *         required: true
 *         schema: { type: string }
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

router.put('/:blockId', scheduleBlockController.updateBlock.bind(scheduleBlockController));

/**
 * @swagger
 * /schedule-blocks/{blockId}:
 *   delete:
 *     summary: Delete :blockId
 *     tags: [Schedule Block]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: blockId
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

router.delete('/:blockId', scheduleBlockController.deleteBlock.bind(scheduleBlockController));

export default router;
