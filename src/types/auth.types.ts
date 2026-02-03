export interface JWTPayload {
  userId: string;
  email: string;
  roles?: string[];
  tokenVersion?: number;
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
