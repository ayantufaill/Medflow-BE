import type { Request, Response, NextFunction } from 'express';
import { tenantContextStorage } from '../config/tenant-context';
import { PermissionService } from '../services/permission.service';

/**
 * Enters the AsyncLocalStorage-scoped tenant context for the rest of this
 * request, consumed transparently by the Prisma client extension in
 * src/config/db.ts to SET LOCAL app.clinic_ids for Postgres RLS.
 *
 * Must run after resolveBranchAccess (needs req.branchAccess).
 *
 * '*' (unrestricted) is used for exactly two cases: a true system Admin role
 * (mirrors PermissionService.canAccessResource's Admin bypass), and callers
 * with no clinic assignments resolved at all — mirroring the same "empty
 * scope = unrestricted" convention already used at the app layer (see
 * branch.service.ts/patient.service.ts) for practices not yet onboarded onto
 * branches. Anyone with an actual resolved scope — including Group Admins,
 * whose clinicIds is already expanded to their whole group by
 * getBranchAccess — is passed through as that literal, bounded list.
 */
export const enterTenantContext = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.userId || !req.branchAccess) {
    return next();
  }

  try {
    const isSystemAdmin = await PermissionService.hasRole(req.userId, 'Admin');
    const clinicIds: bigint[] | '*' =
      isSystemAdmin || req.branchAccess.clinicIds.length === 0 ? '*' : req.branchAccess.clinicIds;

    tenantContextStorage.run({ clinicIds }, () => next());
  } catch (error) {
    next(error);
  }
};
