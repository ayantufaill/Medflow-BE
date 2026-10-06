import type { Request, Response, NextFunction } from 'express';
import { AuthenticationError, AuthorizationError } from '../utils/error.util';
import { PermissionService } from '../services/permission.service';
import { hasAllPermissions, hasAnyPermission, hasPermission } from '../types/access.types';
import { prisma } from '../config/db';
import { getTreatmentCoordinatorClinicIds } from '../services/rbac.service';

/**
 * Middleware to require a specific permission
 */
export const requirePermission = (permission: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !req.userId) {
      return next(new AuthenticationError('Authentication required'));
    }

    try {
      const allowed = req.access
        ? hasPermission(req.access, permission)
        : await PermissionService.hasPermission(req.userId, permission);

      if (!allowed) {
        return next(
          new AuthorizationError(`Required permission: ${permission}`)
        );
      }

      next();
    } catch (error) {
      next(new AuthorizationError('Permission check failed'));
    }
  };
};

/**
 * Middleware to require any of the specified permissions
 */
export const requireAnyPermission = (...permissions: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !req.userId) {
      return next(new AuthenticationError('Authentication required'));
    }

    try {
      const allowed = req.access
        ? hasAnyPermission(req.access, permissions)
        : await PermissionService.hasAnyPermission(req.userId, permissions);

      if (!allowed) {
        return next(
          new AuthorizationError(`Required one of permissions: ${permissions.join(', ')}`)
        );
      }

      next();
    } catch (error) {
      next(new AuthorizationError('Permission check failed'));
    }
  };
};

/**
 * Middleware to require all of the specified permissions
 */
export const requireAllPermissions = (...permissions: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !req.userId) {
      return next(new AuthenticationError('Authentication required'));
    }

    try {
      const allowed = req.access
        ? hasAllPermissions(req.access, permissions)
        : await PermissionService.hasAllPermissions(req.userId, permissions);

      if (!allowed) {
        return next(
          new AuthorizationError(`Required all permissions: ${permissions.join(', ')}`)
        );
      }

      next();
    } catch (error) {
      next(new AuthorizationError('Permission check failed'));
    }
  };
};

/**
 * Middleware to require both a role AND a permission
 * Useful for cases where you need both role-based and permission-based checks
 */
export const requireRoleAndPermission = (role: string, permission: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !req.userId) {
      return next(new AuthenticationError('Authentication required'));
    }

    try {
      const hasRole = await PermissionService.hasRole(req.userId, role);
      const hasPermission = await PermissionService.hasPermission(req.userId, permission);

      if (!hasRole || !hasPermission) {
        return next(
          new AuthorizationError(`Required role: ${role} and permission: ${permission}`)
        );
      }

      next();
    } catch (error) {
      next(new AuthorizationError('Role and permission check failed'));
    }
  };
};


/**
 * requirePermission(permission), or the caller is a Treatment Coordinator for
 * the branch of the treatment plan (req.params.id) or patient
 * (req.query.patientId / req.body.patientId) being touched. The branch check
 * runs inside the tenant context, so RLS has already hidden other branches.
 */
export const requirePermissionOrTreatmentCoordinator = (permission: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !req.userId) {
      return next(new AuthenticationError('Authentication required'));
    }
    try {
      const allowed = req.access
        ? hasPermission(req.access, permission)
        : await PermissionService.hasPermission(req.userId, permission);
      if (allowed) return next();

      let patNum: bigint | null = null;
      if (req.params.id && /^\d+$/.test(req.params.id)) {
        const plan = await prisma.treatplan.findUnique({ where: { TreatPlanNum: BigInt(req.params.id) }, select: { PatNum: true } });
        patNum = plan?.PatNum ?? null;
      } else {
        const raw = String(req.query.patientId ?? req.body?.patientId ?? '');
        if (/^\d+$/.test(raw)) patNum = BigInt(raw);
      }
      if (patNum !== null && req.access) {
        const patient = await prisma.patient.findFirst({ where: { PatNum: patNum }, select: { ClinicNum: true } });
        if (patient?.ClinicNum != null) {
          const coordinatorClinics = await getTreatmentCoordinatorClinicIds(req.userId, req.access.clinicIds);
          if (coordinatorClinics.some((c) => c === patient.ClinicNum)) return next();
        }
      }
      return next(new AuthorizationError(`Required permission: ${permission}`));
    } catch (error) {
      next(error);
    }
  };
};
