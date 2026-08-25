import type { Request, Response, NextFunction } from 'express';
import { tenantContextStorage } from '../config/tenant-context';
import { PermissionService } from '../services/permission.service';

/**
 * Enters the AsyncLocalStorage-scoped tenant context for the rest of this
 * request, consumed transparently by the Prisma client extension in
 * src/config/db.ts to SET LOCAL app.clinic_ids / app.patient_group_id for
 * Postgres RLS.
 *
 * Must run after resolveBranchAccess (needs req.branchAccess).
 *
 * Two independent scopes are entered:
 * - clinicIds: the caller's own branch(es) — governs writes everywhere,
 *   and reads on every RLS table except patient.
 * - patientGroupId: the caller's own practicegroup id, matched directly
 *   against the stored patient.GroupNum column — read-visibility for the
 *   `patient` table only (see prisma/rls/04-patient-group-visibility.sql),
 *   so any caller in a group sees every patient in that group, not just
 *   their own branch.
 *
 * '*' (unrestricted) is used for exactly two cases in each: a true system
 * Admin role (mirrors PermissionService.canAccessResource's Admin bypass),
 * and callers with no resolved scope at all — mirroring the same "empty
 * scope = unrestricted" convention already used at the app layer (see
 * branch.service.ts/patient.service.ts) for practices not yet onboarded onto
 * branches/groups. Anyone with an actual resolved scope — including Group
 * Admins, whose clinicIds is already expanded to their whole group by
 * getBranchAccess — is passed through as that literal, bounded value.
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
    const patientGroupId: number | '*' =
      isSystemAdmin || req.branchAccess.groupId === null ? '*' : req.branchAccess.groupId;

    tenantContextStorage.run({ clinicIds, patientGroupId }, () => next());
  } catch (error) {
    next(error);
  }
};
