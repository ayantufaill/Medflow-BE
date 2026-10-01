import type { Request, Response, NextFunction } from 'express';
import { PermissionService } from '../services/permission.service';
import { AuthenticationError, AuthorizationError } from '../utils/error.util';
import { ERR_PHI_ACCESS_NOT_GRANTED, hasPermission, type AccessContext } from '../types/access.types';

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
 *   - holds '*' AND is one of the recognised wildcard-honoured roles (Super
 *     Admin / Admin / Branch Admin) or a flagged platform admin.
 *
 * This now delegates to the canonical `hasPermission()` in access.types.ts —
 * the same check `requirePermission()` uses — instead of re-implementing its
 * own narrower version. The previous version only honoured '*' for a role
 * literally named 'Super Admin', silently excluding Branch Admin and Admin
 * despite both holding '*' in the seed (see the explicit
 * 'clinical.cross_branch.view' grant added to ADMIN_GROUP_PERMISSIONS as a
 * workaround for that bug). That key is now redundant but harmless to leave
 * in place: this middleware would pass Admin/Branch Admin via the wildcard
 * path alone.
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
      // A4 path: in-memory, no query. Same canonical check requirePermission() uses.
      allowed = hasPermission(access, PHI_PERMISSION);
    } else {
      // Pre-A4 path (no req.access resolved yet). PermissionService.hasPermission()
      // applies the same wildcard-honoured gate as hasPermission() above.
      allowed = await PermissionService.hasPermission(req.userId, PHI_PERMISSION);
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
