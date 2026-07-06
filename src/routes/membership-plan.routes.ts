import { Router } from 'express';
import { membershipPlanController } from '../controllers/membership-plan.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Require authentication for all membership plan endpoints
router.use(authenticate);

/**
 * @swagger
 * /membership-plans:
 *   get:
 *     summary: Get membership plan
 *     tags: [Membership Plan]
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

router.get('/', membershipPlanController.getMembershipPlans.bind(membershipPlanController));
/**
 * @swagger
 * /membership-plans:
 *   post:
 *     summary: Post membership plan
 *     tags: [Membership Plan]
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

router.post('/', membershipPlanController.createMembershipPlan.bind(membershipPlanController));
/**
 * @swagger
 * /membership-plans/{id}:
 *   put:
 *     summary: Put :id
 *     tags: [Membership Plan]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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

router.put('/:id', membershipPlanController.updateMembershipPlan.bind(membershipPlanController));
/**
 * @swagger
 * /membership-plans/{id}:
 *   delete:
 *     summary: Delete :id
 *     tags: [Membership Plan]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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

router.delete('/:id', membershipPlanController.deleteMembershipPlan.bind(membershipPlanController));

export default router;
