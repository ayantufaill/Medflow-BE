export interface JWTPayload {
  userId: string;
  email: string;
  roles?: string[];
  tokenVersion?: number;
  /** Tenant subdomain encoded at login time — fallback for Tenant Resolver Middleware */
  tenantSubdomain?: string;
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
