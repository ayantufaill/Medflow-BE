import { UserModel } from '../models/user.model';
import { UserRoleModel } from '../models/user-role.model';
import { RoleModel } from '../models/role.model';
import { EmailVerificationModel } from '../models/email-verification.model';
import { PasswordResetModel } from '../models/password-reset.model';
import { hashPassword, comparePassword } from '../utils/password.util';
import { generateTokens } from '../utils/jwt.util';
import { AuthenticationError, NotFoundError, ConflictError } from '../utils/error.util';
import { emailService } from './email.service';
import { logSecurityEvent } from '../utils/activity-logger.util';
import crypto from 'crypto';
import type { RegisterRequest, LoginRequest, AuthResponse, UserWithRoles } from '../types/auth.types';

export class AuthService {
  /**
   * Initiate registration by sending verification link to email
   * Creates inactive user and sends link to set password
   */
  async initiateRegistration(data: RegisterRequest): Promise<{ message: string; email: string }> {
    // Check if user already exists
    const existingUser = await UserModel.findOne({ email: data.email.toLowerCase() });
    if (existingUser) {
      throw new ConflictError('User with this email already exists');
    }

    // Generate a temporary password hash (will be replaced when user sets password)
    const tempPassword = crypto.randomBytes(32).toString('hex');
    const passwordHash = await hashPassword(tempPassword);

    // Create inactive user (without password - user will set it via email link)
    const user = await UserModel.create({
      email: data.email.toLowerCase(),
      passwordHash, // Temporary, will be updated when user sets password
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      preferredLanguage: data.preferredLanguage || 'en',
      isActive: false, // User is inactive until they set password
    });

    // Assign role during registration if provided, otherwise assign default Patient role
    if (data.roleId) {
      // Verify role exists and is active
      const role = await RoleModel.findById(data.roleId);
      if (!role || !role.isActive) {
        // Rollback user creation
        await UserModel.deleteOne({ _id: user._id });
        throw new NotFoundError('Role not found or inactive');
      }

      await UserRoleModel.create({
        userId: user._id,
        roleId: data.roleId,
        assignedBy: 'system',
      });
    } else {
      // Assign default role (Patient) if no role provided
      const patientRole = await RoleModel.findOne({ name: 'Patient' });
      if (patientRole) {
        await UserRoleModel.create({
          userId: user._id,
          roleId: patientRole._id,
          assignedBy: 'system',
        });
      }
    }

    // Check if there's a pending verification for this email
    const existingVerification = await EmailVerificationModel.findOne({
      email: data.email.toLowerCase(),
      verified: false,
      expiresAt: { $gt: new Date() },
    });

    // Generate verification token
    const token = crypto.randomBytes(32).toString('hex');

    // Set expiration to 24 hours from now
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    if (existingVerification) {
      // Update existing verification
      (existingVerification as any).token = token;
      (existingVerification as any).registrationData = { userId: String(user._id), ...data };
      (existingVerification as any).expiresAt = expiresAt;
      (existingVerification as any).attempts = 0;
      await existingVerification.save();
    } else {
      // Create new verification record
      await EmailVerificationModel.create({
        email: data.email.toLowerCase(),
        token,
        registrationData: { userId: user._id, ...data },
        expiresAt,
      });
    }

    // Send registration verification link via email
    await emailService.sendRegistrationVerificationLink(data.email, token, data.firstName);

    return {
      message: 'Verification link sent to your email. Please check your email to set your password and activate your account.',
      email: data.email.toLowerCase(),
    };
  }

  /**
   * Verify email token and set password to complete registration
   */
  async verifyEmailAndRegister(token: string, password: string): Promise<AuthResponse> {
    // Find verification record by token
    const verification = await EmailVerificationModel.findOne({
      token,
      verified: false,
      expiresAt: { $gt: new Date() },
    });

    if (!verification) {
      throw new AuthenticationError('Invalid or expired verification link. Please request a new one.');
    }

    const email = String(verification.email).toLowerCase();
    const registrationData = verification.registrationData as RegisterRequest & { userId?: string };

    // Get user (already created during registration initiation)
    let user;
    if (registrationData.userId) {
      user = await UserModel.findById(registrationData.userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Check if user is already active
      if (user.isActive) {
        // Mark verification as used
        (verification as any).verified = true;
        await verification.save();
        await EmailVerificationModel.deleteOne({ _id: verification._id });
        throw new ConflictError('Account is already activated. Please login.');
      }
    } else {
      // Fallback: check if user exists by email (for backward compatibility)
      user = await UserModel.findOne({ email });
      if (!user) {
        throw new NotFoundError('User not found');
      }
    }

    // Hash new password
    const passwordHash = await hashPassword(password);

    // Update user: set password and activate
    (user as any).passwordHash = passwordHash;
    (user as any).isActive = true;
    await user.save();

    // Mark verification as used
    (verification as any).verified = true;
    await verification.save();

    // Clean up verification record
    await EmailVerificationModel.deleteOne({ _id: verification._id });

    // Get user with roles
    const userWithRoles = await this.getUserWithRoles(String(user._id));

    // Generate tokens with token version
    const roles = userWithRoles.roles.map((r: any) => String(r.name));
    const tokens = generateTokens({
      userId: String(user._id),
      email: String(user.email),
      roles,
      tokenVersion: Number(user.tokenVersion) || 0,
    });

    // Update last login
    await UserModel.findByIdAndUpdate(user._id, { lastLoginAt: new Date() });

    // Log successful registration
    await logSecurityEvent(
      String(user._id),
      'login_success',
      `User registered and verified: ${String(user.email)}`,
      undefined,
      'low'
    );

    return {
      user: this.sanitizeUser(user),
      tokens,
    };
  }

  /**
   * Resend verification link
   */
  async resendVerificationCode(email: string): Promise<{ message: string; email: string }> {
    // Find existing verification
    const verification = await EmailVerificationModel.findOne({
      email: email.toLowerCase(),
      verified: false,
      expiresAt: { $gt: new Date() },
    });

    if (!verification) {
      throw new NotFoundError('No pending verification found. Please start registration again.');
    }

    // Generate new token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    (verification as any).token = token;
    (verification as any).expiresAt = expiresAt;
    (verification as any).attempts = 0;
    await verification.save();

    // Send registration verification link via email
    const registrationData = verification.registrationData as RegisterRequest;
    await emailService.sendRegistrationVerificationLink(email, token, registrationData.firstName);

    return {
      message: 'Verification link resent to your email',
      email: email.toLowerCase(),
    };
  }

  async login(data: LoginRequest, ipAddress?: string): Promise<AuthResponse> {
    // Find user with password hash
    const user = await UserModel.findOne({ email: data.email.toLowerCase() }).select('+passwordHash');

    if (!user) {
      throw new AuthenticationError('Invalid email or password');
    }

    // Check if account is active
    if (!user.isActive) {
      throw new AuthenticationError('Account is deactivated. Please contact administrator.');
    }

    // Verify password
    const isPasswordValid = await comparePassword(data.password, String(user.passwordHash));

    if (!isPasswordValid) {
      // Log failed login attempt
      await logSecurityEvent(
        String(user._id),
        'login_failure',
        `Failed login attempt for ${String(user.email)}`,
        ipAddress,
        'medium'
      );

      throw new AuthenticationError('Invalid email or password');
    }

    // Update last login on successful login
    await UserModel.findByIdAndUpdate(user._id, {
      lastLoginAt: new Date(),
    });

    // Log successful login
    await logSecurityEvent(
      String(user._id),
      'login_success',
      `Successful login for ${user.email}`,
      ipAddress,
      'low'
    );

    // Get user with roles
    const userWithRoles = await this.getUserWithRoles(String(user._id));

    // Generate tokens with token version
    const roles = userWithRoles.roles.map((r: any) => String(r.name));
    const tokens = generateTokens({
      userId: String(user._id),
      email: String(user.email),
      roles,
      tokenVersion: Number(user.tokenVersion) || 0,
    });

    return {
      user: this.sanitizeUser(user),
      tokens,
    };
  }

  async getUserWithRoles(userId: string): Promise<UserWithRoles> {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const userRoles = await UserRoleModel.find({ userId });
    const roleIds = userRoles.map((ur) => ur.roleId);
    const roles = await RoleModel.find({ _id: { $in: roleIds }, isActive: true });

    const sanitizedUser = this.sanitizeUser(user) as any;
    return {
      ...sanitizedUser,
      roles,
    } as UserWithRoles;
  }

  /**
   * Request password reset - sends reset code to email
   */
  async requestPasswordReset(email: string): Promise<{ message: string; email: string }> {
    // Find user by email
    const user = await UserModel.findOne({ email: email.toLowerCase() });

    // For security, don't reveal if email exists or not
    // Always return success message even if user doesn't exist
    if (!user) {
      return {
        message: 'If an account with that email exists, a password reset code has been sent.',
        email: email.toLowerCase(),
      };
    }

    // Check if account is active
    if (!user.isActive) {
      return {
        message: 'If an account with that email exists, a password reset code has been sent.',
        email: email.toLowerCase(),
      };
    }

    // Check if there's a pending reset for this email
    const existingReset = await PasswordResetModel.findOne({
      email: email.toLowerCase(),
      used: false,
      expiresAt: { $gt: new Date() },
    });

    // Generate 6-digit reset code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Set expiration to 15 minutes from now
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    if (existingReset) {
      // Update existing reset
      (existingReset as any).code = code;
      (existingReset as any).expiresAt = expiresAt;
      (existingReset as any).attempts = 0;
      await existingReset.save();
    } else {
      // Create new reset record
      await PasswordResetModel.create({
        email: email.toLowerCase(),
        code,
        expiresAt,
      });
    }

    // Send reset code via email
    await emailService.sendPasswordResetCode(email, code, String(user.firstName));

    return {
      message: 'If an account with that email exists, a password reset code has been sent.',
      email: email.toLowerCase(),
    };
  }

  /**
   * Verify password reset code
   */
  async verifyPasswordResetCode(email: string, code: string): Promise<{ message: string; email: string }> {
    // Find reset record
    const reset = await PasswordResetModel.findOne({
      email: email.toLowerCase(),
      code,
      used: false,
      expiresAt: { $gt: new Date() },
    });

    if (!reset) {
      // Increment attempts if reset exists but code is wrong
      const existingReset = await PasswordResetModel.findOne({
        email: email.toLowerCase(),
        used: false,
        expiresAt: { $gt: new Date() },
      });

      if (existingReset) {
        (existingReset as any).attempts = Number((existingReset as any).attempts) + 1;
        const attempts = Number((existingReset as any).attempts);
        const maxAttempts = Number((existingReset as any).maxAttempts);
        if (attempts >= maxAttempts) {
          await PasswordResetModel.deleteOne({ _id: existingReset._id });
          throw new AuthenticationError('Too many failed attempts. Please request a new password reset code.');
        }
        await existingReset.save();
        throw new AuthenticationError('Invalid reset code. Please try again.');
      }

      throw new AuthenticationError('Invalid or expired reset code. Please request a new one.');
    }

    return {
      message: 'Reset code verified successfully',
      email: email.toLowerCase(),
    };
  }

  /**
   * Reset password with new password
   */
  async resetPassword(email: string, code: string, newPassword: string): Promise<{ message: string }> {
    // Find reset record
    const reset = await PasswordResetModel.findOne({
      email: email.toLowerCase(),
      code,
      used: false,
      expiresAt: { $gt: new Date() },
    });

    if (!reset) {
      throw new AuthenticationError('Invalid or expired reset code. Please request a new one.');
    }

    // Find user
    const user = await UserModel.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Mark reset as used and delete it
      await PasswordResetModel.deleteOne({ _id: reset._id });
      throw new NotFoundError('User not found');
    }

    // Hash new password
    const passwordHash = await hashPassword(newPassword);

    // Update user password and increment token version (invalidate all existing tokens)
    const currentTokenVersion = Number((user as any).tokenVersion) || 0;
    await UserModel.findByIdAndUpdate(user._id, {
      passwordHash,
      tokenVersion: currentTokenVersion + 1,
    });

    // Mark reset as used
    (reset as any).used = true;
    await reset.save();

    // Clean up reset record
    await PasswordResetModel.deleteOne({ _id: reset._id });

    // Log password reset
    await logSecurityEvent(
      String(user._id),
      'password_reset',
      `Password reset completed for ${user.email}`,
      undefined,
      'medium'
    );

    return {
      message: 'Password reset successfully. Please login with your new password.',
    };
  }

  /**
   * Resend password reset code
   */
  async resendPasswordResetCode(email: string): Promise<{ message: string; email: string }> {
    // Find existing reset
    const reset = await PasswordResetModel.findOne({
      email: email.toLowerCase(),
      used: false,
      expiresAt: { $gt: new Date() },
    });

    if (!reset) {
      throw new NotFoundError('No pending password reset found. Please request a new password reset.');
    }

    // Find user
    const user = await UserModel.findOne({ email: email.toLowerCase() });
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Generate new code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    (reset as any).code = code;
    (reset as any).expiresAt = expiresAt;
    (reset as any).attempts = 0;
    await reset.save();

    // Send reset code via email
    await emailService.sendPasswordResetCode(email, code, String(user.firstName));

    return {
      message: 'Password reset code resent to your email',
      email: email.toLowerCase(),
    };
  }

  private sanitizeUser(user: any): Omit<any, 'passwordHash'> {
    const { passwordHash, ...sanitized } = user.toObject();
    return sanitized;
  }
}

export const authService = new AuthService();

