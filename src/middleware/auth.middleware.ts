import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.util';
import { AuthenticationError, AuthorizationError } from '../utils/error.util';
import { prisma } from '../config/db';
import { getUserMeta } from '../utils/opendental-auth.util';

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('No token provided');
    }

    const token = authHeader.substring(7);
    const decoded = await verifyAccessToken(token);

    if (decoded.tokenVersion !== undefined) {
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

      if (meta.tokenVersion !== decoded.tokenVersion) {
        throw new AuthenticationError('Token has been invalidated. Please login again.');
      }
    }

    req.user = decoded;
    req.userId = decoded.userId;

    next();
  } catch (error) {
    if (error instanceof Error && (error.message.includes('token') || error.message.includes('Token'))) {
      next(new AuthenticationError(error.message));
    } else {
      next(new AuthenticationError('Invalid token'));
    }
  }
};

export const requireRoles = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AuthenticationError('Authentication required'));
    }

    const userRoles = req.user.roles || [];
    const hasRole = allowedRoles.some((role) => userRoles.includes(role));

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
    const hasAllRoles = requiredRoles.every((role) => userRoles.includes(role));

    if (!hasAllRoles) {
      return next(new AuthorizationError(`Required all roles: ${requiredRoles.join(', ')}`));
    }

    next();
  };
};
