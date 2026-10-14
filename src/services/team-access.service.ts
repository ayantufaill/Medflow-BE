/**
 * Team Access — per-member module overrides managed by a group_admin or
 * branch_admin for the people on their team. Stored on the member's user meta
 * as `moduleAccess` ({ [moduleKey]: 'none' | 'view' | 'full' }; a module left
 * out follows the role). AccessContextService applies it on every request.
 */
import { prisma } from '../config/db';
import type { AccessContext } from '../types/access.types';
import { AuthorizationError, ValidationError } from '../utils/error.util';
import { getRolesMeta, getUserMeta, setUserMeta } from '../utils/opendental-auth.util';
import { assertUserInScope } from './user.service';
import { bumpAccessVersion } from './access-version.service';
import {
  TEAM_MODULES,
  ROLE_DEFAULT_LABELS,
  type ModuleLevel,
  matrixKeyForRoles,
  levelOfLabel,
  levelFromPermissions,
  isLevelWithin,
  isModuleLevel,
  sanitizeModuleAccess,
  sanitizeFeatureAccess,
  TEAM_FEATURES,
  featuresOf,
  type TeamFeature,
} from '../constants/team-modules';

type ActorKind = 'platform' | 'group' | 'branch';

const PLATFORM_ROLES = ['Super Admin', 'Admin'];
const GROUP_ADMIN_ROLES = ['group_admin', 'Group Admin'];
const BRANCH_ADMIN_ROLES = ['branch_admin', 'Branch Admin'];
const PATIENT_ROLES = ['Patient', 'patient'];

/**
 * Who each kind of admin may not touch: themselves, peers and anyone above.
 * A group admin manages branch admins; a branch admin manages staff only.
 */
const PROTECTED_ROLES: Record<ActorKind, string[]> = {
  platform: ['Super Admin', ...PATIENT_ROLES],
  group: [...PLATFORM_ROLES, ...GROUP_ADMIN_ROLES, ...PATIENT_ROLES],
  branch: [...PLATFORM_ROLES, ...GROUP_ADMIN_ROLES, ...BRANCH_ADMIN_ROLES, ...PATIENT_ROLES],
};

const actorKindOf = (access: AccessContext): ActorKind => {
  const roles = access.roles;
  if (access.isPlatformAdmin || roles.some((r) => PLATFORM_ROLES.includes(r))) return 'platform';
  if (roles.some((r) => GROUP_ADMIN_ROLES.includes(r))) return 'group';
  if (roles.some((r) => BRANCH_ADMIN_ROLES.includes(r))) return 'branch';
  throw new AuthorizationError('Only group and branch admins can manage team access.');
};

/**
 * The most this admin may hand out per module. Group admins (and platform
 * admins) may grant Full anywhere — including Clinical, which they only view
 * themselves. A branch admin is held to their own matrix column, so at most
 * "View" on Clinical and Finance.
 */
const actorCeiling = (kind: ActorKind): Record<string, ModuleLevel> => {
  const labels = kind === 'branch' ? ROLE_DEFAULT_LABELS.branch_admin : null;
  return Object.fromEntries(
    TEAM_MODULES.map((m) => [m.key, labels ? levelOfLabel(labels[m.key] ?? 'None') : 'full'])
  );
};

const rolesOf = async (userNum: bigint): Promise<{ names: string[]; ids: bigint[] }> => {
  const attachments = await prisma.usergroupattach.findMany({
    where: { UserNum: userNum },
    include: { usergroup: { select: { UserGroupNum: true, Description: true } } },
  });
  const groups = attachments.map((a) => a.usergroup).filter((g): g is NonNullable<typeof g> => g !== null);
  return { names: groups.map((g) => g.Description ?? '').filter(Boolean), ids: groups.map((g) => g.UserGroupNum) };
};

/** Every key the member's roles grant on their own — no overrides folded in. */
const rolePermissions = async (roleIds: bigint[]): Promise<Set<string>> => {
  const metas = await getRolesMeta(roleIds);
  const permissions = new Set<string>();
  for (const meta of Object.values(metas)) {
    for (const [key, value] of Object.entries((meta?.permissions ?? {}) as Record<string, unknown>)) {
      if (value === true || (value && typeof value === 'object' && (value as { allowed?: unknown }).allowed === true)) {
        permissions.add(key);
      }
    }
  }
  return permissions;
};

/**
 * The member's role default per module: the matrix wording when their role
 * is in the matrix, otherwise worked out from their roles' permission keys.
 */
const roleDefaults = (roleNames: string[], permissions: Set<string>): Record<string, string> => {
  const matrixKey = matrixKeyForRoles(roleNames);
  if (matrixKey) return ROLE_DEFAULT_LABELS[matrixKey];
  const label: Record<ModuleLevel, string> = { none: 'None', view: 'View', full: 'Full' };
  return Object.fromEntries(TEAM_MODULES.map((m) => [m.key, label[levelFromPermissions(permissions, m)]]));
};

/**
 * The level button that stands for the role default. Partial wordings
 * ("View, update", "Write notes") count as View; a module without View
 * (Reports) rounds a partial default up to Full.
 */
const defaultLevelFor = (levels: ModuleLevel[], label: string): ModuleLevel => {
  const level = levelOfLabel(label);
  return levels.includes(level) ? level : 'full';
};

/**
 * Whether the member's role alone gives a feature. Read from their role's
 * keys; when the role holds no key in the module at all (screens gated by
 * role name, e.g. a dentist's note templates), from the module's level.
 */
const featureRoleDefault = (f: TeamFeature, permissions: Set<string>, moduleLevel: ModuleLevel): boolean => {
  if (permissions.has('*')) return true;
  const moduleHasKeys = featuresOf(f.module).some((other) => other.permissions.some((p) => permissions.has(p)));
  if (moduleHasKeys) return f.permissions.some((p) => permissions.has(p));
  return moduleLevel === 'full' || (moduleLevel === 'view' && f.kind === 'read');
};

/** A read feature needs at least View on the module; a write feature needs Full. */
const featureWithin = (f: TeamFeature, ceiling: ModuleLevel): boolean =>
  f.kind === 'read' ? ceiling !== 'none' : ceiling === 'full';

const assertCanManage = async (access: AccessContext, actorKind: ActorKind, targetUserId: string, targetRoles: string[]) => {
  if (String(access.userId) === String(targetUserId)) {
    throw new AuthorizationError('You cannot change your own access.');
  }
  await assertUserInScope(targetUserId, access.clinicIds);
  const blocked = targetRoles.find((r) => PROTECTED_ROLES[actorKind].includes(r));
  if (blocked) {
    throw new AuthorizationError(`You cannot change access for a ${blocked.replace(/_/g, ' ')} account.`);
  }
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export const teamAccessService = {
  async getMemberAccess(access: AccessContext, targetUserId: string) {
    const actorKind = actorKindOf(access);
    const userNum = BigInt(targetUserId);
    const targetRoles = await rolesOf(userNum);
    await assertCanManage(access, actorKind, targetUserId, targetRoles.names);

    const [meta, permissions] = await Promise.all([getUserMeta(userNum), rolePermissions(targetRoles.ids)]);
    const defaults = roleDefaults(targetRoles.names, permissions);
    const ceiling = actorCeiling(actorKind);

    return {
      moduleAccess: sanitizeModuleAccess(meta.moduleAccess),
      featureAccess: sanitizeFeatureAccess(meta.featureAccess),
      modules: TEAM_MODULES.map((m) => {
        const roleDefaultLevel = defaultLevelFor(m.levels, defaults[m.key] ?? 'None');
        return {
          key: m.key,
          label: m.label,
          description: m.description,
          levels: m.levels,
          roleDefault: defaults[m.key] ?? 'None',
          roleDefaultLevel,
          maxLevel: ceiling[m.key],
          features: featuresOf(m.key).map((f) => ({
            key: f.key,
            label: f.label,
            kind: f.kind,
            roleDefault: featureRoleDefault(f, permissions, roleDefaultLevel),
            canGrant: featureWithin(f, ceiling[m.key]),
          })),
        };
      }),
    };
  },

  /** Replaces the member's module levels and feature switches. */
  async updateMemberAccess(access: AccessContext, targetUserId: string, body: { moduleAccess?: unknown; featureAccess?: unknown }) {
    const actorKind = actorKindOf(access);
    const userNum = BigInt(targetUserId);
    const targetRoles = await rolesOf(userNum);
    await assertCanManage(access, actorKind, targetUserId, targetRoles.names);

    const rawModules = body.moduleAccess ?? {};
    const rawFeatures = body.featureAccess ?? {};
    if (!isPlainObject(rawModules)) {
      throw new ValidationError('moduleAccess must be an object of { moduleKey: "none" | "view" | "full" }.');
    }
    if (!isPlainObject(rawFeatures)) {
      throw new ValidationError('featureAccess must be an object of { featureKey: true | false }.');
    }

    const ceiling = actorCeiling(actorKind);
    const moduleAccess: Record<string, ModuleLevel> = {};
    for (const [key, level] of Object.entries(rawModules)) {
      const module = TEAM_MODULES.find((m) => m.key === key);
      if (!module) throw new ValidationError(`Unknown module "${key}".`);
      if (!isModuleLevel(level) || !module.levels.includes(level)) {
        throw new ValidationError(`"${level}" is not a valid level for ${module.label}.`);
      }
      if (!isLevelWithin(level, ceiling[key])) {
        throw new AuthorizationError(`You can grant at most "${ceiling[key]}" on ${module.label}.`);
      }
      moduleAccess[key] = level;
    }

    const featureAccess: Record<string, boolean> = {};
    for (const [key, on] of Object.entries(rawFeatures)) {
      const f = TEAM_FEATURES.find((x) => x.key === key);
      if (!f) throw new ValidationError(`Unknown feature "${key}".`);
      if (typeof on !== 'boolean') throw new ValidationError(`"${f.label}" must be true or false.`);
      // Switching a feature off is always allowed; switching it on is capped.
      if (on && !featureWithin(f, ceiling[f.module])) {
        throw new AuthorizationError(`You can't grant "${f.label}".`);
      }
      featureAccess[key] = on;
    }

    const meta = await getUserMeta(userNum);
    const previous = {
      moduleAccess: sanitizeModuleAccess(meta.moduleAccess),
      featureAccess: sanitizeFeatureAccess(meta.featureAccess),
    };
    await setUserMeta(userNum, { ...meta, moduleAccess, featureAccess });
    // Drops the cached AccessContext and tells their open tabs to refresh.
    await bumpAccessVersion(userNum);

    return { previous, current: { moduleAccess, featureAccess } };
  },
};
