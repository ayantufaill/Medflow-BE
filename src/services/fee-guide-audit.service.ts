import { prisma } from '../config/db';
import { logActivity } from '../utils/activity-logger.util';

export interface AuditDiff {
  key: string;
  old: any;
  new: any;
}

export class FeeGuideAuditService {
  /**
   * Compare two objects and return an array of differences.
   */
  generateDiff(
    oldObj: Record<string, any>,
    newObj: Record<string, any>,
    keysToCompare?: string[]
  ): AuditDiff[] {
    const keys = keysToCompare || Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)]));
    const diffs: AuditDiff[] = [];

    for (const key of keys) {
      const oldVal = oldObj[key];
      const newVal = newObj[key];

      if (newVal !== undefined && oldVal !== newVal) {
        diffs.push({
          key,
          old: oldVal !== undefined && oldVal !== null ? oldVal : '',
          new: newVal !== undefined && newVal !== null ? newVal : '',
        });
      }
    }

    return diffs;
  }

  /**
   * Record a new audit log entry for a fee guide.
   */
  async recordAuditLog(params: {
    feeSchedNum: bigint | string;
    userId?: string | null;
    action: string;
    diffs: AuditDiff[];
  }): Promise<void> {
    try {
      const feeSchedNum = BigInt(params.feeSchedNum);
      const userNum = params.userId && /^\d+$/.test(params.userId) ? BigInt(params.userId) : null;

      await prisma.feeguideauditlog.create({
        data: {
          FeeSchedNum: feeSchedNum,
          UserNum: userNum,
          Action: params.action,
          Diffs: params.diffs as any,
          Timestamp: new Date(),
        },
      });

      // Optionally record in securitylog for global audit log compatibility
      if (params.userId) {
        logActivity(
          params.userId,
          params.action === 'create' ? 'created' : params.action === 'delete' ? 'deleted' : 'updated',
          'feesched',
          feeSchedNum.toString(),
          undefined,
          { action: params.action, diffs: params.diffs },
          undefined,
          undefined,
          'low'
        ).catch(() => {});
      }
    } catch (error) {
      console.error('Failed to record fee guide audit log:', error);
    }
  }

  /**
   * Retrieve audit history for a specific fee guide or all fee guides.
   */
  async getAuditHistory(feeSchedNum?: string | bigint) {
    const where: any = {};
    if (feeSchedNum !== undefined && feeSchedNum !== null && feeSchedNum !== '') {
      where.FeeSchedNum = BigInt(feeSchedNum);
    }

    const logs = await prisma.feeguideauditlog.findMany({
      where,
      orderBy: { Timestamp: 'desc' },
      include: {
        userod: {
          select: {
            UserNum: true,
            UserName: true,
          },
        },
        feesched: {
          select: {
            FeeSchedNum: true,
            Description: true,
          },
        },
      },
      take: 200,
    });

    return logs.map((log) => {
      let diffs: AuditDiff[] = [];
      if (Array.isArray(log.Diffs)) {
        diffs = log.Diffs as unknown as AuditDiff[];
      } else if (typeof log.Diffs === 'string') {
        try {
          diffs = JSON.parse(log.Diffs);
        } catch {
          diffs = [];
        }
      }

      const actorName = log.userod?.UserName || 'System';
      const feeGuideName = log.feesched?.Description || `Fee Guide #${log.FeeSchedNum.toString()}`;

      return {
        id: log.AuditLogNum.toString(),
        changedAt: log.Timestamp.toISOString(),
        actorName,
        user: actorName,
        feeGuideName,
        name: feeGuideName,
        action: log.Action,
        differences: diffs,
        diff: diffs,
      };
    });
  }
}

export const feeGuideAuditService = new FeeGuideAuditService();
