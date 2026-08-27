import { prisma } from '../config/db';
import { hashPassword, comparePassword } from '../utils/password.util';
import { generateTokens } from '../utils/jwt.util';
import { AuthenticationError, NotFoundError, ConflictError } from '../utils/error.util';
import { emailService } from './email.service';
import { logSecurityEvent } from '../utils/activity-logger.util';
import crypto from 'crypto';
import type { RegisterRequest, LoginRequest, AuthResponse, UserWithRoles } from '../types/auth.types';
import {
  mapRole,
  mapUser,
  setUserMeta,
  getUserMeta,
  setVerification,
  findVerificationByToken,
  clearVerification,
  setReset,
  findResetByToken,
  clearReset,
  parsePrefJson,
} from '../utils/opendental-auth.util';
import { getNextId } from '../utils/opendental-ids.util';
import { PermissionService } from './permission.service';

export class AuthService {
  private async sanitizeUser(user: any) {
    const { passwordHash, ...rest } = user;
    return rest;
  }

  async initiateRegistration(data: RegisterRequest): Promise<{ message: string; email: string }> {
    const existingUser = await prisma.userod.findFirst({
      where: { UserName: data.email.toLowerCase() },
    });
    if (existingUser) {
      throw new ConflictError('User with this email already exists');
    }

    const tempPassword = crypto.randomBytes(32).toString('hex');
    const passwordHash = await hashPassword(tempPassword);

    const nextId = await getNextId('userod', 'UserNum');
    const user = await prisma.userod.create({
      data: {
        UserNum: nextId,
        UserName: data.email.toLowerCase(),
        Password: passwordHash,
        IsHidden: 1,
      },
    });

    await setUserMeta(user.UserNum, {
      email: data.email.toLowerCase(),
      passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone ?? null,
      preferredLanguage: data.preferredLanguage || 'en',
      isActive: false,
      tokenVersion: 0,
    });

    if (data.roleId) {
      const role = await prisma.usergroup.findUnique({
        where: { UserGroupNum: BigInt(data.roleId) },
      });
      if (!role) {
        await prisma.userod.delete({ where: { UserNum: user.UserNum } });
        throw new NotFoundError('Role not found or inactive');
      }
      const nextAttach = await getNextId('usergroupattach', 'UserGroupAttachNum');
      await prisma.usergroupattach.create({
        data: {
          UserGroupAttachNum: nextAttach,
          UserNum: user.UserNum,
          UserGroupNum: role.UserGroupNum,
        },
      });
    } else {
      const patientRole = await prisma.usergroup.findFirst({
        where: { Description: 'Patient' },
      });
      if (patientRole) {
        const nextAttach = await getNextId('usergroupattach', 'UserGroupAttachNum');
        await prisma.usergroupattach.create({
          data: {
            UserGroupAttachNum: nextAttach,
            UserNum: user.UserNum,
            UserGroupNum: patientRole.UserGroupNum,
          },
        });
      }
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await setVerification(user.UserNum, token, expiresAt);

    await emailService.sendRegistrationVerificationLink(data.email, token, data.firstName);

    return {
      message:
        'Verification link sent to your email. Please check your email to set your password and activate your account.',
      email: data.email.toLowerCase(),
    };
  }

  async verifyEmailAndRegister(token: string, password: string): Promise<AuthResponse> {
    const verification = await findVerificationByToken(token);
    if (!verification) {
      throw new AuthenticationError('Invalid or expired verification link. Please request a new one.');
    }

    const payload = parsePrefJson<{ token: string; expiresAt?: string }>(verification.ValueString);
    if (payload.expiresAt && new Date(payload.expiresAt) < new Date()) {
      throw new AuthenticationError('Invalid or expired verification link. Please request a new one.');
    }

    if (!verification.UserNum) {
      throw new NotFoundError('User not found');
    }

    const user = await prisma.userod.findUnique({
      where: { UserNum: verification.UserNum },
    });
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const meta = await getUserMeta(user.UserNum);
    if (meta.isActive) {
      await clearVerification(verification.UserOdPrefNum);
      throw new ConflictError('Account is already activated. Please login.');
    }

    const passwordHash = await hashPassword(password);
    await prisma.userod.update({
      where: { UserNum: user.UserNum },
      data: { Password: passwordHash, IsHidden: 0 },
    });

    await setUserMeta(user.UserNum, {
      ...meta,
      passwordHash,
      isActive: true,
    });

    await clearVerification(verification.UserOdPrefNum);

    const userWithRoles = await this.getUserWithRoles(user.UserNum.toString());
    const roles = userWithRoles.roles.map((r: any) => String(r.name));
    const tokens = generateTokens({
      userId: user.UserNum.toString(),
      email: meta.email || user.UserName || '',
      roles,
      tokenVersion: Number(meta.tokenVersion || 0),
    });

    await prisma.userod.update({
      where: { UserNum: user.UserNum },
      data: { DateTLastLogin: new Date() },
    });

    await logSecurityEvent(user.UserNum.toString(), 'login_success', `User registered and verified: ${meta.email}`);

    return {
      user: await this.sanitizeUser(await mapUser({ ...user, Password: passwordHash, IsHidden: 0 })),
      tokens,
    };
  }

  async resendVerificationCode(email: string): Promise<{ message: string; email: string }> {
    const user = await prisma.userod.findFirst({
      where: { UserName: email.toLowerCase() },
    });
    if (!user) {
      throw new NotFoundError('No pending verification found. Please start registration again.');
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await setVerification(user.UserNum, token, expiresAt);

    const meta = await getUserMeta(user.UserNum);
    await emailService.sendRegistrationVerificationLink(email, token, meta.firstName || '');

    return {
      message: 'Verification link sent to your email. Please check your email to set your password and activate your account.',
      email: email.toLowerCase(),
    };
  }

  async login(data: LoginRequest, ipAddress?: string): Promise<AuthResponse> {
    const user = await prisma.userod.findFirst({
      where: { UserName: data.email.toLowerCase() },
    });
    if (!user) {
      throw new AuthenticationError('Invalid credentials');
    }

    const meta = await getUserMeta(user.UserNum);
    if (meta.isActive === false || user.IsHidden) {
      throw new AuthenticationError('Account is inactive');
    }

    // HIPAA Account Lockout Check
    if (meta.accountLockedUntil) {
      const lockUntil = new Date(meta.accountLockedUntil);
      if (lockUntil > new Date()) {
        const remainingMs = lockUntil.getTime() - new Date().getTime();
        const remainingMinutes = Math.ceil(remainingMs / 60000);
        throw new AuthenticationError(`Account is locked due to too many failed attempts. Try again in ${remainingMinutes} minute(s).`);
      } else {
        // Lock expired, reset counters
        meta.failedLoginAttempts = 0;
        meta.accountLockedUntil = null;
      }
    }

    const isPasswordValid = await comparePassword(data.password, user.Password || meta.passwordHash || '');
    if (!isPasswordValid) {
      await logSecurityEvent(user.UserNum.toString(), 'login_failure', `Invalid login for ${data.email}`, ipAddress, 'medium');
      
      const attempts = (meta.failedLoginAttempts || 0) + 1;
      const updateMeta: any = { ...meta, failedLoginAttempts: attempts };
      
      console.log(`[AUTH DEBUG] Failed login attempts for ${data.email}: ${attempts}`);
      if (attempts >= 5) {
        console.log(`[AUTH DEBUG] Locking account for ${data.email}`);
        updateMeta.accountLockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      }
      await setUserMeta(user.UserNum, updateMeta);
      console.log(`[AUTH DEBUG] setUserMeta finished for ${data.email}`);
      
      if (attempts >= 5) {
        throw new AuthenticationError('Account locked due to too many failed attempts. Please wait 15 minutes.');
      }
      throw new AuthenticationError('Invalid credentials');
    }

    // Reset lockout counters on success
    if (meta.failedLoginAttempts || meta.accountLockedUntil) {
      await setUserMeta(user.UserNum, {
        ...meta,
        failedLoginAttempts: 0,
        accountLockedUntil: null,
      });
    }

    const userWithRoles = await this.getUserWithRoles(user.UserNum.toString());
    const roles = userWithRoles.roles.map((r: any) => String(r.name));

    // groupId/branchIds/isGroupAdmin are a display/convenience snapshot only
    // (see JWTPayload) — reusing the values getUserWithRoles just computed
    // fresh from the DB guarantees these claims exactly match what
    // GET /auth/profile returns for the same user at the same moment.
    // Nothing authorization-sensitive may trust them: resolveBranchAccess
    // still resolves fresh from the DB on every request, unchanged.
    const tokens = generateTokens({
      userId: user.UserNum.toString(),
      email: meta.email || user.UserName || '',
      roles,
      tokenVersion: Number(meta.tokenVersion || 0),
      groupId: userWithRoles.groupId,
      branchIds: userWithRoles.branchIds,
      isGroupAdmin: userWithRoles.isGroupAdmin,
    });

    await prisma.userod.update({
      where: { UserNum: user.UserNum },
      data: { DateTLastLogin: new Date() },
    });

    await logSecurityEvent(user.UserNum.toString(), 'login_success', `User logged in: ${data.email}`, ipAddress, 'low');

    return {
      user: await this.sanitizeUser(await mapUser(user)),
      tokens,
    };
  }

  async getUserWithRoles(userId: string): Promise<UserWithRoles> {
    const user = await prisma.userod.findUnique({
      where: { UserNum: BigInt(userId) },
    });
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const mapped = await mapUser(user);
    const userRoles = await prisma.usergroupattach.findMany({
      where: { UserNum: BigInt(userId) },
      include: { usergroup: true },
    });
    const roles = await Promise.all(
      userRoles
        .map((ur) => ur.usergroup)
        .filter(Boolean)
        .map((r) => mapRole(r))
    );

    const branchAccess = await PermissionService.getBranchAccess(userId);

    return {
      ...(await this.sanitizeUser(mapped)),
      roles,
      groupId: branchAccess.groupId,
      branchIds: branchAccess.clinicIds.map((c) => c.toString()),
      isGroupAdmin: branchAccess.isGroupAdmin,
    } as UserWithRoles;
  }

  async requestPasswordReset(email: string): Promise<{ message: string; email: string }> {
    const user = await prisma.userod.findFirst({
      where: { UserName: email.toLowerCase() },
    });
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const token = crypto.randomInt(100000, 1000000).toString(); // 6-digit numeric code
const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
await setReset(user.UserNum, token, expiresAt);

await emailService.sendPasswordResetCode(email, token);
    return { message: 'Password reset link sent', email: email.toLowerCase() };
  }

  async resendPasswordResetCode(email: string): Promise<{ message: string; email: string }> {
    return this.requestPasswordReset(email);
  }

  async verifyPasswordResetCode(email: string, code: string): Promise<{ message: string }> {
    const reset = await findResetByToken(code);
    if (!reset) {
      throw new AuthenticationError('Invalid or expired reset code');
    }

    const user = await prisma.userod.findFirst({
      where: { UserName: email.toLowerCase() },
    });
    if (!user || reset.UserNum?.toString() !== user.UserNum.toString()) {
      throw new AuthenticationError('Invalid or expired reset code');
    }

    const payload = parsePrefJson<{ token: string; expiresAt?: string }>(reset.ValueString);
    if (payload.expiresAt && new Date(payload.expiresAt) < new Date()) {
      throw new AuthenticationError('Invalid or expired reset code');
    }

    return { message: 'Reset code verified' };
  }

  async resetPassword(email: string, code: string, newPassword: string): Promise<{ message: string }> {
    const reset = await findResetByToken(code);
    if (!reset) {
      throw new AuthenticationError('Invalid or expired reset code');
    }

    const user = await prisma.userod.findFirst({
      where: { UserName: email.toLowerCase() },
    });
    if (!user || reset.UserNum?.toString() !== user.UserNum.toString()) {
      throw new AuthenticationError('Invalid or expired reset code');
    }

    const payload = parsePrefJson<{ token: string; expiresAt?: string }>(reset.ValueString);
    if (payload.expiresAt && new Date(payload.expiresAt) < new Date()) {
      throw new AuthenticationError('Invalid or expired reset code');
    }

    const passwordHash = await hashPassword(newPassword);
    await prisma.userod.update({
      where: { UserNum: user.UserNum },
      data: { Password: passwordHash },
    });

    const meta = await getUserMeta(user.UserNum);
    await setUserMeta(user.UserNum, {
      ...meta,
      passwordHash,
      tokenVersion: (meta.tokenVersion || 0) + 1,
    });

    await clearReset(reset.UserOdPrefNum);

    await logSecurityEvent(user.UserNum.toString(), 'password_reset', `Password reset for ${email}`);

    return { message: 'Password reset successfully' };
  }
}

export const authService = new AuthService();
