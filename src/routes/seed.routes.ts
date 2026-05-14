import { Router, type Request, type Response } from 'express';
import { execSync } from 'child_process';

const router = Router();

router.all('*', (_req: Request, res: Response) => {
  res.status(404).json({ message: 'Not found' });
});

export default router;
