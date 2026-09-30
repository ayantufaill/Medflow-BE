import type { Request, Response, NextFunction } from 'express';
import { PermissionService } from '../services/permission.service';
import { AuthenticationError, AuthorizationError } from '../utils/error.util';
import { ERR_PHI_ACCESS_NOT_GRANTED, type AccessContext } from '../types/access.types';

/**
 * The permission that grants cross-branch access to protected health
 * information. A Group Admin holds group/financial/operational rights but
 * NOT this, which is the point: managing a group of practices is not the same
 * authority as reading its patients' clinical records.
 */
export const PHI_PERMISSION = 'clinical.cross_branch.view';

/**
 * Route guard for endpoints that return PHI (clinical notes, vitals,
 * prescriptions, treatment plans, documents, imaging, lab cases, allergies,
 * progress notes, exam/management records, patient reports).
 *
 * Place it AFTER `authenticate` and BEFORE `enterTenantContext`, so an
 * unauthorised caller is rejected before any database context is established.
 *
 *   router.get('/:id', authenticate, requirePhiAccess, resolveBranchAccess, enterTenantContext, ctrl)
 *
 * ── A4 note ────────────────────────────────────────────────────────────────
 * Once AccessContext exists (A4) this reads `req.access` and costs no query.
 * Until then it resolves permissions the expensive way — a full role +
 * permission reload per request — which is why it is a handoff checkpoint
 * rather than the final implementation.
 *
 * Two access paths are accepted:
 *   - holds PHI_PERMISSION explicitly, or
 *   - holds '*' (platform admin / one of the still-wildcard admin roles).
 *
 * A '*' holder is accepted because Super Admin and Branch Admin are seeded
 * with '*' today (A3.5) and narrowing them is separate work. Note this is
 * intentionally looser than the permission-layer check in A4, which also
 * requires the role to be a recognised wildcard role — so a custom role that
 * someone pasted '*' into is NOT treated as platform admin here. That check
 * is tightened in A4; this is the pre-A4 approximation.
 */
export const requirePhiAccess = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user || !req.userId) {
    return next(new AuthenticationError('Authentication required'));
  }

  try {
    const access = (req as Request & { access?: AccessContext }).access;

    let allowed: boolean;
    if (access) {
      // A4 path: in-memory, no query.
      allowed =
        access.permissions.has(PHI_PERMISSION) ||
        (access.isPlatformAdmin && access.permissions.has('*')) ||
        (access.permissions.has('*') && access.roles.some((r) => r === 'Super Admin'));
    } else {
      // Pre-A4 path. getUserPermissions() already folds '*' into the returned
      // set, so a single call covers both the explicit key and the wildcard.
      const permissions = await PermissionService.getUserPermissions(req.userId);
      allowed = permissions.has(PHI_PERMISSION) || permissions.has('*');
    }

    if (!allowed) {
      return next(
        new AuthorizationError(
          'You do not have access to clinical records.',
          ERR_PHI_ACCESS_NOT_GRANTED
        )
      );
    }

    next();
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
      return next(error);
    }
    next(new AuthorizationError('PHI access check failed'));
  }
};
