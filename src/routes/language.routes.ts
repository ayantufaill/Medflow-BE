import { Router } from 'express';
import { languageController } from '../controllers/language.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, languageController.getAllLanguages);

export default router;
