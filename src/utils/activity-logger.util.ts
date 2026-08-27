import type { Request } from 'express';
import { prisma } from '../config/db';
import { getNextId } from './opendental-ids.util';

const safeStringify = (value: unknown): string =>
  JSON.stringify(value, (_key, currentValue) =>
    typeof currentValue === 'bigint' ? currentValue.toString() : currentValue
  );

export const getClientIp = (req: Request): string => {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    (req.headers['x-real-ip'] as string) ||
    req.socket.remoteAddress ||
    'unknown'
  );
};

export const getUserAgent = (req: Request): string => {
  return req.headers['user-agent'] || 'unknown';
};

const writeSecurityLog = async (userId: string | null, logText: string) => {
  try {
    const logNum = await getNextId('securitylog', 'SecurityLogNum');
    await prisma.securitylog.create({
      data: {
        SecurityLogNum: logNum,
        UserNum: userId ? BigInt(userId) : null,
        LogDateTime: new Date(),
        LogText: logText,
      },
    });
  } catch (error: any) {
    console.error(`Failed to write security log. LogText length: ${logText.length}. Error:`, error);
    throw error;
  }
};


export const logSecurityEvent = async (
  userId: string | null,
  eventType: 'login_success' | 'login_failure' | 'password_change' | 'password_reset' | 'session_end',
  description: string,
  ipAddress?: string,
  riskLevel: 'low' | 'medium' | 'high' = 'low'
): Promise<void> => {
  const payload = safeStringify({
    type: 'security_event',
    eventType,
    description,
    ipAddress,
    riskLevel,
    occurredAt: new Date().toISOString(),
  });
  await writeSecurityLog(userId, payload);
};

export const logActivity = async (
  userId: string,
  action: 'created' | 'updated' | 'deleted' | 'viewed' | 'commented' | 'status_updated',
  tableName: string,
  recordId: string,
  oldValues?: any,
  newValues?: any,
  ipAddress?: string,
  userAgent?: string,
  riskLevel: 'low' | 'medium' | 'high' = 'low'
): Promise<void> => {
  const payload = safeStringify({
    type: 'activity',
    action,
    tableName,
    recordId,
    oldValues,
    newValues,
    ipAddress,
    userAgent,
    riskLevel,
    occurredAt: new Date().toISOString(),
  });
  await writeSecurityLog(userId, payload);
};

export const logActivityFromRequest = async (
  req: Request,
  action: 'created' | 'updated' | 'deleted' | 'viewed' | 'commented' | 'status_updated',
  tableName: string,
  recordId: string,
  oldValues?: any,
  newValues?: any
): Promise<void> => {
  if (!req.userId) {
    return;
  }

  logActivity(
    req.userId,
    action,
    tableName,
    recordId,
    oldValues,
    newValues,
    getClientIp(req),
    getUserAgent(req)
  ).catch((err) => {
    console.error('Audit log failed:', err);
  });
};
