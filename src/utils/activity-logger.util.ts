import { SecurityEventModel } from '../models/security-event.model';
import { AuditLogModel } from '../models/audit-log.model';
import type { Request } from 'express';

/**
 * Utility functions for logging user activities and security events
 */

/**
 * Get client IP address from request
 */
export const getClientIp = (req: Request): string => {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    (req.headers['x-real-ip'] as string) ||
    req.socket.remoteAddress ||
    'unknown'
  );
};

/**
 * Get user agent from request
 */
export const getUserAgent = (req: Request): string => {
  return req.headers['user-agent'] || 'unknown';
};

/**
 * Log a security event (login, password change, etc.)
 */
export const logSecurityEvent = async (
  userId: string | null,
  eventType: 'login_success' | 'login_failure' | 'password_change' | 'password_reset' | 'session_end',
  description: string,
  ipAddress?: string,
  riskLevel: 'low' | 'medium' | 'high' = 'low'
): Promise<void> => {
  try {
    await SecurityEventModel.create({
      userId: userId || undefined,
      eventType,
      description,
      ipAddress,
      riskLevel,
      occurredAt: new Date(),
    });
  } catch (error) {
    // Don't throw - logging should not break the main flow
    console.error('Error logging security event:', error);
  }
};

/**
 * Log user activity (audit log)
 */
export const logActivity = async (
  userId: string,
  action: 'created' | 'updated' | 'deleted' | 'viewed',
  tableName: string,
  recordId: string,
  oldValues?: any,
  newValues?: any,
  ipAddress?: string,
  userAgent?: string,
  riskLevel: 'low' | 'medium' | 'high' = 'low'
): Promise<void> => {
  try {
    await AuditLogModel.create({
      userId,
      action,
      tableName,
      recordId,
      oldValues,
      newValues,
      ipAddress,
      userAgent,
      riskLevel,
    });
  } catch (error) {
    // Don't throw - logging should not break the main flow
    console.error('Error logging activity:', error);
  }
};

/**
 * Log activity from Express request
 */
export const logActivityFromRequest = async (
  req: Request,
  action: 'created' | 'updated' | 'deleted' | 'viewed',
  tableName: string,
  recordId: string,
  oldValues?: any,
  newValues?: any
): Promise<void> => {
  if (!req.userId) {
    return;
  }

  await logActivity(
    req.userId,
    action,
    tableName,
    recordId,
    oldValues,
    newValues,
    getClientIp(req),
    getUserAgent(req)
  );
};

