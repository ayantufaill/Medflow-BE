/**
 * Access / RBAC types — Person A (`rbac-core`).
 *
 * Single source of truth for the access layer. The narrative version lives in
 * 00-SHARED-CONTRACTS.md §2; where the two disagree, THIS FILE WINS.
 *
 * Built once per request inside `authenticate` (see
 * src/services/access-context.service.ts) and cached in memory for 60s under
 * the key `${userId}:${tokenVersion}`. Everything downstream — requirePermission,
 * requirePhiAccess, resolveBranchAccess, enterTenantContext — reads this object
 * and issues no further auth queries.
 *
 * The invariant that matters most:
 *
 *   an empty or missing clinic scope means DENY, never "everything".
 *
 * '*' is a deliberate server-controlled bypass, produced in exactly one place
 * (enterTenantContext) and only when isPlatformAdmin || accessAllClinics.
 */

// ─── Clinic scope ────────────────────────────────────────────────────────────

/**
 * Clinic scope handed to the RLS layer via the Postgres GUC `app.clinic_ids`.
 *
 * - a list of ClinicNums  → the caller may touch only these branches
 * - '*'                   → explicit bypass, platform admin / access-all only
 * - undefined             → "no scope was requested"; ONLY valid for internal
 *                           callers (scripts, jobs, migrations, seeder). An
 *                           authenticated HTTP request with undefined scope is
 *                           a bug and must be rejected upstream, not widened
 *                           here. See enterTenantContext.
 */
export type ClinicScope = bigint[] | '*' | undefined;

/**
 * Practice-group scope handed to RLS via `app.patient_group_id`, consumed only
 * by the `patient` read policy (prisma/rls/04-patient-group-visibility.sql) and
 * matched against the stored patient.GroupNum column.
 *
 * - number        → the caller's own group
 * - '*'           → explicit bypass
 * - null          → no group could be resolved. Distinct from 0 and from '*':
 *                    the RLS policy treats null/'' as DENY.
 */
export type GroupScope = number | '*' | null;

// ─── Cross-branch sharing ────────────────────────────────────────────────────

/**
 * The six data categories that can be shared across branches within a group.
 * Deliberately NOT free-form: the set is validated server-side and only these
 * six are accepted (B's sharing.service.ts enforces this).
 */
export const SHARING_CATEGORIES = [
  'IDENTITY',
  'CLINICAL',
  'IMAGING',
  'APPOINTMENTS',
  'FINANCIAL',
  'INSURANCE',
] as const;

export type SharingCategory = (typeof SHARING_CATEGORIES)[number];

/**
 * Access mode for one category. Only two modes are implemented.
 *
 * GROUP_READ_WRITE was explicitly rejected in planning — a shared write path
 * would need a real conflict-resolution model we do not have. Reject it.
 */
export const SHARING_MODES = ['OWN_BRANCH', 'GROUP_READ'] as const;
export type SharingMode = (typeof SHARING_MODES)[number];

/** Default policy for a newly created group. */
export const DEFAULT_SHARING_POLICY: Record<SharingCategory, SharingMode> = {
  IDENTITY: 'OWN_BRANCH',
  CLINICAL: 'OWN_BRANCH',
  IMAGING: 'GROUP_READ',
  APPOINTMENTS: 'OWN_BRANCH',
  FINANCIAL: 'GROUP_READ',
  INSURANCE: 'OWN_BRANCH',
};

/** category → mode, for one group. Absent categories fall back to OWN_BRANCH. */
export type SharingPolicy = Partial<Record<SharingCategory, SharingMode>>;

/**
 * Serialized form of SharingPolicy, as passed to Postgres via `app.shared`.
 *
 * Format: `FINANCIAL:GROUP_READ,IMAGING:GROUP_READ` — comma-separated
 * `CATEGORY:MODE` pairs, always uppercase, always explicit (absent categories
 * are written out as OWN_BRANCH by the serializer, never omitted).
 *
 * Stored raw on TenantContextValue.sharing. Parse with parseSharing(); do not
 * hand-roll a split at the call site.
 */
export type SharingSpec = string;

// ─── The context object ──────────────────────────────────────────────────────

export interface AccessContext {
  userId: string;

  /**
   * The `tokenVersion` this context was built for. Part of the cache key, so a
   * bumpAccessVersion() by B invalidates the cache on the very next request.
   */
  tokenVersion: number;

  // ── Identity ──
  email: string;
  /** Role names from usergroupattach, e.g. ['Group Admin', 'Provider']. */
  roles: string[];

  // ── Authorization ──
  /**
   * Flat permission keys the caller holds, e.g. {'patients.read'}.
   * Built from `role_permission` rows when RBAC_READ_FROM_TABLES is on and the
   * role has any rows; otherwise from the legacy JSON blob on the role.
   *
   * May contain the literal '*'. That is only honoured as a bypass when
   * isPlatformAdmin is true, or the granting role is one of the still-wildcard
   * admin roles (Super Admin / Admin / Branch Admin) — see hasPermission below.
   */
  permissions: Set<string>;

  // ── Clinic scope ──
  /** The caller's own branch assignment(s). Narrow. Governs writes. */
  clinicIds: bigint[];
  /** userod.ClinicNum — the default/home branch. */
  defaultClinicId: bigint | null;
  /** Every clinic in the caller's group. Read-visibility for shared records. */
  groupClinicIds: bigint[];
  groupId: number | null;
  isGroupAdmin: boolean;

  // ── Profile flags (user_access_profile) ──
  /** The ONLY non-platform-admin route to a '*' clinic scope. */
  accessAllClinics: boolean;
  /**
   * Platform staff (our own support/admin accounts), not practice staff.
   * Set by A3.3 for Super Admin holders. Grants '*' and PHI access, and is
   * audited separately from tenant-scoped actions.
   */
  isPlatformAdmin: boolean;

  // ── Cross-branch sharing ──
  sharing: SharingPolicy;
  /** SharingPolicy serialized for `app.shared`. */
  sharingSpec: SharingSpec;

  /** ms timestamp this context was built; drives the 60s TTL. */
  builtAt: number;
}

// ─── Permission checking (pure, in-memory, no DB) ───────────────────────────

/**
 * The still-wildcard role names. These keep '*' as a real bypass until their
 * explicit permission lists are built (A3.5 / next sprint). Branch Admin is
 * deliberately included: narrowing it needs a reviewed list, and the plan
 * explicitly keeps it as '*' for now.
 */
export const WILDCARD_ROLE_NAMES = ['Super Admin', 'Admin', 'Branch Admin'] as const;

export function hasPermission(access: AccessContext, permission: string): boolean {
  if (access.permissions.has('*') && wildcardHonoured(access)) return true;
  return access.permissions.has(permission);
}

export function hasAnyPermission(access: AccessContext, permissions: string[]): boolean {
  if (access.permissions.has('*') && wildcardHonoured(access)) return true;
  return permissions.some((p) => access.permissions.has(p));
}

export function hasAllPermissions(access: AccessContext, permissions: string[]): boolean {
  if (access.permissions.has('*') && wildcardHonoured(access)) return true;
  return permissions.every((p) => access.permissions.has(p));
}

export function hasRole(access: AccessContext, roleName: string): boolean {
  return access.roles.includes(roleName);
}

/**
 * A '*' in the permission set is only a real bypass for a platform admin or
 * one of the still-wildcard admin roles. Without this, a custom role someone
 * copied with '*' pasted in would be silently equivalent to root.
 */
function wildcardHonoured(access: AccessContext): boolean {
  if (access.isPlatformAdmin) return true;
  return access.roles.some((r) => (WILDCARD_ROLE_NAMES as readonly string[]).includes(r));
}

// ─── Error codes (00-SHARED-CONTRACTS.md §8) ────────────────────────────────

/** 403 — user has a role but no clinic assigned. An onboarding state, not a bug. */
export const ERR_NO_BRANCH_ASSIGNED = 'NO_BRANCH_ASSIGNED';

/** 403 — caller lacks clinical.cross_branch.view. */
export const ERR_PHI_ACCESS_NOT_GRANTED = 'PHI_ACCESS_NOT_GRANTED';

// ─── Sharing helpers ─────────────────────────────────────────────────────────

/** Parse the `app.shared` spec back into a SharingPolicy. Never throws. */
export function parseSharing(spec: SharingSpec | undefined | null): SharingPolicy {
  if (!spec) return { ...DEFAULT_SHARING_POLICY };
  const out: SharingPolicy = {};
  for (const pair of spec.split(',')) {
    const [rawCat, rawMode] = pair.split(':');
    const cat = rawCat?.trim().toUpperCase() as SharingCategory;
    const mode = rawMode?.trim().toUpperCase() as SharingMode;
    if (!cat || !mode) continue;
    if (!(SHARING_CATEGORIES as readonly string[]).includes(cat)) continue;
    if (!(SHARING_MODES as readonly string[]).includes(mode)) continue;
    out[cat] = mode;
  }
  return out;
}

/** Serialize a SharingPolicy into the `app.shared` spec, explicitly. */
export function serializeSharing(policy: SharingPolicy | undefined | null): SharingSpec {
  const parts: string[] = [];
  for (const cat of SHARING_CATEGORIES) {
    const mode = policy?.[cat];
    const resolved =
      mode && (SHARING_MODES as readonly string[]).includes(mode) ? mode : DEFAULT_SHARING_POLICY[cat];
    parts.push(`${cat}:${resolved}`);
  }
  return parts.join(',');
}

/** Effective mode for one category, falling back to the default. */
export function sharingModeFor(
  policy: SharingPolicy | undefined | null,
  category: SharingCategory
): SharingMode {
  const mode = policy?.[category];
  return mode && (SHARING_MODES as readonly string[]).includes(mode)
    ? mode
    : DEFAULT_SHARING_POLICY[category];
}
