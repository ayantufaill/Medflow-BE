/**
 * Audit service — stub (B0).
 *
 * Interim: delegates to the existing securitylog insert with the same
 * signature as the final version. The real implementation (B2) replaces this
 * with an atomic CTE that includes an advisory lock and HMAC hash chain.
 *
 * Contract: 00-SHARED-CONTRACTS.md §4.2
 *   writeAudit(p: {
 *     userNum: bigint;
 *     permType: number;
 *     patNum?: bigint;
 *     clinicNum?: bigint;
 *     text: string;
 *     source?: number;
 *     req?: Request;
 *   }): Promise<void>
 */

import type { Request } from 'express';
import { prisma } from '../config/db';
import { getNextId } from '../utils/opendental-ids.util';
import { getClientIp } from '../utils/activity-logger.util';

export interface WriteAuditParams {
  /**
   * The acting user, or null when there is none.
   *
   * null is written as NULL (securitylog.UserNum is nullable), which is the
   * correct record for a system-triggered event — an ERA auto-post, a
   * scheduled job, a fan-out across patients. The alternative, a sentinel
   * like 0, violates fk_securitylog_1_UserNum and the whole audit row is
   * then lost to the catch below: the event goes unrecorded precisely when
   * nobody is watching.
   */
  userNum: bigint | null;
  permType: number;
  patNum?: bigint;
  clinicNum?: bigint;
  text: string;
  source?: number;
  req?: Request;
}

export const AuditEventType = {
  LATE_FEE_APPLIED: 'late_fee_applied',
  LATE_FEE_SKIPPED: 'late_fee_skipped',
  LATE_FEE_WAIVED: 'late_fee_waived',
  LATE_FEE_POLICY_CREATED: 'late_fee_policy_created',
  LATE_FEE_POLICY_UPDATED: 'late_fee_policy_updated',
  LATE_FEE_POLICY_ACTIVATED: 'late_fee_policy_activated',
  LATE_FEE_ACCEPTANCE_RECORDED: 'late_fee_acceptance_recorded',
} as const;

export type AuditEventType = typeof AuditEventType[keyof typeof AuditEventType];

/**
 * Write an audit row into securitylog.
 *
 * Stub: fills the native columns (PermType, UserNum, PatNum, CompName,
 * LogSource) that the existing code ignores, plus the JSON blob in LogText.
 * No hash chain yet — that arrives in B2.
 */
/** Resolves true when the row was written; failures are logged, never thrown. */
export async function writeAudit(params: WriteAuditParams): Promise<boolean> {
  const { userNum, permType, patNum, clinicNum, text, source, req } = params;

  try {
    const logNum = await getNextId('securitylog', 'SecurityLogNum');
    const hashNum = await getNextId('securityloghash', 'SecurityLogHashNum');
    const compName = req ? getClientIp(req) : null;
    const logDateTime = new Date();
    const logText = JSON.stringify({
      text,
      clinicNum: clinicNum?.toString(),
      timestamp: logDateTime.toISOString(),
    });

    const hmacKey = process.env.AUDIT_HMAC_KEY || 'default-audit-key';
    const crypto = await import('crypto');

    // We use a Prisma transaction with an advisory lock to serialize inserts.
    // We compute the HMAC in Node.js because pgcrypto is not guaranteed to be installed.
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(1001)`);

      const newLog = await tx.securitylog.create({
        data: {
          SecurityLogNum: logNum,
          PermType: permType,
          UserNum: userNum,
          PatNum: patNum ?? null,
          CompName: compName,
          LogSource: source ?? null,
          LogDateTime: logDateTime,
          LogText: logText,
        },
      });

      const prev = await tx.securityloghash.findFirst({
        orderBy: { SecurityLogHashNum: 'desc' },
      });
      const prevHash = prev?.LogHash || '0'.repeat(64);

      // Deterministic row string for hashing
      const rowString = `${newLog.SecurityLogNum}|${newLog.PermType}|${newLog.UserNum}|${newLog.PatNum}|${newLog.CompName}|${newLog.LogSource}|${newLog.LogDateTime?.toISOString()}|${newLog.LogText}`;
      const logHash = crypto.createHmac('sha256', hmacKey).update(prevHash + rowString).digest('hex');

      await tx.securityloghash.create({
        data: {
          SecurityLogHashNum: hashNum,
          SecurityLogNum: logNum,
          LogHash: logHash,
        },
      });
    });
  } catch (error: any) {
    console.error(
      `writeAudit failed (permType=${permType}, userNum=${userNum}):`,
      error
    );
    // Audit failures should not break the caller's request
    // but we log loudly so they are noticed in monitoring.
    return false;
  }
  return true;
}

export async function writeLateFeeAudit(params: {
  userNum: bigint;
  patNum?: bigint;
  clinicNum?: bigint;
  eventType: AuditEventType;
  invoiceId?: bigint;
  feeAmount?: number;
  reason?: string;
  details?: Record<string, any>;
  req?: Request;
}): Promise<boolean> {
  const text = JSON.stringify({
    eventType: params.eventType,
    invoiceId: params.invoiceId?.toString(),
    feeAmount: params.feeAmount,
    reason: params.reason,
    details: params.details,
  });
  return writeAudit({
    userNum: params.userNum,
    permType: 999,
    patNum: params.patNum,
    clinicNum: params.clinicNum,
    text,
    source: 1,
    req: params.req,
  });
}

export async function verifyAuditChain() {
  const hmacKey = process.env.AUDIT_HMAC_KEY || 'default-audit-key';
  const crypto = await import('crypto');

  let prevHash = '0'.repeat(64);
  let cursor = undefined;
  let hasMore = true;
  const mismatches = [];

  while (hasMore) {
    const hashes: any[] = await prisma.securityloghash.findMany({
      take: 1000,
      ...(cursor ? { skip: 1, cursor: { SecurityLogHashNum: cursor } } : {}),
      orderBy: { SecurityLogHashNum: 'asc' },
      include: { securitylog: true },
    });

    if (hashes.length === 0) {
      hasMore = false;
      break;
    }

    for (const record of hashes) {
      cursor = record.SecurityLogHashNum;
      const log = record.securitylog;
      
      if (!log) {
        mismatches.push({
          logHashNum: record.SecurityLogHashNum.toString(),
          logNum: record.SecurityLogNum?.toString() || 'null',
          error: 'Missing securitylog row',
        });
        return { isValid: false, mismatches };
      }

      const rowString = `${log.SecurityLogNum}|${log.PermType}|${log.UserNum}|${log.PatNum}|${log.CompName}|${log.LogSource}|${log.LogDateTime?.toISOString()}|${log.LogText}`;
      const computed = crypto.createHmac('sha256', hmacKey).update(prevHash + rowString).digest('hex');

      if (computed !== record.LogHash) {
        mismatches.push({
          logHashNum: record.SecurityLogHashNum.toString(),
          logNum: record.SecurityLogNum?.toString() || 'null',
          expectedHash: computed,
          actualHash: record.LogHash,
        });
        return { isValid: false, mismatches };
      }

      prevHash = computed;
    }
  }

  return { isValid: true };
}

export async function getAuditLogs(page: number = 1, limit: number = 50, filters: any = {}, clinicIds?: string | string[]) {
  const skip = (page - 1) * limit;
  const where: any = {};
  
  if (filters.userNum) where.UserNum = BigInt(filters.userNum);
  if (filters.patNum) where.PatNum = BigInt(filters.patNum);
  if (filters.permType) where.PermType = Number(filters.permType);
  if (filters.startDate || filters.endDate) {
    where.LogDateTime = {};
    if (filters.startDate) where.LogDateTime.gte = new Date(filters.startDate);
    if (filters.endDate) where.LogDateTime.lte = new Date(filters.endDate);
  }

  // Group-scoped audit queries: only show logs for patients or users in the allowed clinics
  if (clinicIds && clinicIds !== '*' && Array.isArray(clinicIds) && clinicIds.length > 0) {
    const cIds = clinicIds.map(BigInt);
    where.OR = [
      { patient: { ClinicNum: { in: cIds } } },
      { userod: { userclinic: { some: { ClinicNum: { in: cIds } } } } }
    ];
  }

  const [logs, total] = await Promise.all([
    prisma.securitylog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { SecurityLogNum: 'desc' },
      include: { securityloghash: true }
    }),
    prisma.securitylog.count({ where })
  ]);

  return {
    logs: logs.map(({ securityloghash, ...l }) => ({
      // Every BigInt column (FKey, DefNum, ...) as a string; JSON cannot serialise BigInt.
      ...Object.fromEntries(Object.entries(l).map(([k, v]) => [k, typeof v === 'bigint' ? v.toString() : v])),
      hash: securityloghash?.[0]?.LogHash || null,
      hashNum: securityloghash?.[0]?.SecurityLogHashNum?.toString() || null,
    })),
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  };
}
