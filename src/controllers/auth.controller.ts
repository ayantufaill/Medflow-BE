import type { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { userService } from '../services/user.service';
import { generateTokens, verifyRefreshToken, blacklistToken } from '../utils/jwt.util';
import { AuthenticationError } from '../utils/error.util';
import { prisma } from '../config/db';
import { getClientIp } from '../utils/activity-logger.util';
import { getUserMeta } from '../utils/opendental-auth.util';

export class AuthController {
  async initiateRegistration(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.initiateRegistration(req.body);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async verifyEmailAndRegister(req: Request, res: Response, next: NextFunction) {
    try {
      const { token, password } = req.body;
      if (!token) {
        throw new AuthenticationError('Verification token is required');
      }
      if (!password) {
        throw new AuthenticationError('Password is required');
      }
      const result = await authService.verifyEmailAndRegister(token, password);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async resendVerificationCode(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.body;
      if (!email) {
        throw new AuthenticationError('Email is required');
      }
      const result = await authService.resendVerificationCode(email);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const ipAddress = getClientIp(req);
      const result = await authService.login(req.body, ipAddress);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async refreshToken(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        throw new AuthenticationError('Refresh token is required');
      }

      const decoded = await verifyRefreshToken(refreshToken);
      const user = await prisma.userod.findUnique({
        where: { UserNum: BigInt(decoded.userId) },
      });
      if (!user) {
        throw new AuthenticationError('User not found');
      }

      const meta = await getUserMeta(user.UserNum);
      const storedVersion = Number(meta.tokenVersion ?? 0);
      if (decoded.tokenVersion !== undefined && storedVersion !== decoded.tokenVersion) {
        throw new AuthenticationError('Token has been invalidated. Please login again.');
      }

      const userWithRoles = await authService.getUserWithRoles(decoded.userId);
      const roles = userWithRoles.roles.map((r) => String(r.name));
      // groupId/branchIds/isGroupAdmin: display/convenience snapshot only —
      // see JWTPayload. Refreshed here from the same fresh DB lookup
      // getUserWithRoles always does, so a long-lived session's claims stay
      // current as of each refresh; still never trusted for authorization.
      const tokens = generateTokens({
        userId: decoded.userId,
        email: decoded.email,
        roles: roles as string[],
        tokenVersion: Number(meta.tokenVersion || 0),
        groupId: userWithRoles.groupId,
        branchIds: userWithRoles.branchIds,
        isGroupAdmin: userWithRoles.isGroupAdmin,
      });

      res.status(200).json({ success: true, data: { tokens } });
    } catch (error) {
      next(error);
    }
  }

  async getProfile(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        throw new AuthenticationError('User not authenticated');
      }

      const user = await authService.getUserWithRoles(req.userId);
      res.status(200).json({ success: true, data: { user } });
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        throw new AuthenticationError('User not authenticated');
      }

      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        await blacklistToken(token, req.userId, 'logout');
      }

      const { refreshToken } = req.body;
      if (refreshToken) {
        await blacklistToken(refreshToken, req.userId, 'logout');
      }

      res.status(200).json({ success: true, data: { message: 'Logged out successfully' } });
    } catch (error) {
      next(error);
    }
  }

  async requestPasswordReset(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.body;
      if (!email) {
        throw new AuthenticationError('Email is required');
      }
      const result = await authService.requestPasswordReset(email);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async verifyPasswordResetCode(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, code } = req.body;
      if (!email || !code) {
        throw new AuthenticationError('Email and reset code are required');
      }
      const result = await authService.verifyPasswordResetCode(email, code);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, code, newPassword } = req.body;
      if (!email || !code || !newPassword) {
        throw new AuthenticationError('Email, reset code, and new password are required');
      }
      const result = await authService.resetPassword(email, code, newPassword);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async resendPasswordResetCode(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.body;
      if (!email) {
        throw new AuthenticationError('Email is required');
      }
      const result = await authService.resendPasswordResetCode(email);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async verifyTokenAndSetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { token, password } = req.body;
      if (!token || !password) {
        throw new AuthenticationError('Token and password are required');
      }
      const result = await userService.verifyTokenAndSetPassword(token, password);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
