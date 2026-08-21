import { prisma } from '../config/db';
import { hashPassword, comparePassword } from '../utils/password.util';
import { NotFoundError, ConflictError, AuthorizationError } from '../utils/error.util';
import { PermissionService } from './permission.service';
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
  getUsersMeta,
  getRolesMeta,
} from '../utils/opendental-auth.util';
import type { UserWithRoles, AppUser } from '../types/auth.types';
import crypto from 'crypto';
import { emailService } from './email.service';

const sanitizeUser = (user: AppUser) => {
  const { passwordHash, ...rest } = user;
  return rest;
};

export class UserService {
  async getAllUsers(
    page = 1,
    limit = 10,
    search?: string,
    roleId?: string,
    status?: string,
    clinicIds?: bigint[],
    branchId?: string
  ) {
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

    // A user's own branch(es) = their userclinic assignments plus their
    // userod.ClinicNum home clinic (same definition PermissionService uses
    // for branchIds reported per user below). branchId narrows to that one
    // clinic, but never *widens* past the caller's own resolved scope
    // (clinicIds) — a branchId outside that scope returns an empty result
    // rather than leaking whether the branch exists. No branchId falls back
    // to the caller's full scope, same as before; callers with no clinic
    // assignments yet (clinicIds empty) are left unscoped so existing
    // single-clinic practices are unaffected.
    if (branchId) {
      const requestedClinicNum = BigInt(branchId);
      const inScope = !clinicIds || clinicIds.length === 0 || clinicIds.includes(requestedClinicNum);
      where.OR = inScope
        ? [
            { ClinicNum: requestedClinicNum },
            { userclinic: { some: { ClinicNum: requestedClinicNum } } },
          ]
        : [{ UserNum: -1n }];
    } else if (clinicIds && clinicIds.length > 0) {
      where.OR = [
        { ClinicNum: { in: clinicIds } },
        { userclinic: { some: { ClinicNum: { in: clinicIds } } } },
      ];
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

    const userNums = rows.map((r) => r.UserNum);
    const userMetaMap = await getUsersMeta(userNums);
    let users = await Promise.all(
      rows.map((row) => mapUser(row, userMetaMap[row.UserNum.toString()]))
    );

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

    const allRoleNums = Array.from(
      new Set(
        userRoles
          .map((ur) => ur.UserGroupNum)
          .filter((num): num is bigint => num !== null && num !== undefined)
      )
    );
    const roleMetaMap = await getRolesMeta(allRoleNums);

    const branchIdsByUser = await PermissionService.getAssignedBranchIdsBatch(users.map((u) => u._id));

    const usersWithRoles = await Promise.all(
      users.map(async (user) => {
        const roleGroups = userRoles
          .filter((ur) => ur.UserNum?.toString() === user._id)
          .map((ur) => ur.usergroup)
          .filter((ug): ug is NonNullable<typeof ug> => ug !== null && ug !== undefined);
        const roles = await Promise.all(
          roleGroups.map((role) => mapRole(role, roleMetaMap[role.UserGroupNum.toString()] ?? {}))
        );
        return { ...sanitizeUser(user), roles, branchIds: branchIdsByUser.get(user._id) ?? [] };
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
    const allRoleNums = userRoles.map(ur => ur.UserGroupNum).filter((num): num is bigint => num !== null && num !== undefined);
    const roleMetaMap = await getRolesMeta(allRoleNums);

    const roles = await Promise.all(
      userRoles
        .map((ur) => ur.usergroup)
        .filter((r): r is NonNullable<typeof r> => r !== null && r !== undefined)
        .map((r) => mapRole(r, roleMetaMap[r.UserGroupNum.toString()] ?? {}))
    );

    const [branchIds, branchAccess] = await Promise.all([
      PermissionService.getAssignedBranchIds(userId),
      PermissionService.getBranchAccess(userId),
    ]);

    return {
      ...sanitizeUser(mapped),
      roles,
      branchIds,
      groupId: branchAccess.groupId,
      isGroupAdmin: branchAccess.isGroupAdmin,
    } as UserWithRoles;
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
      password?: string;
      isActive?: boolean;
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

    const effectivePassword = data.password || crypto.randomBytes(32).toString('hex');
    const passwordHash = await hashPassword(effectivePassword);
    const isAccountActive = data.isActive ?? false;

    const nextId = await getNextId('userod', 'UserNum');
    const user = await prisma.userod.create({
      data: {
        UserNum: nextId,
        UserName: data.email.toLowerCase(),
        Password: passwordHash,
        IsHidden: isAccountActive ? 0 : 1,
      },
    });

    await setUserMeta(user.UserNum, {
      email: data.email.toLowerCase(),
      passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone ?? null,
      preferredLanguage: data.preferredLanguage || 'en',
      isActive: isAccountActive,
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

  async getUserActivity(
    userId: string,
    page = 1,
    limit = 20,
    search?: string,
    startDate?: string,
    endDate?: string
  ) {
    const where: any = { UserNum: BigInt(userId) };
    if (startDate || endDate) {
      where.LogDateTime = {};
      if (startDate) where.LogDateTime.gte = new Date(`${startDate}T00:00:00.000Z`);
      if (endDate) where.LogDateTime.lte = new Date(`${endDate}T23:59:59.999Z`);
    }

    const logs = await prisma.securitylog.findMany({
      where,
      orderBy: { LogDateTime: 'desc' },
      take: 1000,
    });

    const allActivities = logs
      .map((log) => {
        try {
          const payload = JSON.parse(log.LogText || '{}');
          if (payload.type === 'security_event' || payload.type === 'notification') {
            return null;
          }
          return {
            ...payload,
            _id: log.SecurityLogNum?.toString() || Math.random().toString(),
            id: log.SecurityLogNum?.toString() || Math.random().toString(),
            action: payload.action || payload.description || 'Activity',
            tableName: payload.tableName || payload.type || 'System',
            recordId: payload.recordId || '',
            ipAddress: payload.ipAddress || '-',
            riskLevel: payload.riskLevel || 'low',
            occurredAt: log.LogDateTime,
            createdAt: log.LogDateTime,
          };
        } catch {
          if (log.LogText?.toLowerCase().includes('login') || log.LogText?.toLowerCase().includes('security')) {
            return null;
          }
          return {
            _id: log.SecurityLogNum?.toString() || Math.random().toString(),
            id: log.SecurityLogNum?.toString() || Math.random().toString(),
            action: log.LogText || 'Activity',
            tableName: 'System',
            recordId: '',
            ipAddress: '-',
            riskLevel: 'low',
            occurredAt: log.LogDateTime,
            createdAt: log.LogDateTime,
          };
        }
      })
      .filter((item): item is NonNullable<typeof item> => {
        if (!item) return false;
        if (search) {
          const s = search.toLowerCase().trim();
          const target = JSON.stringify(item).toLowerCase();
          if (!target.includes(s)) return false;
        }
        return true;
      });

    const total = allActivities.length;
    const pages = Math.max(1, Math.ceil(total / limit));
    const skip = (page - 1) * limit;
    const activities = allActivities.slice(skip, skip + limit);

    return { activities, pagination: { page, limit, total, pages } };
  }

  async getUserLoginHistory(
    userId: string,
    page = 1,
    limit = 20,
    search?: string,
    startDate?: string,
    endDate?: string
  ) {
    const where: any = { UserNum: BigInt(userId) };
    if (startDate || endDate) {
      where.LogDateTime = {};
      if (startDate) where.LogDateTime.gte = new Date(`${startDate}T00:00:00.000Z`);
      if (endDate) where.LogDateTime.lte = new Date(`${endDate}T23:59:59.999Z`);
    }

    const logs = await prisma.securitylog.findMany({
      where,
      orderBy: { LogDateTime: 'desc' },
      take: 1000,
    });

    const allHistory = logs
      .map((log) => {
        try {
          const payload = JSON.parse(log.LogText || '{}');
          const isSec = payload.type === 'security_event' || payload.eventType || log.LogText?.toLowerCase().includes('login');
          if (!isSec) return null;
          return {
            ...payload,
            _id: log.SecurityLogNum?.toString() || Math.random().toString(),
            id: log.SecurityLogNum?.toString() || Math.random().toString(),
            eventType: payload.eventType || 'login_success',
            description: payload.description || 'Successful login session',
            ipAddress: payload.ipAddress || '-',
            riskLevel: payload.riskLevel || 'low',
            occurredAt: log.LogDateTime,
            createdAt: log.LogDateTime,
          };
        } catch {
          if (!log.LogText?.toLowerCase().includes('login')) return null;
          return {
            _id: log.SecurityLogNum?.toString() || Math.random().toString(),
            id: log.SecurityLogNum?.toString() || Math.random().toString(),
            eventType: 'login_success',
            description: log.LogText || 'Successful login session',
            ipAddress: '-',
            riskLevel: 'low',
            occurredAt: log.LogDateTime,
            createdAt: log.LogDateTime,
          };
        }
      })
      .filter((item): item is NonNullable<typeof item> => {
        if (!item) return false;
        if (search) {
          const s = search.toLowerCase().trim();
          const target = JSON.stringify(item).toLowerCase();
          if (!target.includes(s)) return false;
        }
        return true;
      });

    const total = allHistory.length;
    const pages = Math.max(1, Math.ceil(total / limit));
    const skip = (page - 1) * limit;
    const history = allHistory.slice(skip, skip + limit);

    return { loginHistory: history, history, pagination: { page, limit, total, pages } };
  }

  async assignUserRoles(userId: string, roleIds: string[]): Promise<void> {
    const userNum = BigInt(userId);
    const user = await prisma.userod.findUnique({
      where: { UserNum: userNum },
    });
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const bigIntRoleIds = roleIds.map((id) => BigInt(id));
    const roles = await prisma.usergroup.findMany({
      where: { UserGroupNum: { in: bigIntRoleIds } },
    });
    if (roles.length !== bigIntRoleIds.length) {
      throw new NotFoundError('One or more roles do not exist');
    }

    await prisma.$transaction(async (tx) => {
      // Delete existing attachments
      await tx.usergroupattach.deleteMany({
        where: { UserNum: userNum },
      });

      // Retrieve the starting UserGroupAttachNum
      const maxRow = await tx.$queryRawUnsafe<{ nextId: any }[]>(
        'SELECT COALESCE(MAX("UserGroupAttachNum"), 0) + 1 AS "nextId" FROM "usergroupattach"'
      );
      const rawId = maxRow[0]?.nextId;
      let nextAttachId = rawId ? BigInt(rawId) : 1n;

      // Add new attachments
      for (const roleId of bigIntRoleIds) {
        await tx.usergroupattach.create({
          data: {
            UserGroupAttachNum: nextAttachId,
            UserNum: userNum,
            UserGroupNum: roleId,
          },
        });
        nextAttachId += 1n;
      }
    });

    // Invalidate JWTs by incrementing user preference token version
    const meta = await getUserMeta(userNum);
    const nextVersion = (meta.tokenVersion || 0) + 1;
    await setUserMeta(userNum, { ...meta, tokenVersion: nextVersion });
  }

  /**
   * Sets the caller's current/default branch, persisted so it follows them
   * across devices (as opposed to the frontend's localStorage-only default).
   */
  async updateCurrentBranch(userId: string, branchId: string): Promise<{ branchId: string }> {
    const clinicNum = BigInt(branchId);
    const clinic = await prisma.clinic.findUnique({ where: { ClinicNum: clinicNum } });
    if (!clinic || clinic.IsHidden === 1) {
      throw new NotFoundError('Branch not found.');
    }

    const branchAccess = await PermissionService.getBranchAccess(userId);
    if (branchAccess.clinicIds.length > 0 && !branchAccess.clinicIds.includes(clinicNum)) {
      throw new AuthorizationError('You do not have access to this branch.');
    }

    const meta = await getUserMeta(BigInt(userId));
    await setUserMeta(BigInt(userId), { ...meta, currentBranchId: branchId });

    return { branchId };
  }

  /**
   * Resyncs an *existing* user's userclinic rows to exactly branchIds.
   * Authorization (who may do this, for which branches) is the caller's
   * responsibility — see PermissionService.assertCanManageBranchAssignment,
   * checked in the controller before this runs.
   */
  async updateUserBranches(userId: string, branchIds: string[]): Promise<{ branchIds: string[] }> {
    const user = await prisma.userod.findUnique({ where: { UserNum: BigInt(userId) } });
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const uniqueBranchIds = Array.from(new Set(branchIds));
    if (uniqueBranchIds.length > 0) {
      const clinics = await prisma.clinic.findMany({
        where: { ClinicNum: { in: uniqueBranchIds.map((id) => BigInt(id)) } },
      });
      if (clinics.length !== uniqueBranchIds.length) {
        throw new NotFoundError('One or more branches were not found.');
      }
    }

    await prisma.userclinic.deleteMany({ where: { UserNum: BigInt(userId) } });
    for (const branchId of uniqueBranchIds) {
      const nextId = await getNextId('userclinic', 'UserClinicNum');
      await prisma.userclinic.create({
        data: { UserClinicNum: nextId, UserNum: BigInt(userId), ClinicNum: BigInt(branchId) },
      });
    }

    return { branchIds: uniqueBranchIds };
  }
}

export const userService = new UserService();
