/**
 * "The plan isn't in the list" — front-desk requests for plans the master
 * list doesn't have yet.
 *
 * WHY THIS EXISTS RATHER THAN LETTING THE FRONT DESK CREATE A PLAN
 * ---------------------------------------------------------------
 * A plan's COB fields are inherited by every patient on it, and a plan
 * created at the front desk is a plan with unconfirmed defaults —
 * `coordinates_benefits = true`, `cob_payment_method = UNKNOWN` — that
 * silently ranks all of them. Worse, the same employer plan gets re-created
 * once per receptionist who can't find it, and then nobody can tell which of
 * the four rows is the real one.
 *
 * So the front desk raises a request, a billing admin creates the plan AND
 * records its coordination settings in one action, and the request is closed
 * pointing at what they made. `insurance.coverage_detail.edit` can raise one;
 * only `insurance.plan_master.edit` can resolve it.
 *
 * The patient is never blocked meanwhile: the coverage saves with the request
 * id attached, so the order comes back NEEDS_INFO rather than stopping someone
 * at the desk with a queue behind them.
 */

import type { Request } from 'express';
import { prisma } from '../../config/db';
import { BadRequestError, NotFoundError } from '../../utils/error.util';
import { writeAudit } from '../audit.service';
import { PermType } from '../../constants/audit-types';
import { notificationService } from '../notification.service';
import { PermissionService } from '../permission.service';
import { PERMISSIONS } from '../../constants/permissions';

export const PLAN_REQUEST_STATUSES = ['OPEN', 'RESOLVED', 'REJECTED'] as const;
export type PlanRequestStatus = (typeof PLAN_REQUEST_STATUSES)[number];

export interface CreatePlanRequestInput {
  planName: string;
  carrierId?: string | null;
  groupNumber?: string | null;
  payerPhone?: string | null;
  note?: string | null;
  patientId?: string | null;
  coverageId?: string | null;
}

const asBigInt = (value: unknown): bigint | null => {
  if (value === null || value === undefined || value === '') return null;
  try {
    return BigInt(value as string);
  } catch {
    return null;
  }
};

export class PlanRequestService {
  /**
   * Raise a request, then tell the people who can act on it.
   *
   * Notification failure does NOT fail the request. The row is the durable
   * record and the admin queue is read from it; losing a notification is an
   * inconvenience, losing the request because a notification write failed
   * would send the front desk back to the patient for the card again.
   */
  async create(input: CreatePlanRequestInput, userNum: bigint, options: { req?: Request } = {}) {
    const planName = String(input.planName || '').trim();
    if (!planName) {
      throw new BadRequestError('planName is required — copy it from the card');
    }

    const carrierNum = asBigInt(input.carrierId);
    if (carrierNum !== null) {
      const carrier = await prisma.carrier.findUnique({ where: { CarrierNum: carrierNum } });
      if (!carrier) throw new NotFoundError('Carrier not found');
    }

    const request = await prisma.cob_plan_request.create({
      data: {
        plan_name: planName,
        carrier_num: carrierNum,
        group_number: input.groupNumber?.trim() || null,
        payer_phone: input.payerPhone?.trim() || null,
        note: input.note?.trim() || null,
        pat_num: asBigInt(input.patientId),
        patplan_num: asBigInt(input.coverageId),
        status: 'OPEN',
        created_by: userNum,
      },
    });

    await writeAudit({
      userNum,
      permType: PermType.COB_PLAN_REQUESTED,
      patNum: request.pat_num ?? undefined,
      text:
        `Plan not in master list requested: "${planName}"` +
        (input.groupNumber ? ` (group ${input.groupNumber})` : '') +
        ` — request ${request.id}`,
      req: options.req,
    });

    await this.notifyPlanAdmins(request).catch((error) => {
      console.error(`Plan request ${request.id} raised but admins were not notified:`, error);
    });

    return this.shape(request);
  }

  async list(filters: { status?: string; page?: number; limit?: number } = {}) {
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(filters.limit) || 25));

    const where: { status?: string } = {};
    if (filters.status) {
      const status = String(filters.status).toUpperCase();
      if (!PLAN_REQUEST_STATUSES.includes(status as PlanRequestStatus)) {
        throw new BadRequestError(`status must be one of: ${PLAN_REQUEST_STATUSES.join(', ')}`);
      }
      where.status = status;
    }

    const [rows, total] = await Promise.all([
      prisma.cob_plan_request.findMany({
        where,
        orderBy: [{ status: 'asc' }, { created_at: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.cob_plan_request.count({ where }),
    ]);

    // Carrier names in one query rather than per row.
    const carrierNums = [...new Set(rows.map((r) => r.carrier_num).filter((v): v is bigint => v != null))];
    const carriers = carrierNums.length
      ? await prisma.carrier.findMany({
          where: { CarrierNum: { in: carrierNums } },
          select: { CarrierNum: true, CarrierName: true },
        })
      : [];
    const carrierBy = new Map(
      carriers.map((c) => [c.CarrierNum.toString(), c.CarrierName ?? null])
    );

    return {
      requests: rows.map((row) =>
        this.shape(row, carrierBy.get(row.carrier_num?.toString() ?? '') ?? undefined)
      ),
      page,
      limit,
      total,
    };
  }

  /**
   * Close a request.
   *
   * RESOLVED requires the plan the admin created, because "resolved" with
   * nothing to point at is indistinguishable from "ignored" a month later, and
   * the front desk's coverage still needs a plan to attach to.
   */
  async resolve(
    requestId: string,
    input: { status: string; planId?: string | null; resolutionNote?: string | null },
    userNum: bigint,
    options: { req?: Request } = {}
  ) {
    const id = BigInt(requestId);
    const request = await prisma.cob_plan_request.findUnique({ where: { id } });
    if (!request) throw new NotFoundError('Plan request not found');
    if (request.status !== 'OPEN') {
      throw new BadRequestError(`This request is already ${request.status.toLowerCase()}`);
    }

    const status = String(input.status || '').toUpperCase();
    if (status !== 'RESOLVED' && status !== 'REJECTED') {
      throw new BadRequestError('status must be RESOLVED or REJECTED');
    }

    let resolvedPlanNum: bigint | null = null;
    if (status === 'RESOLVED') {
      resolvedPlanNum = asBigInt(input.planId);
      if (resolvedPlanNum === null) {
        throw new BadRequestError(
          'planId is required to resolve a request — point at the plan you created'
        );
      }
      const plan = await prisma.insplan.findUnique({ where: { PlanNum: resolvedPlanNum } });
      if (!plan) throw new NotFoundError('Insurance plan not found');
    } else if (!input.resolutionNote?.trim()) {
      // Rejecting is the one path with nothing to show for it, so it has to
      // say why — the front desk will ask.
      throw new BadRequestError('resolutionNote is required when rejecting a request');
    }

    const updated = await prisma.cob_plan_request.update({
      where: { id },
      data: {
        status,
        resolved_plan_num: resolvedPlanNum,
        resolution_note: input.resolutionNote?.trim() || null,
        resolved_by: userNum,
        resolved_at: new Date(),
      },
    });

    await writeAudit({
      userNum,
      permType: PermType.COB_PLAN_REQUEST_RESOLVED,
      patNum: updated.pat_num ?? undefined,
      text:
        `Plan request ${id} ("${updated.plan_name}") ${status.toLowerCase()}` +
        (resolvedPlanNum ? ` as plan ${resolvedPlanNum}` : '') +
        (updated.resolution_note ? `. Note: ${updated.resolution_note}` : ''),
      req: options.req,
    });

    // Tell whoever raised it, since they are the one holding a coverage that
    // is still waiting on a plan.
    if (updated.created_by) {
      await notificationService
        .createNotification({
          userId: updated.created_by.toString(),
          type: 'insurance',
          title:
            status === 'RESOLVED'
              ? `Plan added: ${updated.plan_name}`
              : `Plan request declined: ${updated.plan_name}`,
          message:
            status === 'RESOLVED'
              ? `The plan you asked about has been added. Re-open the patient's insurance and pick it from the list.`
              : updated.resolution_note || 'The billing team declined this request.',
          data: { planRequestId: id.toString(), planId: resolvedPlanNum?.toString() ?? null },
        })
        .catch((error) => {
          console.error(`Plan request ${id} resolved but requester was not notified:`, error);
        });
    }

    return this.shape(updated);
  }

  /**
   * Notify everyone who holds `insurance.plan_master.edit`.
   *
   * Resolved through roles rather than a hard-coded role name: the permission
   * is the thing that decides who CAN act on this, so it is also the thing
   * that decides who hears about it. A new role granted the permission starts
   * receiving these with no change here.
   */
  private async notifyPlanAdmins(request: { id: bigint; plan_name: string; group_number: string | null }) {
    const roles = await PermissionService.getAllRoles();
    const editorRoleIds = roles
      .filter(
        (role) =>
          role.permissions?.[PERMISSIONS.INSURANCE_COB.PLAN_MASTER_EDIT] === true ||
          role.permissions?.['*'] === true
      )
      .map((role) => BigInt(role._id));

    if (editorRoleIds.length === 0) return;

    const attachments = await prisma.usergroupattach.findMany({
      where: { UserGroupNum: { in: editorRoleIds } },
      select: { UserNum: true },
    });
    const userNums = [...new Set(attachments.map((a) => a.UserNum?.toString()).filter(Boolean))];

    await Promise.all(
      userNums.map((userId) =>
        notificationService.createNotification({
          userId: userId as string,
          type: 'insurance',
          title: 'Insurance plan needs adding',
          message:
            `The front desk found a plan that isn't in the master list: "${request.plan_name}"` +
            (request.group_number ? ` (group ${request.group_number})` : '') +
            '. Add it and record its coordination settings.',
          data: { planRequestId: request.id.toString() },
        })
      )
    );
  }

  private shape(row: any, carrierName?: string) {
    return {
      id: row.id.toString(),
      planName: row.plan_name,
      groupNumber: row.group_number,
      payerPhone: row.payer_phone,
      note: row.note,
      carrierId: row.carrier_num?.toString() ?? null,
      carrierName: carrierName ?? null,
      patientId: row.pat_num?.toString() ?? null,
      coverageId: row.patplan_num?.toString() ?? null,
      status: row.status,
      resolvedPlanId: row.resolved_plan_num?.toString() ?? null,
      resolutionNote: row.resolution_note,
      resolvedBy: row.resolved_by?.toString() ?? null,
      resolvedAt: row.resolved_at,
      createdBy: row.created_by?.toString() ?? null,
      createdAt: row.created_at,
    };
  }
}

export const planRequestService = new PlanRequestService();
