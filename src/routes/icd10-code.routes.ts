import { Router } from 'express';
import { query } from 'express-validator';
import { authenticate } from '../middleware/auth.middleware';
import { resolveBranchAccess } from '../middleware/branchAccess.middleware';
import { enterTenantContext } from '../middleware/tenantContext.middleware';
import { validate } from '../middleware/validation.middleware';
import { icd10CodeService } from '../services/icd10-code.service';

const router = Router();
router.use(authenticate, resolveBranchAccess, enterTenantContext);
router.get('/', validate([
  query('search').optional().isString().isLength({ max: 255 }),
  query('code').optional().isString().isLength({ min: 3, max: 8 }),
  query('page').optional().isInt({ min: 1, max: 100000 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
]), async (req, res, next) => {
  try {
    res.json(await icd10CodeService.list({
      search: req.query.search as string | undefined,
      code: req.query.code as string | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    }));
  } catch (error) { next(error); }
});
export default router;
