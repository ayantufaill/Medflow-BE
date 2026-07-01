import { prisma } from '../config/db';
import { NotFoundError, ConflictError } from '../utils/error.util';
import type { AppRole } from '../types/auth.types';
import { getRoleMeta, mapRole, mapUser, setRoleMeta, getRolesMeta, getUsersMeta } from '../utils/opendental-auth.util';
import { getNextId } from '../utils/opendental-ids.util';

export class RoleService {
  async getAllRoles(page = 1, limit = 100, search?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (search) {
      where.Description = { contains: search };
    }

    const [rows, total] = await Promise.all([
      prisma.usergroup.findMany({
        where,
        orderBy: { Description: 'asc' },
        skip,
        take: limit,
      }),
      prisma.usergroup.count({ where }),
    ]);

    const roleNums = rows.map((r) => r.UserGroupNum);
    const roleMetaMap = await getRolesMeta(roleNums);
    const roles = await Promise.all(
      rows.map((row) => mapRole(row, roleMetaMap[row.UserGroupNum.toString()]))
    );
    const activeRoles = roles.filter((role) => role.isActive !== false);

    return {
      roles: activeRoles,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getRoleById(roleId: string): Promise<AppRole> {
    const role = await prisma.usergroup.findUnique({
      where: { UserGroupNum: BigInt(roleId) },
    });
    if (!role) {
      throw new NotFoundError('Role not found');
    }
    return mapRole(role);
  }

  async getRoleByName(name: string): Promise<AppRole | null> {
    const role = await prisma.usergroup.findFirst({
      where: { Description: name },
    });
    if (!role) return null;
    const mapped = await mapRole(role);
    return mapped.isActive === false ? null : mapped;
  }

  async createRole(data: {
    name: string;
    description?: string;
    permissions?: Map<string, boolean> | Record<string, boolean>;
    isSystemRole?: boolean;
  }): Promise<AppRole> {
    const existingRole = await prisma.usergroup.findFirst({
      where: { Description: data.name },
    });
    if (existingRole) {
      throw new ConflictError('Role with this name already exists');
    }

    let permissions = data.permissions;
    if (permissions instanceof Map) {
      permissions = Object.fromEntries(permissions);
    }

    const nextId = await getNextId('usergroup', 'UserGroupNum');
    const role = await prisma.usergroup.create({
      data: {
        UserGroupNum: nextId,
        Description: data.name,
      },
    });

    await setRoleMeta(role.UserGroupNum, {
      description: data.description ?? null,
      permissions: permissions || {},
      isSystemRole: data.isSystemRole || false,
      isActive: true,
    });

    return mapRole(role);
  }

  async updateRole(
    roleId: string,
    updates: {
      name?: string;
      description?: string;
      permissions?: Map<string, boolean> | Record<string, boolean>;
      isActive?: boolean;
    }
  ): Promise<AppRole> {
    const role = await prisma.usergroup.findUnique({
      where: { UserGroupNum: BigInt(roleId) },
    });
    if (!role) {
      throw new NotFoundError('Role not found');
    }

    const meta = await getRoleMeta(role.UserGroupNum);
    if (meta.isSystemRole && updates.name) {
      throw new ConflictError('Cannot update name of system role');
    }

    if (updates.name && updates.name !== role.Description) {
      const existingRole = await prisma.usergroup.findFirst({
        where: { Description: updates.name },
      });
      if (existingRole) {
        throw new ConflictError('Role with this name already exists');
      }
    }

    if (updates.permissions instanceof Map) {
      updates.permissions = Object.fromEntries(updates.permissions);
    }

    const updated = await prisma.usergroup.update({
      where: { UserGroupNum: role.UserGroupNum },
      data: {
        Description: updates.name ?? undefined,
      },
    });

    await setRoleMeta(role.UserGroupNum, {
      ...meta,
      description: updates.description ?? meta.description ?? null,
      permissions: updates.permissions ?? meta.permissions ?? {},
      isActive: updates.isActive ?? meta.isActive ?? true,
    });

    return mapRole(updated);
  }

  async deleteRole(roleId: string): Promise<void> {
    const role = await prisma.usergroup.findUnique({
      where: { UserGroupNum: BigInt(roleId) },
    });
    if (!role) {
      throw new NotFoundError('Role not found');
    }

    const meta = await getRoleMeta(role.UserGroupNum);
    if (meta.isSystemRole) {
      throw new ConflictError('Cannot delete system role');
    }

    const userRolesCount = await prisma.usergroupattach.count({
      where: { UserGroupNum: role.UserGroupNum },
    });
    if (userRolesCount > 0) {
      await setRoleMeta(role.UserGroupNum, { ...meta, isActive: false });
    } else {
      await prisma.usergroup.delete({ where: { UserGroupNum: role.UserGroupNum } });
    }
  }

  async getUsersWithRole(roleId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [userRoles, total] = await Promise.all([
      prisma.usergroupattach.findMany({
        where: { UserGroupNum: BigInt(roleId) },
        orderBy: { UserGroupAttachNum: 'desc' },
        skip,
        take: limit,
        include: { userod: true },
      }),
      prisma.usergroupattach.count({ where: { UserGroupNum: BigInt(roleId) } }),
    ]);

    const userNums = userRoles
      .map((ur) => ur.userod?.UserNum)
      .filter((num): num is bigint => num !== undefined && num !== null);
    const userMetaMap = await getUsersMeta(userNums);

    return {
      users: await Promise.all(
        userRoles.map(async (ur) => ({
          user: ur.userod ? await mapUser(ur.userod, userMetaMap[ur.userod.UserNum.toString()]) : null,
          assignedAt: null,
          assignedBy: null,
        }))
      ),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }
}

export const roleService = new RoleService();
