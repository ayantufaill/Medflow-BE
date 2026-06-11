import { Router } from 'express';
import { membershipPlanController } from '../controllers/membership-plan.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Require authentication for all membership plan endpoints
router.use(authenticate);

router.get('/', membershipPlanController.getMembershipPlans.bind(membershipPlanController));
router.post('/', membershipPlanController.createMembershipPlan.bind(membershipPlanController));
router.put('/:id', membershipPlanController.updateMembershipPlan.bind(membershipPlanController));
router.delete('/:id', membershipPlanController.deleteMembershipPlan.bind(membershipPlanController));

export default router;
