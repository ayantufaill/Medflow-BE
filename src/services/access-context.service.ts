import { prisma } from '../config/db';
import {
  DEFAULT_SHARING_POLICY,
  serializeSharing,
  type AccessContext,
  type SharingCategory,
  type SharingMode,
  SHARING_CATEGORIES,
  SHARING_MODES,
} from '../types/access.types';
import { GROUP_ADMIN_PERMISSIONS } from '../types/auth.types';
import { getRolesMeta, getUserMeta, mapRole } from '../utils/opendental-auth.util';

const TTL_MS = 60_000;
const cache = new Map<string, AccessContext>();

const isTruthyPermission = (value: unknown): boolean => {
  if (value === true) return true;
  return Boolean(value && typeof value === 'object' && (value as { allowed?: unknown }).allowed === true);
};

const normalizeSharing = (rows: Array<{ category: string; mode: string }>): Record<SharingCategory, SharingMode> => {
  const policy: Record<SharingCategory, SharingMode> = { ...DEFAULT_SHARING_POLICY };
  for (const row of rows) {
    const category = row.category as SharingCategory;
    const mode = row.mode as SharingMode;
    if ((SHARING_CATEGORIES as readonly string[]).includes(category) && (SHARING_MODES as readonly string[]).includes(mode)) {
      policy[category] = mode;
    }
  }
  return policy;
};

export class AccessContextService {
  static clear(userId?: string | bigint): void {
    if (userId === undefined) {
      cache.clear();
      return;
    }

    const prefix = `${userId.toString()}:`;
    for (const key of cache.keys()) {
      if (key.startsWith(prefix)) cache.delete(key);
    }
  }

  static async load(userId: string, tokenVersion = 0): Promise<AccessContext> {
    const key = `${userId}:${tokenVersion}`;
    const cached = cache.get(key);
    if (cached && Date.now() - cached.builtAt < TTL_MS) {
      return cached;
    }

    const userNum = BigInt(userId);
    const [user, attachments, assignments] = await Promise.all([
      prisma.userod.findUnique({ where: { UserNum: userNum }, select: { UserNum: true, UserName: true, ClinicNum: true } }),
      prisma.usergroupattach.findMany({ where: { UserNum: userNum }, include: { usergroup: true } }),
      prisma.userclinic.findMany({ where: { UserNum: userNum }, select: { ClinicNum: true } }),
    ]);

    if (!user) {
      throw new Error('User not found');
    }

    const groups = attachments
      .map((attachment) => attachment.usergroup)
      .filter((group): group is NonNullable<typeof group> => group !== null);
    const roleIds = groups.map((group) => group.UserGroupNum);
    const roleMetaMap = await getRolesMeta(roleIds);
    const roles = (
      await Promise.all(groups.map((group) => mapRole(group, roleMetaMap[group.UserGroupNum.toString()] ?? {})))
    ).filter((role) => role.isActive !== false);
    const roleNames = roles.map((role) => role.name);

    const permissions = await this.loadPermissions(roleIds, roles);

    const ownClinicIds = new Set<bigint>();
    for (const assignment of assignments) {
      if (assignment.ClinicNum !== null) ownClinicIds.add(assignment.ClinicNum);
    }
    if (user.ClinicNum !== null) ownClinicIds.add(user.ClinicNum);

    const clinicIds = Array.from(ownClinicIds);
    const [firstClinicId] = clinicIds;
    const homeClinic = firstClinicId
      ? await prisma.clinic.findUnique({ where: { ClinicNum: firstClinicId }, select: { GroupNum: true } })
      : null;
    const groupId = homeClinic?.GroupNum ?? null;

    let groupClinicIds = clinicIds;
    if (groupId !== null) {
      const groupClinics = await prisma.clinic.findMany({
        where: { GroupNum: groupId },
        select: { ClinicNum: true },
      });
      groupClinicIds = groupClinics.map((clinic) => clinic.ClinicNum);
    }

    const isBranchAdminOnly =
      roleNames.includes('Branch Admin') && !roleNames.includes('Group Admin') && !roleNames.includes('Super Admin');
    const isGroupAdmin = !isBranchAdminOnly && (
      roleNames.includes('Group Admin') ||
      roleNames.includes('Super Admin') ||
      roleNames.includes('Admin') ||
      permissions.has('*') ||
      Object.values(GROUP_ADMIN_PERMISSIONS).some((permission) => permissions.has(permission))
    );

    const profile = await (prisma as any).user_access_profile?.findUnique?.({ where: { user_num: userNum } });
    const isPlatformAdmin = profile?.is_platform_admin === true || roleNames.includes('Super Admin');
    const accessAllClinics = profile?.access_all_clinics === true;

    const sharingRows = groupId === null
      ? []
      : await (prisma as any).group_sharing_policy?.findMany?.({
        where: { group_id: groupId, clinic_id: null },
        select: { category: true, mode: true },
      }) ?? [];

    let sharing = normalizeSharing(sharingRows);
    
    // Gate sharing based on practicegroup.config.sharingEnabled
    if (groupId !== null) {
      const group = await prisma.practicegroup.findUnique({
        where: { id: groupId },
        select: { config: true },
      });
      const config = (group?.config as Record<string, unknown>) || {};
      if (config.sharingEnabled !== true) {
        sharing = {
          IDENTITY: 'OWN_BRANCH',
          CLINICAL: 'OWN_BRANCH',
          IMAGING: 'OWN_BRANCH',
          APPOINTMENTS: 'OWN_BRANCH',
          FINANCIAL: 'OWN_BRANCH',
          INSURANCE: 'OWN_BRANCH',
        };
      }
    }

    const meta = await getUserMeta(userNum);
    const access: AccessContext = {
      userId,
      tokenVersion,
      email: user.UserName ?? '',
      roles: roleNames,
      permissions,
      clinicIds: isGroupAdmin ? groupClinicIds : clinicIds,
      defaultClinicId: user.ClinicNum ?? null,
      groupClinicIds,
      groupId,
      isGroupAdmin,
      accessAllClinics,
      isPlatformAdmin,
      sharing,
      sharingSpec: serializeSharing(sharing),
      builtAt: Date.now(),
    };

    if (typeof meta.tokenVersion === 'number' && meta.tokenVersion !== tokenVersion) {
      access.tokenVersion = meta.tokenVersion;
    }

    cache.set(key, access);
    return access;
  }

  private static async loadPermissions(roleIds: bigint[], roles: Array<{ permissions?: Record<string, unknown> }>): Promise<Set<string>> {
    const permissions = new Set<string>();
    const readFromTables = process.env.RBAC_READ_FROM_TABLES === 'true';

    if (readFromTables && roleIds.length > 0) {
      const rows = await (prisma as any).role_permission?.findMany?.({
        where: { role_id: { in: roleIds } },
        select: { permission_key: true },
      }) ?? [];
      if (rows.length > 0) {
        rows.forEach((row: { permission_key: string }) => permissions.add(row.permission_key));
        return permissions;
      }
    }

    for (const role of roles) {
      for (const [permission, allowed] of Object.entries(role.permissions ?? {})) {
        if (isTruthyPermission(allowed)) permissions.add(permission);
      }
    }

    return permissions;
  }
}
