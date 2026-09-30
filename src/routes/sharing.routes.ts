import { Router } from 'express';
import { sharingController } from '../controllers/sharing.controller';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { resolveBranchAccess } from '../middleware/branchAccess.middleware';

const router = Router();

router.use(authenticate);
router.use(resolveBranchAccess);

// According to plan: Only Group Admins and Platform Admins can hit this
router.get('/policy', requireRoles('Admin', 'Group Admin'), sharingController.getPolicy.bind(sharingController));
router.put('/policy', requireRoles('Admin', 'Group Admin'), sharingController.updatePolicy.bind(sharingController));

export default router;

