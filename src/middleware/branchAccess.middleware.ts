import type { Request, Response, NextFunction } from 'express';
import { AuthenticationError } from '../utils/error.util';
import { PermissionService } from '../services/permission.service';

/**
 * Resolves `req.branchAccess` from the caller's `userclinic` assignments
 * (expanded to every clinic in their practicegroup if they're a Group Admin).
 *
 * Usage in routes:
 *   router.use(authenticate, resolveBranchAccess, yourController);
 *
 * In controllers/services, scope ClinicNum-filtered queries to
 * `req.branchAccess!.clinicIds`.
 */
export const resolveBranchAccess = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.userId) {
    return next(new AuthenticationError('Authentication required'));
  }

  try {
    req.branchAccess = await PermissionService.getBranchAccess(req.userId);
    next();
  } catch (error) {
    next(error);
  }
};
