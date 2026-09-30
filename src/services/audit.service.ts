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
  userNum: bigint;
  permType: number;
  patNum?: bigint;
  clinicNum?: bigint;
  text: string;
  source?: number;
  req?: Request;
}

/**
 * Write an audit row into securitylog.
 *
 * Stub: fills the native columns (PermType, UserNum, PatNum, CompName,
 * LogSource) that the existing code ignores, plus the JSON blob in LogText.
 * No hash chain yet — that arrives in B2.
 */
export async function writeAudit(params: WriteAuditParams): Promise<void> {
  const { userNum, permType, patNum, clinicNum, text, source, req } = params;

  try {
    const logNum = await getNextId('securitylog', 'SecurityLogNum');

    const compName = req ? getClientIp(req) : undefined;

    await prisma.securitylog.create({
      data: {
        SecurityLogNum: logNum,
        PermType: permType,
        UserNum: userNum,
        PatNum: patNum ?? null,
        CompName: compName ?? null,
        LogSource: source ?? null,
        LogDateTime: new Date(),
        LogText: JSON.stringify({
          text,
          clinicNum: clinicNum?.toString(),
          timestamp: new Date().toISOString(),
        }),
      },
    });
  } catch (error: any) {
    console.error(
      `writeAudit failed (permType=${permType}, userNum=${userNum}):`,
      error
    );
    // Audit failures should not break the caller's request
    // but we log loudly so they are noticed in monitoring.
  }
}
