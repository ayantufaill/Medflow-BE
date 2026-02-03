import { prisma } from '../config/db';
import { hashPassword, comparePassword } from '../utils/password.util';
import { NotFoundError, ConflictError } from '../utils/error.util';
import { logActivity, logSecurityEvent } from '../utils/activity-logger.util';
import { getNextId } from '../utils/opendental-ids.util';
import {
  mapRole,
  mapUser,
  setUserMeta,
  getUserMeta,
  setVerification,
  findVerificationByToken,
  clearVerification,
  parsePrefJson,
} from '../utils/opendental-auth.util';
import type { UserWithRoles, AppUser } from '../types/auth.types';
import crypto from 'crypto';
import { emailService } from './email.service';

const sanitizeUser = (user: AppUser) => {
  const { passwordHash, ...rest } = user;
  return rest;
};

export class UserService {
  async getAllUsers(page = 1, limit = 10, search?: string, roleId?: string, status?: string) {
    const skip = (page - 1) * limit;

    let userIdsWithRole: string[] = [];
    if (roleId) {
      const userRoles = await prisma.usergroupattach.findMany({
        where: { UserGroupNum: BigInt(roleId) },
        select: { UserNum: true },
      });
      userIdsWithRole = userRoles
        .map((ur) => ur.UserNum?.toString())
        .filter((id): id is string => Boolean(id));
      if (userIdsWithRole.length === 0) {
        return {
          users: [],
          pagination: { page, limit, total: 0, pages: 0 },
        };
      }
    }

    const where: any = {};
    if (userIdsWithRole.length > 0) {
      where.UserNum = { in: userIdsWithRole.map((id) => BigInt(id)) };
    }

    if (status) {
      where.IsHidden = status === 'active' ? 0 : 1;
    }

    const [rows, total] = await Promise.all([
      prisma.userod.findMany({
        where,
        orderBy: { UserNum: 'desc' },
        skip,
        take: limit,
      }),
      prisma.userod.count({ where }),
    ]);

    let users = await Promise.all(rows.map(mapUser));

    if (search) {
      const searchLower = search.toLowerCase();
      users = users.filter((user) => {
        const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
        return (
          user.email.toLowerCase().includes(searchLower) ||
          fullName.includes(searchLower) ||
          (user.phone || '').toLowerCase().includes(searchLower)
        );
      });
    }

    const userIds = users.map((user) => BigInt(user._id));
    const userRoles = await prisma.usergroupattach.findMany({
      where: { UserNum: { in: userIds } },
      include: { usergroup: true },
    });

    const usersWithRoles = await Promise.all(
      users.map(async (user) => {
        const roleIds = userRoles
          .filter((ur) => ur.UserNum?.toString() === user._id)
          .map((ur) => ur.usergroup)
          .filter(Boolean);
        const roles = await Promise.all(roleIds.map(mapRole));
        return { ...sanitizeUser(user), roles };
      })
    );

    return {
      users: usersWithRoles,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getUsersByRoleName(
    roleName: string,
    page = 1,
    limit = 10,
    status?: string,
    excludeWithProvider?: boolean
  ) {
    const role = await prisma.usergroup.findFirst({
      where: { Description: roleName },
    });
    if (!role) {
      return { users: [], pagination: { page, limit, total: 0, pages: 0 } };
    }

    return this.getAllUsers(page, limit, undefined, role.UserGroupNum.toString(), status);
  }

  async getUserById(userId: string): Promise<UserWithRoles> {
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
        .map(mapRole)
    );

    return { ...sanitizeUser(mapped), roles } as UserWithRoles;
  }

  async updateUser(
    userId: string,
    updates: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      preferredLanguage?: string;
      isActive?: boolean;
    },
    requestInfo?: { ipAddress?: string; userAgent?: string }
  ) {
    const user = await prisma.userod.findUnique({
      where: { UserNum: BigInt(userId) },
    });
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const meta = await getUserMeta(user.UserNum);
    const oldValues = {
      firstName: meta.firstName ?? '',
      lastName: meta.lastName ?? '',
      phone: meta.phone ?? null,
      preferredLanguage: meta.preferredLanguage ?? 'en',
      isActive: meta.isActive ?? (user.IsHidden ? false : true),
    };

    const nextMeta = {
      ...meta,
      firstName: updates.firstName ?? meta.firstName,
      lastName: updates.lastName ?? meta.lastName,
      phone: updates.phone ?? meta.phone,
      preferredLanguage: updates.preferredLanguage ?? meta.preferredLanguage,
      isActive: updates.isActive ?? meta.isActive,
    };

    await setUserMeta(user.UserNum, nextMeta);

    if (updates.isActive !== undefined) {
      await prisma.userod.update({
        where: { UserNum: user.UserNum },
        data: { IsHidden: updates.isActive ? 0 : 1 },
      });
    }

    await logActivity(
      userId,
      'updated',
      'users',
      userId,
      oldValues,
      updates,
      requestInfo?.ipAddress,
      requestInfo?.userAgent,
      updates.isActive !== undefined ? 'medium' : 'low'
    );

    const updated = await mapUser({ ...user, IsHidden: updates.isActive ? 0 : user.IsHidden });
    return sanitizeUser(updated);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.userod.findUnique({
      where: { UserNum: BigInt(userId) },
    });
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const meta = await getUserMeta(user.UserNum);
    const isPasswordValid = await comparePassword(currentPassword, user.Password || meta.passwordHash || '');

    if (!isPasswordValid) {
      throw new Error('Current password is incorrect');
    }

    const newHash = await hashPassword(newPassword);
    await prisma.userod.update({
      where: { UserNum: user.UserNum },
      data: { Password: newHash },
    });

    await setUserMeta(user.UserNum, {
      ...meta,
      passwordHash: newHash,
      tokenVersion: (meta.tokenVersion || 0) + 1,
    });

    await logSecurityEvent(userId, 'password_change', `Password changed for user ${userId}`, undefined, 'medium');

    return { message: 'Password updated successfully' };
  }

  async assignRole(userId: string, roleId: string, assignedBy: string) {
    const user = await prisma.userod.findUnique({
      where: { UserNum: BigInt(userId) },
    });
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const role = await prisma.usergroup.findUnique({
      where: { UserGroupNum: BigInt(roleId) },
    });
    if (!role) {
      throw new NotFoundError('Role not found');
    }

    const existing = await prisma.usergroupattach.findFirst({
      where: { UserNum: user.UserNum, UserGroupNum: role.UserGroupNum },
    });
    if (existing) {
      throw new ConflictError('User already has this role');
    }

    const nextId = await getNextId('usergroupattach', 'UserGroupAttachNum');
    await prisma.usergroupattach.create({
      data: {
        UserGroupAttachNum: nextId,
        UserNum: user.UserNum,
        UserGroupNum: role.UserGroupNum,
      },
    });

    return { message: 'Role assigned successfully' };
  }

  async removeRole(userId: string, roleId: string) {
    const userRole = await prisma.usergroupattach.findFirst({
      where: { UserNum: BigInt(userId), UserGroupNum: BigInt(roleId) },
    });
    if (!userRole) {
      throw new NotFoundError('Role assignment not found');
    }

    await prisma.usergroupattach.delete({
      where: { UserGroupAttachNum: userRole.UserGroupAttachNum },
    });

    return { message: 'Role removed successfully' };
  }

  async createUser(
    data: {
      email: string;
      firstName: string;
      lastName: string;
      phone?: string;
      preferredLanguage?: string;
      roleIds?: string[];
    },
    createdBy: string
  ) {
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

    if (data.roleIds && data.roleIds.length > 0) {
      for (const roleId of data.roleIds) {
        const role = await prisma.usergroup.findUnique({
          where: { UserGroupNum: BigInt(roleId) },
        });
        if (!role) continue;
        const nextAttach = await getNextId('usergroupattach', 'UserGroupAttachNum');
        await prisma.usergroupattach.create({
          data: {
            UserGroupAttachNum: nextAttach,
            UserNum: user.UserNum,
            UserGroupNum: role.UserGroupNum,
          },
        });
      }
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await setVerification(user.UserNum, token, expiresAt);

    await emailService.sendRegistrationVerificationLink(data.email, token, data.firstName);

    return { message: 'User created. Verification link sent.' };
  }

  async verifyTokenAndSetPassword(token: string, password: string) {
    const verification = await findVerificationByToken(token);
    if (!verification) {
      throw new NotFoundError('Invalid or expired verification token');
    }

    const payload = parsePrefJson<{ token: string; expiresAt?: string }>(verification.ValueString);
    if (payload.expiresAt && new Date(payload.expiresAt) < new Date()) {
      throw new NotFoundError('Invalid or expired verification token');
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

    const newHash = await hashPassword(password);
    await prisma.userod.update({
      where: { UserNum: user.UserNum },
      data: { Password: newHash, IsHidden: 0 },
    });

    const meta = await getUserMeta(user.UserNum);
    await setUserMeta(user.UserNum, {
      ...meta,
      passwordHash: newHash,
      isActive: true,
    });

    await clearVerification(verification.UserOdPrefNum);

    return { message: 'Password set successfully' };
  }

  async deleteUser(userId: string, deletedBy: string) {
    const user = await prisma.userod.findUnique({
      where: { UserNum: BigInt(userId) },
    });
    if (!user) {
      throw new NotFoundError('User not found');
    }

    await prisma.usergroupattach.deleteMany({ where: { UserNum: user.UserNum } });
    await prisma.userodpref.deleteMany({ where: { UserNum: user.UserNum } });
    await prisma.userod.delete({ where: { UserNum: user.UserNum } });

    await logActivity(deletedBy, 'deleted', 'users', userId, null, null);

    return { message: 'User deleted successfully' };
  }

  async activateUser(userId: string) {
    const user = await prisma.userod.findUnique({
      where: { UserNum: BigInt(userId) },
    });
    if (!user) {
      throw new NotFoundError('User not found');
    }

    await prisma.userod.update({
      where: { UserNum: user.UserNum },
      data: { IsHidden: 0 },
    });

    const meta = await getUserMeta(user.UserNum);
    await setUserMeta(user.UserNum, { ...meta, isActive: true });

    return { message: 'User activated successfully' };
  }

  async deactivateUser(userId: string) {
    const user = await prisma.userod.findUnique({
      where: { UserNum: BigInt(userId) },
    });
    if (!user) {
      throw new NotFoundError('User not found');
    }

    await prisma.userod.update({
      where: { UserNum: user.UserNum },
      data: { IsHidden: 1 },
    });

    const meta = await getUserMeta(user.UserNum);
    await setUserMeta(user.UserNum, { ...meta, isActive: false });

    return { message: 'User deactivated successfully' };
  }

  async getUserActivity(userId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const logs = await prisma.securitylog.findMany({
      where: { UserNum: BigInt(userId) },
      orderBy: { LogDateTime: 'desc' },
      skip,
      take: limit,
    });

    const activities = logs
      .map((log) => {
        try {
          const payload = JSON.parse(log.LogText || '{}');
          return { ...payload, occurredAt: log.LogDateTime };
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    return { activities, pagination: { page, limit, total: activities.length, pages: Math.ceil(activities.length / limit) } };
  }

  async getUserLoginHistory(userId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const logs = await prisma.securitylog.findMany({
      where: { UserNum: BigInt(userId) },
      orderBy: { LogDateTime: 'desc' },
      skip,
      take: limit,
    });

    const history = logs
      .map((log) => {
        try {
          const payload = JSON.parse(log.LogText || '{}');
          if (payload.type !== 'security_event') return null;
          return { ...payload, occurredAt: log.LogDateTime };
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    return { history, pagination: { page, limit, total: history.length, pages: Math.ceil(history.length / limit) } };
  }
}

export const userService = new UserService();
