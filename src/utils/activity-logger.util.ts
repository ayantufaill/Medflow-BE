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

import { writeAudit } from '../services/audit.service';
import { PermType } from '../constants/audit-types';

const writeSecurityLog = async (userId: string | null, logText: string, permType: number = 0, patNum?: bigint, clinicNum?: bigint, req?: Request) => {
  try {
    await writeAudit({
      userNum: userId ? BigInt(userId) : 0n,
      permType,
      patNum,
      clinicNum,
      text: logText,
      req,
    });
  } catch (error: any) {
    console.error(`Failed to write security log. LogText length: ${logText.length}. Error:`, error);
    // Don't throw, as per writeAudit comment
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
  
  let permType = 0;
  if (eventType === 'login_success' || eventType === 'login_failure' || eventType === 'session_end') {
     // Not mapped to specific PermType for now, keep 0
  }

  await writeSecurityLog(userId, payload, permType);
};

export const logActivity = async (
  userId: string,
  action: 'created' | 'updated' | 'deleted' | 'viewed' | 'commented' | 'status_updated',
  tableName: string,
  recordId: string | null,
  oldValues?: any,
  newValues?: any,
  ipAddress?: string,
  userAgent?: string,
  riskLevel: 'low' | 'medium' | 'high' = 'low',
  permType: number = 0,
  req?: Request
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
  
  // Try to infer permType if not provided
  if (permType === 0) {
    if (tableName === 'userclinic' && action === 'updated') {
      permType = PermType.CLINIC_ASSIGNED;
    } else if (tableName === 'usergroupattach') {
      if (action === 'created' || (action === 'updated' && newValues)) permType = PermType.ROLE_ASSIGNED;
      if (action === 'deleted' || (action === 'updated' && oldValues)) permType = PermType.ROLE_REMOVED;
    } else if (tableName === 'user' && action === 'status_updated') {
      permType = newValues?.status === 'active' ? PermType.USER_ACTIVATED : PermType.USER_DEACTIVATED;
    } else if (tableName === 'group_sharing_policy' && action === 'updated') {
      permType = PermType.SHARING_CHANGED;
    } else if (tableName === 'security_lock' && action === 'updated') {
      permType = PermType.LOCKDATE_CHANGED;
    } else if (tableName === 'app_role' && action === 'created') {
      permType = PermType.ROLE_CREATED;
    } else if (tableName === 'app_role' && action === 'updated') {
      permType = PermType.ROLE_UPDATED;
    } else if (tableName === 'app_role' && action === 'deleted') {
      permType = PermType.ROLE_DELETED;
    }
  }

  let clinicNum: bigint | undefined;
  if (req && (req as any).branchAccess?.clinicIds) {
    const ids = (req as any).branchAccess.clinicIds;
    if (ids !== '*' && ids.length > 0) {
      clinicNum = BigInt(ids[0]);
    }
  }

  await writeSecurityLog(userId, payload, permType, undefined, clinicNum, req);
};

export const logActivityFromRequest = async (
  req: Request,
  action: 'created' | 'updated' | 'deleted' | 'viewed' | 'commented' | 'status_updated',
  tableName: string,
  recordId: string | null,
  oldValues?: any,
  newValues?: any,
  permType: number = 0
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
    getUserAgent(req),
    'low',
    permType,
    req
  ).catch((err) => {
    console.error('Audit log failed:', err);
  });
};
