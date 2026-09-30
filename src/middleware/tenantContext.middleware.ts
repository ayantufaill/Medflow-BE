import type { Request, Response, NextFunction } from 'express';
import { tenantContextStorage } from '../config/tenant-context';
import { PermissionService } from '../services/permission.service';
import { AuthorizationError } from '../utils/error.util';
import { ERR_NO_BRANCH_ASSIGNED } from '../types/access.types';

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
 * ── Fail-closed (A1) ───────────────────────────────────────────────────────
 * Previously BOTH scopes fell back to the '*' sentinel when the caller had no
 * resolved scope:
 *
 *   isSystemAdmin || clinicIds.length === 0 ? '*' : clinicIds
 *   isSystemAdmin || groupId === null        ? '*' : groupId
 *
 * Since every RLS policy treats '*' as "see everything", a user with a role
 * but no clinic assignment was handed unrestricted access — the single
 * biggest hole in the access model, and the reason a missed WHERE clause was
 * the only thing between two practices and each other's data.
 *
 * The rule now:
 *
 *   '*'  → ONLY a Super Admin (later: isPlatformAdmin || accessAllClinics)
 *   []   → DENY, answered with 403 NO_BRANCH_ASSIGNED
 *   null → no group resolved, passed through as null; the RLS policy already
 *          treats null/'' as deny
 *
 * NO_BRANCH_ASSIGNED is an onboarding state, not an attack, so it gets its
 * own error code: the frontend renders "no branch is assigned to your
 * account, contact your administrator" rather than a generic permission
 * error. See 00-SHARED-CONTRACTS.md §8.
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
    const isSystemAdmin = await PermissionService.hasRole(req.userId, 'Super Admin');

    // Deny rather than widen. A caller with no branch assignment gets a 403
    // with an actionable code instead of a silently unrestricted session.
    if (!isSystemAdmin && req.branchAccess.clinicIds.length === 0) {
      return next(
        new AuthorizationError(
          'No branch is assigned to your account. Contact your administrator.',
          ERR_NO_BRANCH_ASSIGNED
        )
      );
    }

    const clinicIds: bigint[] | '*' = isSystemAdmin ? '*' : req.branchAccess.clinicIds;

    // Group is NOT widened to '*' for a non-admin, even when unresolvable.
    // null flows into the RLS GUC as '' and the policy denies, which is the
    // intended outcome: a user whose clinic belongs to no practice group
    // cannot read patients at all rather than reading all of them.
    const patientGroupId: number | '*' | null = isSystemAdmin
      ? '*'
      : req.branchAccess.groupId;

    tenantContextStorage.run({ clinicIds, patientGroupId }, () => next());
  } catch (error) {
    next(error);
  }
};
