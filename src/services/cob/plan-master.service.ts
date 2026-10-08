/**
 * Plan master data — the COB fields on a PLAN, not on a patient's coverage.
 *
 * WHY THIS IS SEPARATE FROM patient-insurance.service
 * ---------------------------------------------------
 * `coordinatesBenefits` and `cobPaymentMethod` are properties of the plan
 * document, identical for every patient on that plan. The front desk reads
 * them; they must not be able to edit them from a patient screen, because a
 * change made there silently re-ranks every other patient on the plan. Hence
 * a separate service, a separate permission (`insurance.plan_master.edit`),
 * and the re-evaluation fan-out at the bottom of this file.
 *
 * EVERY CHANGE IS VERSIONED
 * -------------------------
 * A plan's COB provision is the kind of fact a payer disputes. Keeping an
 * immutable snapshot per version means "we billed you second in March
 * because your plan was recorded as coordinating" is answerable with a row
 * and a timestamp rather than an opinion.
 */

import type { Request } from 'express';
import { prisma } from '../../config/db';
import { BadRequestError, NotFoundError } from '../../utils/error.util';
import { writeAudit } from '../audit.service';
import { PermType } from '../../constants/audit-types';
import { COB_ENUMS, COB_PLAN_PROFILE_DEFAULTS } from './facts';
import {
  CLAIM_STATUS_CODE,
  CLOSED_CLAIM_STATUS_CODES,
} from '../../constants/claim-status';
import { cobService } from './cob.service';

export interface PlanCobFields {
  benefitCategory?: string;
  coordinatesBenefits?: boolean;
  cobPaymentMethod?: string;
  cobInfoSource?: string;
}

const EDITABLE: Array<keyof PlanCobFields> = [
  'benefitCategory',
  'coordinatesBenefits',
  'cobPaymentMethod',
  'cobInfoSource',
];

const COLUMN: Record<keyof PlanCobFields, string> = {
  benefitCategory: 'benefit_category',
  coordinatesBenefits: 'coordinates_benefits',
  cobPaymentMethod: 'cob_payment_method',
  cobInfoSource: 'cob_info_source',
};

/**
 * The values a plan profile has when nobody has recorded one yet, in column
 * form. Derived from COB_PLAN_PROFILE_DEFAULTS rather than restated, so the
 * plan screen and the rule engine cannot disagree about an unfilled plan.
 */
const DEFAULTS = {
  benefit_category: COB_PLAN_PROFILE_DEFAULTS.benefitCategory,
  coordinates_benefits: COB_PLAN_PROFILE_DEFAULTS.coordinatesBenefits,
  cob_payment_method: COB_PLAN_PROFILE_DEFAULTS.cobPaymentMethod,
  cob_info_source: COB_PLAN_PROFILE_DEFAULTS.cobInfoSource,
  /** 0 = no profile row exists; the first recorded change writes version 1. */
  version: 0,
} as const;

export class PlanMasterService {
  /**
   * Plans with their COB profile. Plans with no profile row are returned with
   * the defaults and `cobProfileRecorded: false`, so a billing admin can see
   * at a glance which plans nobody has confirmed — rather than the list
   * quietly implying every plan coordinates.
   */
  async listPlans(filters: {
    search?: string;
    carrierId?: string;
    benefitCategory?: string;
    cobPaymentMethod?: string;
    unconfirmedOnly?: boolean;
    page?: number;
    limit?: number;
  } = {}) {
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(filters.limit) || 25));

    const where: any = { OR: [{ IsHidden: 0 }, { IsHidden: null }] };
    if (filters.carrierId) where.CarrierNum = BigInt(filters.carrierId);
    if (filters.search) {
      const search = filters.search.trim();
      where.AND = [
        {
          OR: [
            { GroupName: { contains: search, mode: 'insensitive' } },
            { GroupNum: { contains: search, mode: 'insensitive' } },
            { carrier: { CarrierName: { contains: search, mode: 'insensitive' } } },
          ],
        },
      ];
    }

    const plans = await prisma.insplan.findMany({
      where,
      include: { carrier: true },
      orderBy: { PlanNum: 'desc' },
      // Over-fetch so the profile-level filters below can still fill a page.
      take: limit * 4,
      skip: (page - 1) * limit,
    });

    const planNums = plans.map((p) => p.PlanNum);
    const profiles = planNums.length
      ? await prisma.cob_plan_profile.findMany({ where: { plan_num: { in: planNums } } })
      : [];
    const profileBy = new Map(profiles.map((p) => [p.plan_num.toString(), p]));

    let rows = plans.map((plan) => this.shapePlan(plan, profileBy.get(plan.PlanNum.toString())));

    if (filters.benefitCategory) {
      rows = rows.filter((r) => r.benefitCategory === filters.benefitCategory);
    }
    if (filters.cobPaymentMethod) {
      rows = rows.filter((r) => r.cobPaymentMethod === filters.cobPaymentMethod);
    }
    if (filters.unconfirmedOnly) {
      rows = rows.filter((r) => r.cobInfoSource === 'DEFAULT' || r.cobPaymentMethod === 'UNKNOWN');
    }

    return { plans: rows.slice(0, limit), page, limit, total: rows.length };
  }

  async getPlan(planId: string) {
    const planNum = BigInt(planId);
    const plan = await prisma.insplan.findUnique({
      where: { PlanNum: planNum },
      include: { carrier: true },
    });
    if (!plan) throw new NotFoundError('Insurance plan not found');

    const [profile, versions] = await Promise.all([
      prisma.cob_plan_profile.findUnique({ where: { plan_num: planNum } }),
      prisma.cob_plan_profile_version.findMany({
        where: { plan_num: planNum },
        orderBy: { version: 'desc' },
      }),
    ]);

    return {
      ...this.shapePlan(plan, profile ?? undefined),
      history: versions.map((v) => ({
        version: v.version,
        snapshot: v.snapshot,
        changedBy: v.changed_by?.toString() ?? null,
        changeNote: v.change_note,
        changedAt: v.changed_at,
      })),
    };
  }

  /**
   * Updates a plan's COB fields, versions the change, and re-evaluates every
   * patient on the plan who has an open claim.
   *
   * The caller must hold `insurance.plan_master.edit` — enforced at the route,
   * because that is where the authenticated user is.
   */
  async updateCobFields(
    planId: string,
    updates: PlanCobFields,
    userNum: bigint,
    options: { changeNote?: string; req?: Request } = {}
  ) {
    const planNum = BigInt(planId);
    const plan = await prisma.insplan.findUnique({
      where: { PlanNum: planNum },
      include: { carrier: true },
    });
    if (!plan) throw new NotFoundError('Insurance plan not found');

    const provided = EDITABLE.filter((key) => updates[key] !== undefined);
    if (provided.length === 0) {
      throw new BadRequestError(
        `At least one COB field is required: ${EDITABLE.join(', ')}`
      );
    }

    this.validate(updates);

    const existing = await prisma.cob_plan_profile.findUnique({ where: { plan_num: planNum } });
    const before = existing ?? { ...DEFAULTS, plan_num: planNum, updated_by: null, updated_at: new Date() };

    const data: Record<string, any> = {};
    for (const key of provided) {
      data[COLUMN[key]] = updates[key];
    }

    const changed: Record<string, { from: unknown; to: unknown }> = {};
    for (const key of provided) {
      const column = COLUMN[key];
      const from = (before as any)[column];
      const to = updates[key];
      if (from !== to) changed[key] = { from, to };
    }

    if (Object.keys(changed).length === 0) {
      return { plan: this.shapePlan(plan, existing ?? undefined), changed: {}, reEvaluated: [] };
    }

    const nextVersion = (existing?.version ?? 0) + 1;

    const profile = await prisma.$transaction(async (tx) => {
      const saved = await tx.cob_plan_profile.upsert({
        where: { plan_num: planNum },
        create: {
          plan_num: planNum,
          benefit_category: updates.benefitCategory ?? DEFAULTS.benefit_category,
          coordinates_benefits: updates.coordinatesBenefits ?? DEFAULTS.coordinates_benefits,
          cob_payment_method: updates.cobPaymentMethod ?? DEFAULTS.cob_payment_method,
          cob_info_source: updates.cobInfoSource ?? DEFAULTS.cob_info_source,
          version: nextVersion,
          updated_by: userNum,
        },
        update: { ...data, version: nextVersion, updated_by: userNum },
      });

      await tx.cob_plan_profile_version.create({
        data: {
          plan_num: planNum,
          version: nextVersion,
          snapshot: {
            benefitCategory: saved.benefit_category,
            coordinatesBenefits: saved.coordinates_benefits,
            cobPaymentMethod: saved.cob_payment_method,
            cobInfoSource: saved.cob_info_source,
            changed,
          } as any,
          changed_by: userNum,
          change_note: options.changeNote ?? null,
        },
      });

      return saved;
    });

    await writeAudit({
      userNum,
      permType: PermType.COB_PLAN_FIELD_CHANGED,
      text:
        `Plan ${planNum} (${plan.carrier?.CarrierName ?? 'unknown carrier'} / ` +
        `${plan.GroupName ?? plan.GroupNum ?? 'no group'}) COB fields changed to ` +
        `v${nextVersion}: ` +
        Object.entries(changed)
          .map(([key, diff]) => `${key} ${diff.from} -> ${diff.to}`)
          .join(', ') +
        (options.changeNote ? `. Note: ${options.changeNote}` : ''),
      req: options.req,
    });

    const reEvaluated = await this.reEvaluatePatientsOnPlan(planNum, userNum, options.req);

    return {
      plan: this.shapePlan(plan, profile),
      changed,
      version: nextVersion,
      reEvaluated,
    };
  }

  /**
   * Re-ranks every patient on this plan who has an OPEN claim.
   *
   * "Open" is unbilled or unpaid: a claim not yet sent, or sent and not yet
   * fully received. Those are the claims whose payer could still change.
   * Patients whose claims are all settled are deliberately left alone —
   * re-ranking them would rewrite history for no billing benefit and bury
   * the real changes in noise.
   *
   * Scoped to claims rather than "every patient on the plan" because a
   * popular group plan can carry thousands of patients, and this runs inline
   * on an admin's save.
   */
  /**
   * How many patients a COB-field change on this plan would re-rank — WITHOUT
   * changing anything.
   *
   * Exists so the admin UI can show the blast radius BEFORE the save. The
   * count has to come from the server because "open claim" is defined by
   * Open Dental claim-status codes the client has no business knowing, and it
   * has to match `reEvaluatePatientsOnPlan` exactly or the number shown would
   * be a different number from the one that happens. The `where` clause below
   * is therefore deliberately a copy of that method's, and the two are pinned
   * together by a test; if one changes, change both.
   */
  async previewCobChangeImpact(
    planId: string
  ): Promise<{ planId: string; affectedPatients: number; openClaims: number; patientsOnPlan: number }> {
    const planNum = BigInt(planId);

    const subs = await prisma.inssub.findMany({
      where: { PlanNum: planNum },
      select: { InsSubNum: true },
    });
    if (subs.length === 0) {
      return { planId, affectedPatients: 0, openClaims: 0, patientsOnPlan: 0 };
    }

    const patPlans = await prisma.patplan.findMany({
      where: { InsSubNum: { in: subs.map((sub) => sub.InsSubNum) } },
      select: { PatNum: true },
    });
    const patNums = [
      ...new Set(patPlans.map((p) => p.PatNum).filter((v): v is bigint => v != null)),
    ];
    if (patNums.length === 0) {
      return { planId, affectedPatients: 0, openClaims: 0, patientsOnPlan: 0 };
    }

    // Must stay identical to reEvaluatePatientsOnPlan's exclusion.
    const openClaimWhere = {
      PatNum: { in: patNums },
      NOT: [
        { ClaimStatus: 'C' },
        { AND: [{ ClaimStatus: 'R' }, { InsPayAmt: { gt: 0 } }] },
      ],
    };

    const [affected, openClaims] = await Promise.all([
      prisma.claim.findMany({
        where: openClaimWhere,
        select: { PatNum: true },
        distinct: ['PatNum'],
      }),
      prisma.claim.count({ where: openClaimWhere }),
    ]);

    return {
      planId,
      affectedPatients: affected.filter((c) => c.PatNum != null).length,
      openClaims,
      patientsOnPlan: patNums.length,
    };
  }

  async reEvaluatePatientsOnPlan(
    planNum: bigint,
    userNum: bigint,
    req?: Request
  ): Promise<Array<{ patientId: string; status: string; orderVersion: number }>> {
    const subs = await prisma.inssub.findMany({
      where: { PlanNum: planNum },
      select: { InsSubNum: true },
    });
    if (subs.length === 0) return [];

    const patPlans = await prisma.patplan.findMany({
      where: { InsSubNum: { in: subs.map((s) => s.InsSubNum) } },
      select: { PatNum: true },
    });
    const patNums = [...new Set(patPlans.map((p) => p.PatNum).filter((v): v is bigint => v != null))];
    if (patNums.length === 0) return [];

    // "Open" = still unbilled or unpaid, i.e. the payer could still change.
    // Open Dental encodes claim status in one char (claimStatusToCode in
    // claim.service.ts): W ready, S sent, P pending, T partial, R received,
    // D denied, X rejected, C cancelled, H hold.
    //
    // Expressed as an exclusion rather than a list of open codes, because a
    // new status code added to that mapper would silently drop patients from
    // this fan-out if we enumerated the open side. Settled means received
    // WITH money, or cancelled. A denied or rejected claim is open: it has to
    // be reworked, and the COB order is often why.
    const openClaims = await prisma.claim.findMany({
      where: {
        PatNum: { in: patNums },
        NOT: [
          ...CLOSED_CLAIM_STATUS_CODES.map((code) => ({ ClaimStatus: code })),
          { AND: [{ ClaimStatus: CLAIM_STATUS_CODE.RECEIVED }, { InsPayAmt: { gt: 0 } }] },
        ],
      },
      select: { PatNum: true },
      distinct: ['PatNum'],
    });

    const results: Array<{ patientId: string; status: string; orderVersion: number }> = [];
    for (const claim of openClaims) {
      if (!claim.PatNum) continue;
      try {
        const order = await cobService.evaluateAndSave(claim.PatNum.toString(), {
          triggerReason: `PLAN_COB_CHANGED:${planNum}`,
          userNum,
          req,
        });
        results.push({
          patientId: claim.PatNum.toString(),
          status: order.status,
          orderVersion: order.version,
        });
      } catch (error) {
        // One patient's bad data must not abort the fan-out for the rest, or
        // an admin's save would half-apply.
        console.error(
          `COB re-evaluation failed for patient ${claim.PatNum} after plan ${planNum} change:`,
          error
        );
      }
    }

    return results;
  }

  private validate(updates: PlanCobFields): void {
    const check = (value: unknown, allowed: readonly string[], field: string) => {
      if (value === undefined) return;
      if (typeof value !== 'string' || !allowed.includes(value)) {
        throw new BadRequestError(`${field} must be one of: ${allowed.join(', ')}`);
      }
    };
    check(updates.benefitCategory, COB_ENUMS.benefitCategory, 'benefitCategory');
    check(updates.cobPaymentMethod, COB_ENUMS.cobPaymentMethod, 'cobPaymentMethod');
    check(updates.cobInfoSource, COB_ENUMS.cobInfoSource, 'cobInfoSource');
    if (updates.coordinatesBenefits !== undefined && typeof updates.coordinatesBenefits !== 'boolean') {
      throw new BadRequestError('coordinatesBenefits must be a boolean');
    }
  }

  private shapePlan(plan: any, profile?: any) {
    return {
      planId: plan.PlanNum.toString(),
      planName: plan.GroupName ?? null,
      groupNumber: plan.GroupNum ?? null,
      carrierId: plan.CarrierNum?.toString() ?? null,
      carrierName: plan.carrier?.CarrierName ?? null,
      benefitCategory: profile?.benefit_category ?? DEFAULTS.benefit_category,
      coordinatesBenefits: profile ? profile.coordinates_benefits : DEFAULTS.coordinates_benefits,
      cobPaymentMethod: profile?.cob_payment_method ?? DEFAULTS.cob_payment_method,
      cobInfoSource: profile?.cob_info_source ?? DEFAULTS.cob_info_source,
      /** False means these values are defaults nobody has confirmed. */
      cobProfileRecorded: !!profile,
      version: profile?.version ?? 0,
      updatedBy: profile?.updated_by?.toString() ?? null,
      updatedAt: profile?.updated_at ?? null,
    };
  }
}

export const planMasterService = new PlanMasterService();
