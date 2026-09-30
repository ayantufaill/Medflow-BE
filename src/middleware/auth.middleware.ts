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

    const userRoles = req.user.roles || [];
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

    const userRoles = req.user.roles || [];
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

export const requireAnyRole = (...allowedRoles: string[]) => {
  return requireRoles(...allowedRoles);
};

export const requireAllRoles = (...requiredRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AuthenticationError('Authentication required'));
    }

    const userRoles = req.user.roles || [];
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
