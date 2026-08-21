export interface JWTPayload {
  userId: string;
  email: string;
  roles?: string[];
  tokenVersion?: number;
  /** Tenant subdomain encoded at login time — fallback for Tenant Resolver Middleware */
  tenantSubdomain?: string;
  /**
   * Tenant context snapshot taken at token-issue time (login / refresh) —
   * DISPLAY/CONVENIENCE ONLY, so the frontend can render group/branch
   * context without an extra round-trip after login. NOT a source of truth
   * for authorization: branch/group assignments can change mid-session and
   * an access token can live up to a day, so nothing authorization-sensitive
   * may trust these claims. resolveBranchAccess / PermissionService.
   * getBranchAccess keep resolving fresh from the DB on every request,
   * exactly as before this field existed.
   */
  groupId?: number | null;
  /** Raw userclinic assignment (NOT group-expanded — same value GET /auth/profile returns as branchIds). */
  branchIds?: string[];
  isGroupAdmin?: boolean;
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password?: string;
  firstName: string;
  lastName: string;
  phone?: string;
  preferredLanguage?: string;
  roleId?: string;
}

export interface AppUser {
  _id: string;
  email: string;
  passwordHash?: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  preferredLanguage?: string | null;
  failedLoginAttempts?: number;
  accountLockedUntil?: Date | null;
  isActive?: boolean;
  lastLoginAt?: Date | null;
  tokenVersion?: number;
}

export interface AppRole {
  _id: string;
  name: string;
  description?: string | null;
  permissions: Record<string, boolean>;
  isSystemRole?: boolean;
  isActive?: boolean;
}

export interface AuthResponse {
  user: Omit<AppUser, 'passwordHash'>;
  tokens: AuthTokens;
}

export interface UserWithRoles extends Omit<AppUser, 'passwordHash'> {
  roles: AppRole[];
}

// ─── Group Admin Permission Keys ──────────────────────────────────────────────
//
// These are the allowed permission keys for the Group Admin role.
// Group Admins have access strictly to operational and financial rollups.
// They do NOT have access to raw clinical PHI across branches.

export const PLATFORM_ADMIN_PERMISSIONS = {
  MANAGE_PRACTICE_GROUPS: 'platform:manage_practice_groups',
} as const;

export type PlatformAdminPermission =
  (typeof PLATFORM_ADMIN_PERMISSIONS)[keyof typeof PLATFORM_ADMIN_PERMISSIONS];

export const GROUP_ADMIN_PERMISSIONS = {
  /** View aggregated operational & financial reports across all branches in the group */
  VIEW_ANALYTICS: 'group:view_analytics',
  /** Create, update, and deactivate users across all branches in the group */
  MANAGE_USERS: 'group:manage_users',
  /** Move providers between branches within the group */
  REASSIGN_PROVIDERS: 'group:reassign_providers',
} as const;

export type GroupAdminPermission =
  (typeof GROUP_ADMIN_PERMISSIONS)[keyof typeof GROUP_ADMIN_PERMISSIONS];

// ─── Branch Access ─────────────────────────────────────────────────────────
//
// Resolved per-request by the branchAccess middleware from `userclinic`
// assignments (and, for Group Admins, expanded to every clinic sharing the
// caller's practicegroup). Used to scope ClinicNum-bearing resources
// (patient, appointment, claim, payment, ...) to what the caller may see.

export interface BranchAccess {
  /** ClinicNums the caller may access. For a Group Admin, every clinic in their group. */
  clinicIds: bigint[];
  /**
   * Every ClinicNum in the caller's practicegroup, regardless of role — the
   * read-visibility scope for shared resources like patients, where a patient
   * registered at one branch should be visible from any sibling branch in the
   * same group. Equal to clinicIds when the caller has no resolvable group.
   * Deliberately separate from clinicIds: write-scope checks (which branch a
   * caller may file a new/updated record under) must stay narrowed to their
   * own assignment, not widen to the whole group.
   */
  groupClinicIds: bigint[];
  /** The practicegroup.id the caller's clinics belong to, if resolvable. */
  groupId: number | null;
  /** True if the caller holds any GROUP_ADMIN_PERMISSIONS permission (or '*'). */
  isGroupAdmin: boolean;
}
