import type { User } from '../models/user.model';
import type { Role } from '../models/role.model';

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
  password?: string; // Optional - will be set via email link
  firstName: string;
  lastName: string;
  phone?: string;
  preferredLanguage?: string;
  roleId?: string; // Optional role ID to assign during registration
}

export interface AuthResponse {
  user: Omit<User, 'passwordHash'>;
  tokens: AuthTokens;
}

export interface UserWithRoles extends Omit<User, 'passwordHash'> {
  roles: Role[];
}

