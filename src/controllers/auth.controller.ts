import type { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { userService } from '../services/user.service';
import { generateTokens, verifyRefreshToken, blacklistToken } from '../utils/jwt.util';
import { AuthenticationError } from '../utils/error.util';
import { UserModel } from '../models/user.model';
import { getClientIp } from '../utils/activity-logger.util';

export class AuthController {
  /**
   * Initiate registration - sends verification code to email
   */
  async initiateRegistration(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.initiateRegistration(req.body);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Verify email token and set password to complete registration
   */
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
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Resend verification code
   */
  async resendVerificationCode(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.body;
      if (!email) {
        throw new AuthenticationError('Email is required');
      }
      const result = await authService.resendVerificationCode(email);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const ipAddress = getClientIp(req);
      const result = await authService.login(req.body, ipAddress);
      res.status(200).json({
        success: true,
        data: result,
      });
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
      
      // Get user to check token version
      const user = await UserModel.findById(decoded.userId);
      if (!user) {
        throw new AuthenticationError('User not found');
      }
      
      // Check if token version matches
      if (decoded.tokenVersion !== undefined && user.tokenVersion !== decoded.tokenVersion) {
        throw new AuthenticationError('Token has been invalidated. Please login again.');
      }
      
      const userWithRoles = await authService.getUserWithRoles(decoded.userId);

      const roles = userWithRoles.roles.map((r) => String(r.name));
      const tokens = generateTokens({
        userId: decoded.userId,
        email: decoded.email,
        roles: roles as string[],
        tokenVersion: Number(user.tokenVersion || 0),
      });

      res.status(200).json({
        success: true,
        data: { tokens },
      });
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
      res.status(200).json({
        success: true,
        data: { user },
      });
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
        // Blacklist the access token
        await blacklistToken(token, req.userId, 'logout');
      }

      // Also blacklist refresh token if provided
      const { refreshToken } = req.body;
      if (refreshToken) {
        await blacklistToken(refreshToken, req.userId, 'logout');
      }

      res.status(200).json({
        success: true,
        data: { message: 'Logged out successfully' },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Request password reset - sends reset code to email
   */
  async requestPasswordReset(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.body;
      if (!email) {
        throw new AuthenticationError('Email is required');
      }
      const result = await authService.requestPasswordReset(email);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Verify password reset code
   */
  async verifyPasswordResetCode(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, code } = req.body;
      if (!email || !code) {
        throw new AuthenticationError('Email and reset code are required');
      }
      const result = await authService.verifyPasswordResetCode(email, code);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Reset password with new password
   */
  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, code, newPassword } = req.body;
      if (!email || !code || !newPassword) {
        throw new AuthenticationError('Email, reset code, and new password are required');
      }
      const result = await authService.resetPassword(email, code, newPassword);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Resend password reset code
   */
  async resendPasswordResetCode(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.body;
      if (!email) {
        throw new AuthenticationError('Email is required');
      }
      const result = await authService.resendPasswordResetCode(email);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Verify token and set password (for admin-created users)
   */
  async verifyTokenAndSetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { token, password } = req.body;
      if (!token || !password) {
        throw new AuthenticationError('Token and password are required');
      }
      const result = await userService.verifyTokenAndSetPassword(token, password);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

}

export const authController = new AuthController();

