import type { Request, Response, NextFunction } from 'express';
import { AuthenticationError, AuthorizationError } from '../utils/error.util';
import { PermissionService } from '../services/permission.service';
import { hasAllPermissions, hasAnyPermission, hasPermission } from '../types/access.types';

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

