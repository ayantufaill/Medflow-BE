import jwt, { type SignOptions } from 'jsonwebtoken';
import type { JWTPayload, AuthTokens } from '../types/auth.types';
import { prisma } from '../config/db';
import { getNextId } from './opendental-ids.util';

const JWT_SECRET: string = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_REFRESH_SECRET: string = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key-change-in-production';
const JWT_ACCESS_EXPIRES_IN: string = process.env.JWT_ACCESS_EXPIRES_IN || '1d';
const JWT_REFRESH_EXPIRES_IN: string = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

export const generateAccessToken = (payload: Omit<JWTPayload, 'iat' | 'exp'>): string => {
  const options: SignOptions = {
    expiresIn: JWT_ACCESS_EXPIRES_IN as any,
  };
  return jwt.sign(payload, JWT_SECRET, options);
};

export const generateRefreshToken = (payload: Omit<JWTPayload, 'iat' | 'exp'>): string => {
  const options: SignOptions = {
    expiresIn: JWT_REFRESH_EXPIRES_IN as any,
  };
  return jwt.sign(payload, JWT_REFRESH_SECRET, options);
};

export const generateTokens = (payload: Omit<JWTPayload, 'iat' | 'exp'>): AuthTokens => {
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
  };
};

const isTokenBlacklisted = async (token: string): Promise<boolean> => {
  const record = await prisma.sessiontoken.findFirst({
    where: { SessionTokenHash: token },
  });
  if (!record) return false;
  if (record.Expiration && record.Expiration < new Date()) return false;
  return true;
};

export const verifyAccessToken = async (token: string): Promise<JWTPayload> => {
  try {
    const blacklisted = await isTokenBlacklisted(token);
    if (blacklisted) {
      throw new Error('Token has been revoked');
    }

    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch (error) {
    if (error instanceof Error && error.message.includes('revoked')) {
      throw error;
    }
    throw new Error('Invalid or expired access token');
  }
};

export const verifyRefreshToken = async (token: string): Promise<JWTPayload> => {
  try {
    const blacklisted = await isTokenBlacklisted(token);
    if (blacklisted) {
      throw new Error('Token has been revoked');
    }

    const decoded = jwt.verify(token, JWT_REFRESH_SECRET) as JWTPayload;
    return decoded;
  } catch (error) {
    if (error instanceof Error && error.message.includes('revoked')) {
      throw error;
    }
    throw new Error('Invalid or expired refresh token');
  }
};

export const blacklistToken = async (
  token: string,
  userId: string,
  reason: 'logout' | 'password_change' | 'security' = 'logout'
): Promise<void> => {
  try {
    const decoded = jwt.decode(token) as JWTPayload;
    if (!decoded || !decoded.exp) {
      return;
    }

    const expiresAt = new Date(decoded.exp * 1000);
    if (expiresAt > new Date()) {
      const nextId = await getNextId('sessiontoken', 'SessionTokenNum');
      await prisma.sessiontoken.create({
        data: {
          SessionTokenNum: nextId,
          SessionTokenHash: token,
          Expiration: expiresAt,
        },
      });
    }
  } catch (error) {
    console.error('Error blacklisting token:', error);
  }
};
