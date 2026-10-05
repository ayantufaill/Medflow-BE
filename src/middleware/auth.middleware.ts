import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.util';
import type { JWTPayload } from '../types/auth.types';
import { AuthenticationError, AuthorizationError } from '../utils/error.util';
import { prisma } from '../config/db';
import { getUserMeta } from '../utils/opendental-auth.util';
import { AccessContextService } from '../services/access-context.service';
import {
  type UserGroup,
  USER_GROUPS,
  getUserGroups,
  isUserInAnyGroup,
  withLegacyRoleNames,
} from '../types/user-group.types';

/**
 * Verifies the session behind an already-decoded token is still active.
 *
 * Extracted in A1 so the socket.io handshake (sockets/socket.ts) can run the
 * exact same checks as the HTTP path — previously the socket had no notion of
 * a deactivated or revoked user, so deactivating an account left its live
 * websocket connected.
 *
 * A1.3: these checks are now UNCONDITIONAL. They used to sit behind
 * `if (decoded.tokenVersion !== undefined)`, which meant a token minted
 * before the tokenVersion claim existed skipped the deactivation and
 * revocation checks entirely and remained valid indefinitely. A token with
 * no claim is now treated as version 0, so it is checked against the stored
 * version like any other token; the only cost is that pre-claim tokens force
 * a re-login, which is the correct trade for closing a revocation bypass.
 */
export const verifyActiveSession = async (decoded: JWTPayload): Promise<void> => {
  const user = await prisma.userod.findUnique({
    where: { UserNum: BigInt(decoded.userId) },
  });
  if (!user) {
    throw new AuthenticationError('User not found');
  }

  const meta = await getUserMeta(user.UserNum);
  if (meta.isActive === false || user.IsHidden) {
    throw new AuthenticationError('Account is deactivated');
  }

  // Missing claim on the token is treated as version 0 rather than skipping
  // the comparison — see the note above.
  if (Number(meta.tokenVersion ?? 0) !== Number(decoded.tokenVersion ?? 0)) {
    throw new AuthenticationError('Token has been invalidated. Please login again.');
  }
};

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('No token provided');
    }

    const token = authHeader.substring(7);
    const decoded = await verifyAccessToken(token);

    await verifyActiveSession(decoded);

    req.user = decoded;
    req.userId = decoded.userId;
    req.access = await AccessContextService.load(decoded.userId, Number(decoded.tokenVersion ?? 0));

    next();
  } catch (error) {
    if (error instanceof Error && (error.message.includes('token') || error.message.includes('Token'))) {
      next(new AuthenticationError(error.message));
    } else {
      next(new AuthenticationError('Invalid token'));
    }
  }
};

/**
 * The caller's role names, preferring the access context that `authenticate`
 * loads from the database over the names embedded in the JWT.
 *
 * The token carries `roles` only when it was minted with them, and they go
 * stale the moment an administrator changes someone's role. `req.access.roles`
 * is read per request and spells new-model roles with their machine keys
 * ('group_admin'), which is what usergroup.Description actually stores — so
 * reading the token alone left every new-model account with no roles at all
 * and answered 403 on routes they are entitled to.
 *
 * New-model keys are expanded with the legacy names they answer to
 * (withLegacyRoleNames), so routes that still list legacy names accept them.
 */
const rolesOf = (req: Request): string[] => withLegacyRoleNames(req.access?.roles ?? req.user?.roles ?? []);

const ROLE_ALIASES: Record<string, string[]> = {
  'Admin': ['Super Admin', 'Group Admin', 'Branch Admin'],
  'Super Admin': ['Admin'],
  'Group Admin': ['Admin'],
  'Branch Admin': ['Admin'],
  'Receptionist': ['Front Desk'],
  'Front Desk': ['Receptionist'],
  'Billing Staff': ['Biller'],
  'Biller': ['Billing Staff'],
  'Clinical Staff': ['Assistant', 'Hygienist'],
  'Assistant': ['Clinical Staff'],
  'Hygienist': ['Clinical Staff'],
  'Doctor': ['Provider'],
  'Provider': ['Doctor'],
};

/**
 * Pure 4-Group Middleware: requires user to belong to at least one of the specified groups.
 * ADMIN_GROUP has universal bypass across all endpoints.
 */
export const requireGroups = (...allowedGroups: UserGroup[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AuthenticationError('Authentication required'));
    }

    const userRoles = rolesOf(req);
    const userGroups = getUserGroups(userRoles);

    // Administrative Group (Super Admin, Group Admin, Branch Admin) has universal platform authority
    if (userGroups.includes('ADMIN_GROUP') || userRoles.includes('Super Admin')) {
      return next();
    }

    const hasAllowedGroup = allowedGroups.some((group) => userGroups.includes(group));
    if (!hasAllowedGroup) {
      return next(new AuthorizationError(`Required group(s): ${allowedGroups.join(', ')}`));
    }

    next();
  };
};

/**
 * Role-based guard with seamless group and alias support.
 * ADMIN_GROUP has universal platform authority.
 */
export const requireRoles = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AuthenticationError('Authentication required'));
    }

    const userRoles = rolesOf(req);
    const userGroups = getUserGroups(userRoles);

    // Administrative Group has universal platform authority
    if (userGroups.includes('ADMIN_GROUP') || userRoles.includes('Super Admin')) {
      return next();
    }

    // Check direct group match if group names were passed into requireRoles
    const groupMatches = allowedRoles.filter((r) => r in USER_GROUPS) as UserGroup[];
    if (groupMatches.length > 0 && groupMatches.some((g) => userGroups.includes(g))) {
      return next();
    }

    // Expand allowed roles with group members and aliases
    const expandedAllowed = allowedRoles.flatMap((role) => {
      const fromGroup = USER_GROUPS[role as UserGroup] || [];
      const fromAlias = ROLE_ALIASES[role] || [];
      return [role, ...fromGroup, ...fromAlias];
    });

    const hasRole = expandedAllowed.some((role) => userRoles.includes(role));

    if (!hasRole) {
      return next(new AuthorizationError(`Required roles: ${allowedRoles.join(', ')}`));
    }

    next();
  };
};

/** True when the caller passes requireRoles('Admin') (admin group, Super Admin or aliases). */
export const isAdminRequest = (req: Request): boolean => {
  const userRoles = rolesOf(req);
  if (getUserGroups(userRoles).includes('ADMIN_GROUP') || userRoles.includes('Super Admin')) return true;
  const allowed = ['Admin', ...(USER_GROUPS['Admin' as UserGroup] || []), ...(ROLE_ALIASES['Admin'] || [])];
  return allowed.some((role) => userRoles.includes(role));
};

/**
 * Staff-only API. Patient portal accounts use /portal/*, which scopes every
 * query to their own record; the staff endpoints scope by branch only, so a
 * patient account there would see other patients' appointments and invoices.
 */
export const denyPatientPortalUsers = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return next(new AuthenticationError('Authentication required'));
  }
  const groups = getUserGroups(rolesOf(req));
  if (groups.length > 0 && groups.every((g) => g === 'PATIENT_GROUP')) {
    return next(new AuthorizationError('Patient accounts use the patient portal.'));
  }
  next();
};

export const requireAnyRole = (...allowedRoles: string[]) => {
  return requireRoles(...allowedRoles);
};

export const requireAllRoles = (...requiredRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AuthenticationError('Authentication required'));
    }

    const userRoles = rolesOf(req);
    const userGroups = getUserGroups(userRoles);

    // Administrative Group has universal platform authority
    if (userGroups.includes('ADMIN_GROUP') || userRoles.includes('Super Admin')) {
      return next();
    }

    const hasAllRoles = requiredRoles.every((role) => userRoles.includes(role));

    if (!hasAllRoles) {
      return next(new AuthorizationError(`Required all roles: ${requiredRoles.join(', ')}`));
    }

    next();
  };
};

export const requirePlatformAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.access) {
    return next(new AuthenticationError('Authentication required'));
  }
  if (!req.access.isPlatformAdmin) {
    return next(new AuthorizationError('Forbidden - Platform Admin required'));
  }
  next();
};
