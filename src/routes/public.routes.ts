import { Router } from 'express';
import { publicEstimateController } from '../controllers/public-estimate.controller';

const router = Router();

router.get(
  '/estimates/respond',
  publicEstimateController.respondToEstimate.bind(publicEstimateController)
);

export default router;
