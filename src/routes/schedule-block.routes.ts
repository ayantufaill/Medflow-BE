import { Router } from 'express';
import { scheduleBlockController } from '../controllers/schedule-block.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// All schedule block routes require authentication
router.use(authenticate);

router.get('/', scheduleBlockController.getBlocksForDate.bind(scheduleBlockController));
router.post('/', scheduleBlockController.createBlock.bind(scheduleBlockController));
router.delete('/:blockId', scheduleBlockController.deleteBlock.bind(scheduleBlockController));

export default router;
