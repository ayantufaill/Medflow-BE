/**
 * Coordination of Benefits — orchestration.
 *
 * The pure modules decide; this one loads, persists, audits and gates.
 *
 * THE INVARIANT THIS FILE EXISTS TO HOLD
 * --------------------------------------
 * A coverage order is never updated in place. Re-evaluating closes the
 * previous version's effective range and inserts a new one. That is what lets
 * a claim for a February date of service bill the order that was true in
 * February, and what lets a biller answer a payer's "why did you send this to
 * us first" six months later. Anything in here that looks like it is editing
 * an order is either closing a range, recording an override on the row that
 * override created, or resolving a flag.
 *
 * patplan.Ordinal is kept in step with the CURRENT version only. Every
 * existing consumer (claims, EDI 837, the invoice estimator, the ERA poster)
 * reads Ordinal, and they are all asking "who is primary now".
 */

import type { Request } from 'express';
import { prisma } from '../../config/db';
import { BadRequestError, ConflictError, NotFoundError } from '../../utils/error.util';
import { writeAudit } from '../audit.service';
import { PermType } from '../../constants/audit-types';
import { determineOrder } from './order';
import { comparePayerReported, type PayerReportedSnapshot } from './order';
import {
  loadCoverageFacts,
  COB_ENUMS,
  COB_PAYER_TYPE_DEFAULT,
  COB_PLAN_PROFILE_DEFAULTS,
} from './facts';
import { COB_RULES, MSP_THRESHOLDS } from './rules';
import { toIsoDate, dayBefore, isActiveOn } from './date.util';
import {
  detectCobDenial,
  COB_DENIAL_CARCS,
  COB_INFORMATIONAL_CARCS,
  type AdjustmentCode,
} from './denial';
import {
  estimateSecondaryPayment,
  COB_PAYMENT_METHODS,
  type SecondaryEstimateInput,
} from './estimate';
import {
  BLOCKING_ORDER_STATUSES,
  BLOCKING_REVIEW_FLAGS,
  ELIGIBILITY_SOURCES,
  ORDER_STATUSES,
  RESPONSIBLE_PARTIES,
  REVIEW_FLAGS,
  VERIFICATION_STATUSES,
} from './types';
import type {
  ClaimContext,
  CoverageFacts,
  EligibilitySource,
  OrderStatus,
  ReviewFlag,
} from './types';

const todayIso = (): string => new Date().toISOString().slice(0, 10);

/** @db.Date columns round-trip cleanly as UTC midnight. */
const toDbDate = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

const asBigInt = (value: string | number | bigint): bigint => {
  try {
    return BigInt(value as any);
  } catch {
    throw new BadRequestError(`Invalid id: ${value}`);
  }
};

/**
 * The API shape of a saved order.
 *
 * Declared explicitly because `shapeOrder` takes Prisma's loose include type
 * as `any`: without these, `order.flags` infers as `any` and every `.filter`
 * callback over it silently becomes an implicit-any parameter, which is how
 * a typo in a flag name reaches production unchallenged.
 */
export interface ShapedOrderPosition {
  position: number | null;
  coverageId: string;
  ruleCode: string;
  explanation: string;
}

export interface ShapedOrderFlag {
  id: string;
  flag: string;
  detail: unknown;
  raisedAt: Date;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  resolutionNote: string | null;
}

export interface ShapedOrder {
  id: string;
  patientId: string;
  version: number;
  status: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  isCurrent: boolean;
  verification: { status: string; source: string | null; date: string | null };
  override: { userNum: string; reason: string | null; at: Date | null } | null;
  missingFields: Array<{ coverageId: string; field: string }>;
  triggerReason: string | null;
  positions: ShapedOrderPosition[];
  excludedCoverages: Array<{ coverageId: string; ruleCode: string; explanation: string }>;
  flags: ShapedOrderFlag[];
  createdAt: Date;
  createdBy: string | null;
}

/**
 * Flags and statuses that stop a claim going out the door.
 *
 * Imported from types.ts rather than restated here: the same lists are served
 * by GET /cob/enums so the UI can explain a disabled submit button, and a
 * second copy would let the explanation drift from the enforcement.
 */
const BLOCKING_FLAGS: readonly ReviewFlag[] = BLOCKING_REVIEW_FLAGS;
const BLOCKING_STATUSES: readonly OrderStatus[] = BLOCKING_ORDER_STATUSES;

/**
 * Injury relatedness, read off the CLAIM rather than taken on trust.
 *
 * Whether a claim is related to a workers' comp or auto injury is a property
 * of the claim, recorded on `claim.AccidentRelated` / `claim.EmployRelated`.
 * Accepting it from a request body lets a caller route a claim to a comp
 * payer for a service that has nothing to do with the injury — and because
 * INJURY_RELATED is the FIRST rule in the sequence, it overrides every
 * Medicare, Medicaid and plan-level rule beneath it. That is too much power
 * to hand to an unvalidated boolean.
 *
 * Open Dental's encoding (claim.AccidentRelated, one char):
 *   ''/null  not accident related
 *   'A'      auto accident
 *   'E'      employment related
 *   'O'      other accident / liability
 * plus `claim.EmployRelated` as a separate flag for employment.
 *
 * NOTE: nothing in this codebase writes those columns yet, so today they read
 * as "not injury related" for every claim. That is the correct answer for the
 * overwhelming majority, and it is the right SOURCE for when the claim screen
 * starts capturing it — unlike a request field, which is wrong now.
 */
export const deriveClaimInjuryContext = async (
  claimNum: bigint
): Promise<{ injuryRelated: boolean; injuryType: 'WORKERS_COMP' | 'AUTO_LIABILITY' | null }> => {
  const claim = await prisma.claim.findUnique({
    where: { ClaimNum: claimNum },
    select: { AccidentRelated: true, EmployRelated: true },
  });
  if (!claim) return { injuryRelated: false, injuryType: null };

  const accident = String(claim.AccidentRelated ?? '').trim().toUpperCase();
  const employmentRelated = claim.EmployRelated === 1 || accident === 'E';

  if (employmentRelated) return { injuryRelated: true, injuryType: 'WORKERS_COMP' };
  if (accident === 'A') return { injuryRelated: true, injuryType: 'AUTO_LIABILITY' };
  // 'O' is an accident we know is liability-related but cannot attribute to a
  // specific payer type. The rule still applies to whichever coverage IS an
  // injury payer; it just cannot narrow by type.
  if (accident === 'O') return { injuryRelated: true, injuryType: null };

  return { injuryRelated: false, injuryType: null };
};

export interface EvaluateOptions {
  /** DOS the rules reason about. Defaults to `effectiveFrom`. */
  dateOfService?: string;
  /** First date this order version applies to. Defaults to today. */
  effectiveFrom?: string;
  triggerReason?: string;
  claimContext?: Partial<ClaimContext>;
  userNum?: bigint | null;
  req?: Request;
}

export class CobService {
  // ── Reading orders ──────────────────────────────────────────────────────

  /** The order in force today, or null when the patient has never been evaluated. */
  async getCurrentOrder(patientId: string) {
    const patNum = asBigInt(patientId);
    const order = await prisma.cob_coverage_order.findFirst({
      where: { pat_num: patNum, effective_to: null },
      orderBy: { version: 'desc' },
      include: { positions: { orderBy: { position: 'asc' } }, flags: true },
    });
    return order ? this.shapeOrder(order) : null;
  }

  /**
   * The order that was in force on a given date.
   *
   * This is what claims use, never `getCurrentOrder`. A claim entered today
   * for a date of service in February must bill February's order — the
   * patient may have added a plan since, and billing the new primary for an
   * old service is a denial.
   */
  async getOrderForDate(patientId: string, date: string) {
    const patNum = asBigInt(patientId);
    const iso = toIsoDate(date);
    if (!iso) throw new BadRequestError('A valid date (YYYY-MM-DD) is required');
    const target = toDbDate(iso);

    const order = await prisma.cob_coverage_order.findFirst({
      where: {
        pat_num: patNum,
        effective_from: { lte: target },
        OR: [{ effective_to: null }, { effective_to: { gte: target } }],
      },
      orderBy: { version: 'desc' },
      include: { positions: { orderBy: { position: 'asc' } }, flags: true },
    });
    return order ? this.shapeOrder(order) : null;
  }

  async getOrderHistory(patientId: string) {
    const patNum = asBigInt(patientId);
    const orders = await prisma.cob_coverage_order.findMany({
      where: { pat_num: patNum },
      orderBy: { version: 'desc' },
      include: { positions: { orderBy: { position: 'asc' } }, flags: true },
    });
    return orders.map((o) => this.shapeOrder(o));
  }

  // ── Running the pipeline ────────────────────────────────────────────────

  /**
   * Steps 1-7 of the pipeline, persisted as a new version.
   *
   * A staff override is NOT discarded. The spec is explicit and the reason is
   * operational: a biller who overrode the order did so because they spoke to
   * a payer, and losing that because a clerk corrected a typo on an address
   * would be worse than keeping it. The override's positions carry forward and
   * COVERAGE_CHANGED is raised so the biller is told to look again.
   */
  async evaluateAndSave(patientId: string, options: EvaluateOptions = {}) {
    const patNum = asBigInt(patientId);
    const patient = await prisma.patient.findUnique({ where: { PatNum: patNum } });
    if (!patient) throw new NotFoundError('Patient not found');

    const facts = await loadCoverageFacts(patNum);

    // Where does this version's effective range START?
    //
    // An explicit effectiveFrom always wins — a coverage added with a known
    // start date, or a plan change dated to when it was signed.
    //
    // Otherwise: a re-evaluation takes effect TODAY, because whatever
    // changed changed now. But the FIRST evaluation for a patient is
    // backdated to their earliest coverage effective date, and that is not a
    // nicety. A practice turning this feature on has patients who have held
    // two plans for years and claims in flight for dates of service last
    // month. If version 1 started today, every one of those claims would
    // resolve to "no order on file", which checkSubmittable deliberately
    // treats as "do not block" — so the whole gate would silently not apply
    // to exactly the backlog it is most needed for.
    const firstVersion = await prisma.cob_coverage_order.count({ where: { pat_num: patNum } });
    const earliestCoverage = facts
      .map((f) => f.effectiveDate)
      .filter((d): d is string => !!d)
      .sort()[0];

    const effectiveFrom =
      toIsoDate(options.effectiveFrom) ||
      (firstVersion === 0 && earliestCoverage ? earliestCoverage : todayIso());
    const dateOfService = toIsoDate(options.dateOfService) || todayIso();

    // Injury relatedness comes from the CLAIM when we have one. An explicit
    // value still wins — staff correcting a mis-flagged claim is legitimate —
    // but it is no longer the only source, and no longer silently `false`
    // whenever a caller forgot to send it.
    const claimId = options.claimContext?.claimId ?? null;
    const derivedInjury = claimId
      ? await deriveClaimInjuryContext(asBigInt(claimId))
      : { injuryRelated: false, injuryType: null as 'WORKERS_COMP' | 'AUTO_LIABILITY' | null };

    const ctx: ClaimContext = {
      dateOfService,
      injuryRelated: options.claimContext?.injuryRelated ?? derivedInjury.injuryRelated,
      injuryType: options.claimContext?.injuryType ?? derivedInjury.injuryType,
      claimId,
    };

    const result = determineOrder(facts, ctx);

    // ── Step 6: against what the payers told us ─────────────────────────
    const reported = await this.loadPayerReportedSnapshots(patNum, facts);
    const comparison = comparePayerReported(result.positions, reported);

    const flags: ReviewFlag[] = [...result.flags];
    if (comparison.mismatch && !flags.includes('PAYER_MISMATCH')) {
      flags.push('PAYER_MISMATCH');
    }

    const previous = await prisma.cob_coverage_order.findFirst({
      where: { pat_num: patNum },
      orderBy: { version: 'desc' },
      include: { positions: { orderBy: { position: 'asc' } }, flags: true },
    });

    const hadOverride = previous?.status === 'STAFF_OVERRIDE';
    let status: OrderStatus = result.status;
    let positions = result.positions;

    if (hadOverride) {
      // Carry the human's order forward verbatim, but only the coverages that
      // are still rankable — a terminated plan must not stay in the sequence.
      //
      // "Rankable" is computed from the FACTS (medical, in force on the date),
      // NOT from result.positions. Those are empty whenever the pipeline
      // returned NEEDS_INFO, and keying off them would silently discard the
      // override the moment a rule went looking for a fact nobody had
      // entered — losing a decision a biller made on the phone to a payer
      // because of an unrelated blank field.
      const rankableIds = new Set(
        facts
          .filter(
            (f) =>
              f.benefitCategory === 'MEDICAL' &&
              isActiveOn(f.effectiveDate, f.terminationDate, dateOfService)
          )
          .map((f) => f.id)
      );
      const carried = previous!.positions
        .filter((p) => !p.is_excluded && p.position != null && rankableIds.has(p.patplan_num.toString()))
        .sort((a, b) => (a.position || 0) - (b.position || 0));

      if (carried.length > 0) {
        status = 'STAFF_OVERRIDE';
        positions = carried.map((p, index) => ({
          position: index + 1,
          coverageId: p.patplan_num.toString(),
          ruleCode: 'STAFF_OVERRIDE',
          explanation: p.explanation,
        }));
        // New coverages the override never saw go on the end, flagged.
        for (const id of rankableIds) {
          if (!positions.some((kept) => kept.coverageId === id)) {
            positions.push({
              position: positions.length + 1,
              coverageId: id,
              ruleCode: 'STAFF_OVERRIDE_PENDING',
              explanation:
                `This coverage was added after the manual override and has been ` +
                `appended at the end. The override was not changed — review the ` +
                `order and re-confirm it.`,
            });
          }
        }
        if (!flags.includes('COVERAGE_CHANGED')) flags.push('COVERAGE_CHANGED');
      }
    }

    const saved = await prisma.$transaction(async (tx) => {
      // Close every open range at the day before this one starts. Guarded on
      // effective_from so re-running for the same day replaces rather than
      // creating a zero-length range.
      await tx.cob_coverage_order.updateMany({
        where: {
          pat_num: patNum,
          effective_to: null,
          effective_from: { lt: toDbDate(effectiveFrom) },
        },
        data: { effective_to: toDbDate(dayBefore(effectiveFrom)) },
      });
      // A second evaluation on the same effective date supersedes the first
      // outright: two versions cannot both own one day.
      await tx.cob_coverage_order.updateMany({
        where: { pat_num: patNum, effective_to: null, effective_from: toDbDate(effectiveFrom) },
        data: { effective_to: toDbDate(effectiveFrom) },
      });

      const nextVersion = (previous?.version ?? 0) + 1;

      const order = await tx.cob_coverage_order.create({
        data: {
          pat_num: patNum,
          version: nextVersion,
          status,
          effective_from: toDbDate(effectiveFrom),
          effective_to: null,
          verification_status: previous?.verification_status ?? 'UNVERIFIED',
          verification_source: previous?.verification_source ?? null,
          verification_date: previous?.verification_date ?? null,
          override_user_num: hadOverride ? previous?.override_user_num ?? null : null,
          override_reason: hadOverride ? previous?.override_reason ?? null : null,
          override_at: hadOverride ? previous?.override_at ?? null : null,
          missing_fields: result.missingFields.length ? (result.missingFields as any) : undefined,
          trigger_reason: options.triggerReason ?? 'MANUAL_EVALUATION',
          created_by: options.userNum ?? null,
        },
      });

      for (const position of positions) {
        await tx.cob_coverage_order_position.create({
          data: {
            order_id: order.id,
            position: position.position,
            patplan_num: asBigInt(position.coverageId),
            rule_code: position.ruleCode,
            explanation: position.explanation,
            is_excluded: false,
          },
        });
      }

      for (const ex of result.excluded) {
        await tx.cob_coverage_order_position.create({
          data: {
            order_id: order.id,
            position: null,
            patplan_num: asBigInt(ex.coverageId),
            rule_code: ex.ruleCode,
            explanation: ex.explanation,
            is_excluded: true,
          },
        });
      }

      for (const flag of flags) {
        await tx.cob_coverage_order_flag.create({
          data: {
            order_id: order.id,
            flag,
            detail:
              flag === 'PAYER_MISMATCH'
                ? ({ comparison: comparison.detail, explanation: comparison.explanation } as any)
                : flag === 'RANKING_CYCLE'
                  ? ({ pairwise: result.pairwise } as any)
                  : undefined,
          },
        });
      }

      return order;
    });

    // Keep the fast path every other service reads in step with the new
    // current order. Only ever for the order in force now.
    if (!saved.effective_to) {
      await this.syncOrdinals(patNum, positions.map((p) => p.coverageId));
    }

    await writeAudit({
      userNum: options.userNum ?? null,
      permType: PermType.COB_ORDER_SUGGESTED,
      patNum,
      text:
        `COB order v${saved.version} ${status} effective ${effectiveFrom} ` +
        `(trigger: ${options.triggerReason ?? 'MANUAL_EVALUATION'}): ` +
        (positions.length
          ? positions.map((p) => `${p.position}=${p.coverageId}/${p.ruleCode}`).join(', ')
          : 'no rankable coverage') +
        (flags.length ? ` flags=${flags.join('|')}` : '') +
        (result.missingFields.length
          ? ` missing=${result.missingFields.map((m) => `${m.coverageId}.${m.field}`).join('|')}`
          : ''),
      req: options.req,
    });

    for (const flag of flags) {
      await writeAudit({
        userNum: options.userNum ?? null,
        permType: PermType.COB_FLAG_RAISED,
        patNum,
        text: `COB flag ${flag} raised on order v${saved.version}`,
        req: options.req,
      });
    }

    return this.getOrderById(saved.id);
  }

  /**
   * Writes the suggested sequence back onto patplan.Ordinal.
   *
   * Two-phase, into a high range first, because nothing stops two patplans
   * briefly wanting the same Ordinal mid-update and the existing
   * reorder/setPrimary code in patient-insurance.service does the same for
   * the same reason. Excluded (non-medical) coverages are pushed past the
   * ranked ones rather than left where they were, so a fixed-indemnity policy
   * can never read as the primary.
   */
  private async syncOrdinals(patNum: bigint, orderedCoverageIds: string[]): Promise<void> {
    if (orderedCoverageIds.length === 0) return;
    const all = await prisma.patplan.findMany({
      where: { PatNum: patNum },
      select: { PatPlanNum: true },
    });

    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < all.length; i++) {
        await tx.patplan.update({
          where: { PatPlanNum: all[i].PatPlanNum },
          data: { Ordinal: 1000 + i },
        });
      }
      for (let i = 0; i < orderedCoverageIds.length; i++) {
        await tx.patplan.update({
          where: { PatPlanNum: asBigInt(orderedCoverageIds[i]) },
          data: { Ordinal: i + 1 },
        });
      }
      const ranked = new Set(orderedCoverageIds);
      let trailing = orderedCoverageIds.length + 1;
      for (const row of all) {
        if (ranked.has(row.PatPlanNum.toString())) continue;
        await tx.patplan.update({
          where: { PatPlanNum: row.PatPlanNum },
          data: { Ordinal: trailing++ },
        });
      }
    });
  }

  // ── Override ────────────────────────────────────────────────────────────

  /**
   * Staff replaces the suggested order with their own, with a reason.
   *
   * A reason is mandatory and not a formality: it is the only record of why
   * the system's suggestion was wrong, and it is what the next biller reads
   * when a payer disputes the claim. The override is a new version, so the
   * suggestion it replaced stays readable.
   */
  async overrideOrder(
    patientId: string,
    orderedCoverageIds: string[],
    reason: string,
    userNum: bigint,
    req?: Request
  ) {
    const patNum = asBigInt(patientId);
    const trimmedReason = (reason || '').trim();
    if (!trimmedReason) {
      throw new BadRequestError('A reason is required to override the coverage order');
    }
    if (!Array.isArray(orderedCoverageIds) || orderedCoverageIds.length === 0) {
      throw new BadRequestError('orderedCoverageIds must be a non-empty array');
    }
    if (new Set(orderedCoverageIds).size !== orderedCoverageIds.length) {
      throw new BadRequestError('orderedCoverageIds contains duplicates');
    }

    const facts = await loadCoverageFacts(patNum);
    const factById = new Map(facts.map((f) => [f.id, f]));
    for (const id of orderedCoverageIds) {
      const fact = factById.get(id);
      if (!fact) {
        throw new BadRequestError(`Coverage ${id} does not belong to this patient`);
      }
      // A non-medical policy is not billable in the claim's sequence, so
      // letting a human put one there would produce a claim to a payer that
      // does not accept claims.
      if (fact.benefitCategory !== 'MEDICAL') {
        throw new BadRequestError(
          `Coverage ${id} is ${fact.benefitCategory} coverage and does not take part in ` +
            `claim coordination, so it cannot be placed in the order.`
        );
      }
    }

    const previous = await prisma.cob_coverage_order.findFirst({
      where: { pat_num: patNum },
      orderBy: { version: 'desc' },
      include: { positions: true },
    });

    const effectiveFrom = todayIso();
    const previousExplanationBy = new Map(
      (previous?.positions || []).map((p) => [p.patplan_num.toString(), p.explanation])
    );

    const saved = await prisma.$transaction(async (tx) => {
      await tx.cob_coverage_order.updateMany({
        where: { pat_num: patNum, effective_to: null, effective_from: { lt: toDbDate(effectiveFrom) } },
        data: { effective_to: toDbDate(dayBefore(effectiveFrom)) },
      });
      await tx.cob_coverage_order.updateMany({
        where: { pat_num: patNum, effective_to: null, effective_from: toDbDate(effectiveFrom) },
        data: { effective_to: toDbDate(effectiveFrom) },
      });

      const order = await tx.cob_coverage_order.create({
        data: {
          pat_num: patNum,
          version: (previous?.version ?? 0) + 1,
          status: 'STAFF_OVERRIDE',
          effective_from: toDbDate(effectiveFrom),
          verification_status: previous?.verification_status ?? 'UNVERIFIED',
          verification_source: previous?.verification_source ?? null,
          verification_date: previous?.verification_date ?? null,
          override_user_num: userNum,
          override_reason: trimmedReason,
          override_at: new Date(),
          trigger_reason: 'STAFF_OVERRIDE',
          created_by: userNum,
        },
      });

      for (let i = 0; i < orderedCoverageIds.length; i++) {
        const id = orderedCoverageIds[i];
        await tx.cob_coverage_order_position.create({
          data: {
            order_id: order.id,
            position: i + 1,
            patplan_num: asBigInt(id),
            rule_code: 'STAFF_OVERRIDE',
            explanation:
              `Set manually by staff: ${trimmedReason}` +
              (previousExplanationBy.has(id)
                ? ` (the rules had said: ${previousExplanationBy.get(id)})`
                : ''),
            is_excluded: false,
          },
        });
      }

      // Non-medical coverages stay listed and stay out of the ranking, even
      // on an override.
      for (const fact of facts) {
        if (fact.benefitCategory === 'MEDICAL') continue;
        await tx.cob_coverage_order_position.create({
          data: {
            order_id: order.id,
            position: null,
            patplan_num: asBigInt(fact.id),
            rule_code: 'NOT_MEDICAL_COVERAGE',
            explanation:
              `${fact.carrierName || `Coverage ${fact.id}`} is ${fact.benefitCategory} ` +
              `coverage and takes no part in this claim's coordination.`,
            is_excluded: true,
          },
        });
      }

      return order;
    });

    await this.syncOrdinals(patNum, orderedCoverageIds);

    await writeAudit({
      userNum,
      permType: PermType.COB_ORDER_OVERRIDDEN,
      patNum,
      text:
        `COB order overridden to v${saved.version}: ` +
        `${orderedCoverageIds.map((id, i) => `${i + 1}=${id}`).join(', ')}. ` +
        `Reason: ${trimmedReason}`,
      req,
    });

    return this.getOrderById(saved.id);
  }

  // ── Flags ───────────────────────────────────────────────────────────────

  /**
   * Resolve a flag with a note.
   *
   * Resolving does not re-run the pipeline and does not change the order. It
   * records that a human looked at the thing the flag was raised about and
   * says what they found — which is what unblocks claim submission.
   */
  async resolveFlag(
    orderId: string,
    flag: string,
    resolutionNote: string,
    userNum: bigint,
    req?: Request
  ) {
    const note = (resolutionNote || '').trim();
    if (!note) throw new BadRequestError('A resolution note is required');

    const order = await prisma.cob_coverage_order.findUnique({
      where: { id: asBigInt(orderId) },
      include: { flags: true },
    });
    if (!order) throw new NotFoundError('Coverage order not found');

    const open = order.flags.filter((f) => f.flag === flag && f.resolved_at === null);
    if (open.length === 0) {
      throw new NotFoundError(`No unresolved ${flag} flag on this coverage order`);
    }

    await prisma.cob_coverage_order_flag.updateMany({
      where: { order_id: order.id, flag, resolved_at: null },
      data: { resolved_at: new Date(), resolved_by: userNum, resolution_note: note },
    });

    // A DISPUTED order whose COB_DENIAL has been dealt with goes back to
    // being a suggestion that staff can bill. Status is only lifted when NO
    // blocking flag is left open — resolving one of two does not unblock.
    const stillOpen = await prisma.cob_coverage_order_flag.count({
      // Spread: Prisma's `in` wants a mutable array and BLOCKING_FLAGS is
      // readonly, which is the point — nothing should be able to mutate the
      // list that decides whether billing is blocked.
      where: { order_id: order.id, resolved_at: null, flag: { in: [...BLOCKING_FLAGS] } },
    });
    if (stillOpen === 0 && (order.status === 'DISPUTED' || order.status === 'NEEDS_REVIEW')) {
      await prisma.cob_coverage_order.update({
        where: { id: order.id },
        data: { status: order.override_user_num ? 'STAFF_OVERRIDE' : 'SUGGESTED' },
      });
    }

    await writeAudit({
      userNum,
      permType: PermType.COB_FLAG_RESOLVED,
      patNum: order.pat_num,
      text: `COB flag ${flag} resolved on order v${order.version}: ${note}`,
      req,
    });

    return this.getOrderById(order.id);
  }

  // ── Payer-reported coverage (step 6's input) ────────────────────────────

  /**
   * Records what an insurer said, then re-runs the comparison.
   *
   * Note what this does NOT do: it does not change the order to match the
   * payer. The payer decides what they pay, but their records can also simply
   * be out of date, and resolving that is a phone call, not an automatic
   * overwrite. All we do is make the disagreement impossible to miss.
   */
  async recordPayerReportedCoverage(
    input: {
      patientId: string;
      coverageId?: string | null;
      reportingCarrierId?: string | null;
      reportedSelfOrder?: number | null;
      reportedIsActive?: boolean | null;
      otherPayerName?: string | null;
      otherPayerCarrierId?: string | null;
      otherPayerReportedOrder?: number | null;
      reportedDate?: string | null;
      source: EligibilitySource;
      note?: string | null;
      raw?: Record<string, unknown> | null;
    },
    userNum: bigint,
    req?: Request
  ) {
    const patNum = asBigInt(input.patientId);
    const patient = await prisma.patient.findUnique({ where: { PatNum: patNum } });
    if (!patient) throw new NotFoundError('Patient not found');

    const reportedDate = toIsoDate(input.reportedDate) || todayIso();
    if (!(ELIGIBILITY_SOURCES as readonly string[]).includes(input.source)) {
      throw new BadRequestError(`source must be one of: ${ELIGIBILITY_SOURCES.join(', ')}`);
    }

    let patPlanNum: bigint | null = null;
    let reportingCarrierNum: bigint | null = input.reportingCarrierId
      ? asBigInt(input.reportingCarrierId)
      : null;

    if (input.coverageId) {
      const patPlan = await prisma.patplan.findFirst({
        where: { PatPlanNum: asBigInt(input.coverageId), PatNum: patNum },
        include: { inssub: { include: { insplan: true } } },
      });
      if (!patPlan) {
        throw new BadRequestError('coverageId does not belong to this patient');
      }
      patPlanNum = patPlan.PatPlanNum;
      // The reporting payer is the carrier on the coverage we asked about,
      // unless the caller named a different one.
      reportingCarrierNum = reportingCarrierNum ?? patPlan.inssub?.insplan?.CarrierNum ?? null;
    }

    const row = await prisma.cob_payer_reported_coverage.create({
      data: {
        pat_num: patNum,
        patplan_num: patPlanNum,
        reporting_carrier_num: reportingCarrierNum,
        reported_self_order: input.reportedSelfOrder ?? null,
        reported_is_active: input.reportedIsActive ?? null,
        other_payer_name: input.otherPayerName ?? null,
        other_payer_carrier_num: input.otherPayerCarrierId
          ? asBigInt(input.otherPayerCarrierId)
          : null,
        other_payer_reported_order: input.otherPayerReportedOrder ?? null,
        reported_date: toDbDate(reportedDate),
        source: input.source,
        raw: (input.raw ?? undefined) as any,
        note: input.note ?? null,
        created_by: userNum,
      },
    });

    await writeAudit({
      userNum,
      permType: PermType.COB_PAYER_REPORTED,
      patNum,
      text:
        `Payer-reported coverage recorded (${input.source}, ${reportedDate}): ` +
        `coverage=${patPlanNum ?? 'n/a'} reportedSelfOrder=${input.reportedSelfOrder ?? 'n/a'} ` +
        `otherPayer=${input.otherPayerName ?? 'n/a'}`,
      req,
    });

    // Step 6 again, now that there is new evidence.
    const order = await this.refreshPayerComparison(patNum, userNum, req);

    // A payer confirming the coverage is active and naming its own position
    // is a verification. Recording it as one is what lets a biller see that
    // the order is not merely a guess.
    if (input.reportedIsActive === true && input.reportedSelfOrder != null && order) {
      await prisma.cob_coverage_order.update({
        where: { id: asBigInt(order.id) },
        data: {
          verification_status: 'VERIFIED_WITH_PAYER',
          verification_source: input.source,
          verification_date: toDbDate(reportedDate),
        },
      });
      await writeAudit({
        userNum,
        permType: PermType.COB_VERIFIED,
        patNum,
        text: `COB order v${order.version} verified with payer via ${input.source} on ${reportedDate}`,
        req,
      });
    }

    return {
      payerReportedCoverage: {
        id: row.id.toString(),
        patientId: patNum.toString(),
        coverageId: patPlanNum?.toString() ?? null,
        reportedSelfOrder: row.reported_self_order,
        reportedIsActive: row.reported_is_active,
        otherPayerName: row.other_payer_name,
        otherPayerReportedOrder: row.other_payer_reported_order,
        reportedDate,
        source: row.source,
        note: row.note,
      },
      order: await this.getCurrentOrder(patNum.toString()),
    };
  }

  async listPayerReportedCoverage(patientId: string) {
    const patNum = asBigInt(patientId);
    const rows = await prisma.cob_payer_reported_coverage.findMany({
      where: { pat_num: patNum },
      orderBy: [{ reported_date: 'desc' }, { id: 'desc' }],
    });
    const carrierNums = rows
      .flatMap((r) => [r.reporting_carrier_num, r.other_payer_carrier_num])
      .filter((v): v is bigint => v != null);
    const carriers = carrierNums.length
      ? await prisma.carrier.findMany({
          where: { CarrierNum: { in: carrierNums } },
          select: { CarrierNum: true, CarrierName: true },
        })
      : [];
    const nameBy = new Map(carriers.map((c) => [c.CarrierNum.toString(), c.CarrierName]));

    return rows.map((r) => ({
      id: r.id.toString(),
      coverageId: r.patplan_num?.toString() ?? null,
      reportingCarrierId: r.reporting_carrier_num?.toString() ?? null,
      reportingCarrierName: r.reporting_carrier_num
        ? nameBy.get(r.reporting_carrier_num.toString()) ?? null
        : null,
      reportedSelfOrder: r.reported_self_order,
      reportedIsActive: r.reported_is_active,
      otherPayerName: r.other_payer_name,
      otherPayerCarrierId: r.other_payer_carrier_num?.toString() ?? null,
      otherPayerReportedOrder: r.other_payer_reported_order,
      reportedDate: toIsoDate(r.reported_date),
      source: r.source,
      note: r.note,
      createdAt: r.created_at,
    }));
  }

  /**
   * Re-runs the comparison against the CURRENT order and raises or clears
   * PAYER_MISMATCH. Does not create a new version: the order has not changed,
   * only our confidence in it.
   */
  private async refreshPayerComparison(patNum: bigint, userNum: bigint, req?: Request) {
    const order = await prisma.cob_coverage_order.findFirst({
      where: { pat_num: patNum, effective_to: null },
      orderBy: { version: 'desc' },
      include: { positions: { orderBy: { position: 'asc' } }, flags: true },
    });
    if (!order) return null;

    const facts = await loadCoverageFacts(patNum);
    const reported = await this.loadPayerReportedSnapshots(patNum, facts);
    const positions = order.positions
      .filter((p) => !p.is_excluded && p.position != null)
      .map((p) => ({
        position: p.position!,
        coverageId: p.patplan_num.toString(),
        ruleCode: p.rule_code,
        explanation: p.explanation,
      }));

    const comparison = comparePayerReported(positions, reported);
    const existing = order.flags.find((f) => f.flag === 'PAYER_MISMATCH' && f.resolved_at === null);

    if (comparison.mismatch && !existing) {
      await prisma.cob_coverage_order_flag.create({
        data: {
          order_id: order.id,
          flag: 'PAYER_MISMATCH',
          detail: { comparison: comparison.detail, explanation: comparison.explanation } as any,
        },
      });
      await writeAudit({
        userNum,
        permType: PermType.COB_FLAG_RAISED,
        patNum,
        text: `COB flag PAYER_MISMATCH raised on order v${order.version}: ${comparison.explanation}`,
        req,
      });
    } else if (!comparison.mismatch && existing) {
      // The payers now agree with us. Close the flag with provenance rather
      // than deleting it — "this used to disagree" is worth keeping.
      await prisma.cob_coverage_order_flag.update({
        where: { id: existing.id },
        data: {
          resolved_at: new Date(),
          resolved_by: userNum,
          resolution_note:
            'Resolved automatically: the latest payer-reported coverage now agrees with the suggested order.',
        },
      });
      await writeAudit({
        userNum,
        permType: PermType.COB_FLAG_RESOLVED,
        patNum,
        text: `COB flag PAYER_MISMATCH cleared on order v${order.version} by new payer report`,
        req,
      });
    }

    return this.getOrderById(order.id);
  }

  private async loadPayerReportedSnapshots(
    patNum: bigint,
    facts: CoverageFacts[]
  ): Promise<PayerReportedSnapshot[]> {
    const rows = await prisma.cob_payer_reported_coverage.findMany({
      where: { pat_num: patNum },
      orderBy: { reported_date: 'asc' },
    });
    if (rows.length === 0) return [];

    const byCarrier = new Map<string, CoverageFacts>();
    for (const fact of facts) {
      if (fact.carrierId) byCarrier.set(fact.carrierId, fact);
    }

    return rows.map((r) => {
      // Prefer the explicit coverage link; fall back to matching the
      // reporting carrier to a coverage, which is how a 271 arrives.
      const coverageId =
        r.patplan_num?.toString() ??
        (r.reporting_carrier_num
          ? byCarrier.get(r.reporting_carrier_num.toString())?.id ?? null
          : null);
      return {
        coverageId,
        reportedSelfOrder: r.reported_self_order,
        reportedDate: toIsoDate(r.reported_date) || todayIso(),
        source: r.source,
        reportingCarrierName: coverageId
          ? facts.find((f) => f.id === coverageId)?.carrierName ?? null
          : null,
      };
    });
  }

  /**
   * The coverage order that applies to ONE claim, computed read-only.
   *
   * Why this is separate from the stored order: injury relatedness is a
   * property of the CLAIM, not of the patient and date. A workers' comp claim
   * and a flu shot on the same date of service legitimately have different
   * primaries, so a single stored order per date range cannot represent both.
   *
   * Rather than persist one and let it mislead the other, the stored order
   * stays the patient-level answer and this returns the claim-level one in
   * memory. Nothing is written, so calling it is free of version churn and
   * cannot change what another claim reads.
   *
   * `differsFromStoredOrder` tells the caller whether the claim's own flags
   * actually moved anything, which is the only case worth surfacing in a UI.
   */
  async getOrderForClaim(claimId: string) {
    const claimNum = asBigInt(claimId);
    const claim = await prisma.claim.findUnique({
      where: { ClaimNum: claimNum },
      select: { PatNum: true, DateService: true },
    });
    if (!claim?.PatNum) throw new NotFoundError('Claim not found');

    const patNum = claim.PatNum;
    const dateOfService = toIsoDate(claim.DateService) || todayIso();

    const injury = await deriveClaimInjuryContext(claimNum);
    const facts = await loadCoverageFacts(patNum);
    const result = determineOrder(facts, {
      dateOfService,
      injuryRelated: injury.injuryRelated,
      injuryType: injury.injuryType,
      claimId,
    });

    const stored = await this.getOrderForDate(patNum.toString(), dateOfService);
    const storedSequence = (stored?.positions ?? []).map((p) => p.coverageId);
    const claimSequence = result.positions.map((p) => p.coverageId);

    return {
      claimId,
      patientId: patNum.toString(),
      dateOfService,
      injury,
      /** Status/flags still come from the stored order — that is the gate. */
      storedOrder: stored,
      claimOrder: {
        status: result.status,
        positions: result.positions,
        excluded: result.excluded,
        flags: result.flags,
        missingFields: result.missingFields,
      },
      differsFromStoredOrder:
        storedSequence.length !== claimSequence.length ||
        storedSequence.some((id, index) => id !== claimSequence[index]),
    };
  }

  // ── Claim gating ────────────────────────────────────────────────────────

  /**
   * May a claim for this date of service go out?
   *
   * Returns a reason rather than throwing, so callers can surface it on a
   * dry-run ("why is the submit button disabled?") as well as enforce it.
   *
   * No order at all is NOT a block. Plenty of patients have a single plan and
   * no COB history, and refusing to bill them until somebody clicks evaluate
   * would be a regression for every existing workflow.
   */
  async checkSubmittable(
    patientId: string,
    dateOfService: string
  ): Promise<{ allowed: boolean; reason: string | null; orderId: string | null; status: string | null }> {
    const order = await this.getOrderForDate(patientId, dateOfService);
    if (!order) return { allowed: true, reason: null, orderId: null, status: null };

    const openFlags = order.flags.filter((f) => f.resolvedAt === null);

    if (order.status === 'NEEDS_INFO') {
      const fields = (order.missingFields || [])
        .map((m) => `${m.coverageId}.${m.field}`)
        .join(', ');
      return {
        allowed: false,
        orderId: order.id,
        status: order.status,
        reason:
          `The coverage order for ${dateOfService} is incomplete: a coordination ` +
          `rule needs information we do not have${fields ? ` (${fields})` : ''}. Fill ` +
          `that in and re-evaluate — submitting now would send the claim to a payer ` +
          `chosen by guesswork.`,
      };
    }

    if (order.status === 'NEEDS_REVIEW') {
      return {
        allowed: false,
        orderId: order.id,
        status: order.status,
        reason:
          `The coverage order for ${dateOfService} needs review` +
          `${openFlags.length ? ` (${openFlags.map((f) => f.flag).join(', ')})` : ''}. ` +
          `Resolve it before submitting.`,
      };
    }

    const blocking = openFlags.filter((f) => BLOCKING_FLAGS.includes(f.flag as ReviewFlag));
    if (blocking.length > 0) {
      const mismatch = blocking.find((f) => f.flag === 'PAYER_MISMATCH');
      return {
        allowed: false,
        orderId: order.id,
        status: order.status,
        reason: mismatch
          ? `A payer's records disagree with this coverage order and the ` +
            `PAYER_MISMATCH flag is unresolved. ` +
            `${(mismatch.detail as any)?.explanation || ''} Resolve the flag once you ` +
            `have confirmed the order with the payer.`
          : `The coverage order has unresolved flags (` +
            `${blocking.map((f) => f.flag).join(', ')}) and cannot be billed yet.`,
      };
    }

    if (BLOCKING_STATUSES.includes(order.status as OrderStatus)) {
      return {
        allowed: false,
        orderId: order.id,
        status: order.status,
        reason: `The coverage order for ${dateOfService} is ${order.status} and cannot be billed yet.`,
      };
    }

    return { allowed: true, reason: null, orderId: order.id, status: order.status };
  }

  /** Throws when a claim must not be submitted. Audits the refusal. */
  async assertSubmittable(
    patientId: string,
    dateOfService: string,
    options: { userNum?: bigint | null; claimId?: string | null; req?: Request } = {}
  ): Promise<void> {
    const check = await this.checkSubmittable(patientId, dateOfService);
    if (check.allowed) return;

    await writeAudit({
      userNum: options.userNum ?? null,
      permType: PermType.COB_SUBMISSION_BLOCKED,
      patNum: asBigInt(patientId),
      text:
        `Claim submission blocked by COB (${check.status}` +
        `${options.claimId ? `, claim ${options.claimId}` : ''}): ${check.reason}`,
      req: options.req,
    });

    throw new ConflictError(check.reason || 'Coverage order is not ready for billing');
  }

  /**
   * Which coverage should this position in the sequence be billed to?
   * Used by claim creation to pick the right payer for a date of service.
   */
  async getCoverageForPosition(patientId: string, dateOfService: string, position: number) {
    const order = await this.getOrderForDate(patientId, dateOfService);
    if (!order) return null;
    const match = order.positions.find((p) => p.position === position);
    if (!match) return null;

    const patPlan = await prisma.patplan.findUnique({
      where: { PatPlanNum: asBigInt(match.coverageId) },
      include: { inssub: { include: { insplan: { include: { carrier: true } } } } },
    });
    if (!patPlan) return null;

    return {
      position,
      coverageId: match.coverageId,
      patPlanNum: patPlan.PatPlanNum,
      insSubNum: patPlan.inssub?.InsSubNum ?? null,
      planNum: patPlan.inssub?.insplan?.PlanNum ?? null,
      carrierNum: patPlan.inssub?.insplan?.CarrierNum ?? null,
      carrierName: patPlan.inssub?.insplan?.carrier?.CarrierName ?? null,
      memberId: patPlan.inssub?.SubscriberID ?? null,
      ruleCode: match.ruleCode,
      explanation: match.explanation,
    };
  }

  // ── Secondary estimate ──────────────────────────────────────────────────

  /**
   * Estimates what a coverage will pay as secondary. Display only — see the
   * header of estimate.ts. Returns a RANGE when the plan's method is UNKNOWN.
   *
   * EVERY INPUT IS RESOLVED SERVER-SIDE.
   * ------------------------------------
   * This used to take the allowed amount, the benefit percentage, the
   * remaining deductible and the primary's payment from the CALLER. That is
   * wrong three times over:
   *
   *  - The benefit percentage and the contracted allowance are facts about the
   *    PLAN, held in its coverage table and fee schedule. A client sending its
   *    own numbers can quote a patient a figure the plan never agreed to, and
   *    an omitted percentage silently became 0% — a confident "your secondary
   *    pays nothing".
   *  - The remaining deductible is a running balance the deductible engine
   *    owns; a client cannot know what other claims have already reserved.
   *  - The primary's paid and allowed amounts and the patient responsibility
   *    it left are on the primary's REMITTANCE. Taking them from a request
   *    body means the estimate can disagree with the money actually posted.
   *
   * So the caller now supplies only identifiers and the billed amount:
   * `procedureCode` (to price against) and `primaryClaimId` (to read the
   * primary's adjudication from). Anything still passed explicitly is treated
   * as a staff override and reported as such in `inputs.resolvedFrom`, so a
   * quoted figure can always be traced to where each number came from.
   */
  async estimateSecondary(
    coverageId: string,
    input: {
      /** CDT/procedure code to price. Required to resolve the plan's terms. */
      procedureCode?: string | null;
      /** The primary claim whose remittance this coordinates against. */
      primaryClaimId?: string | null;
      billedAmount?: number;
      /** Staff overrides. Omit to use the plan's / remittance's own figures. */
      allowedAmount?: number;
      primaryPaid?: number;
      primaryPatientResponsibility?: number;
      secondaryCoveragePercent?: number;
      secondaryDeductibleRemaining?: number;
    }
  ) {
    const patPlan = await prisma.patplan.findUnique({
      where: { PatPlanNum: asBigInt(coverageId) },
      include: { inssub: { include: { insplan: { include: { carrier: true } } } } },
    });
    if (!patPlan) throw new NotFoundError('Coverage not found');

    const planNum = patPlan.inssub?.insplan?.PlanNum;
    const profile = planNum
      ? await prisma.cob_plan_profile.findUnique({ where: { plan_num: planNum } })
      : null;
    const method = (profile?.cob_payment_method as any) || 'UNKNOWN';

    const resolvedFrom: Record<string, string> = {};
    const warnings: string[] = [];

    // ── The primary's adjudication, from its remittance ──────────────────
    let primaryPaid = input.primaryPaid;
    let primaryPatientResponsibility = input.primaryPatientResponsibility;
    let allowedAmount = input.allowedAmount;
    let billedAmount = Number(input.billedAmount) || 0;

    if (input.primaryClaimId) {
      const { getPrimaryRemittanceStatus } = await import('./claim-cob.service');
      const remittance = await getPrimaryRemittanceStatus(asBigInt(input.primaryClaimId));
      if (!remittance.posted) {
        warnings.push(
          `The primary claim ${input.primaryClaimId} has no posted remittance yet, so ` +
            `there is nothing for the secondary to coordinate against. This estimate ` +
            `is based only on the plan's own terms.`
        );
      } else {
        if (primaryPaid === undefined) {
          primaryPaid = remittance.paidAmount;
          resolvedFrom.primaryPaid = 'PRIMARY_REMITTANCE';
        }
        if (primaryPatientResponsibility === undefined) {
          primaryPatientResponsibility = remittance.patientResponsibility;
          resolvedFrom.primaryPatientResponsibility = 'PRIMARY_REMITTANCE';
        }
        if (!billedAmount) {
          // The primary billed what we billed; its allowed + write-off is the
          // charge. Only used when the caller gave no billed amount.
          billedAmount = remittance.allowedAmount;
          resolvedFrom.billedAmount = 'PRIMARY_REMITTANCE';
        }
      }
    }

    // ── The plan's own terms, from its fee schedule and coverage table ───
    let secondaryCoveragePercent = input.secondaryCoveragePercent;
    let secondaryDeductibleRemaining = input.secondaryDeductibleRemaining;

    if (input.procedureCode) {
      const { invoiceService } = await import('../invoice.service');
      const basis = await invoiceService.getCobEstimateBasis(
        patPlan.PatPlanNum,
        input.procedureCode
      );
      if (!basis) {
        warnings.push(
          `This coverage has no insurance plan on file, so its own benefit cannot ` +
            `be priced. Only the primary's figures below are real.`
        );
      } else {
        if (secondaryCoveragePercent === undefined && basis.coveragePercent !== null) {
          secondaryCoveragePercent = basis.coveragePercent;
          resolvedFrom.secondaryCoveragePercent = basis.resolvedFrom.coveragePercent;
        }
        if (allowedAmount === undefined && basis.allowedAmount !== null) {
          allowedAmount = basis.allowedAmount;
          resolvedFrom.allowedAmount = basis.resolvedFrom.allowedAmount;
        } else if (allowedAmount === undefined) {
          warnings.push(
            `${input.procedureCode} is not on this plan's fee schedule, so its ` +
              `contracted allowance is unknown and the billed amount is used instead. ` +
              `The real allowance will come from the remittance.`
          );
        }
        if (secondaryDeductibleRemaining === undefined) {
          secondaryDeductibleRemaining = basis.deductibleRemaining;
          resolvedFrom.secondaryDeductibleRemaining = 'PLAN_DEDUCTIBLE_LEDGER';
        }
      }
    }

    // A missing benefit percentage is NOT 0%. Zero is a real answer ("this
    // plan covers nothing for this code") and must not be manufactured out of
    // an unresolved lookup, or the patient is told their secondary pays
    // nothing when nobody actually knows.
    if (secondaryCoveragePercent === undefined) {
      warnings.push(
        `This plan's benefit percentage for this service could not be resolved` +
          `${input.procedureCode ? '' : ' (no procedureCode was supplied)'}, so no ` +
          `secondary payment can be estimated. Record the plan's coverage table, or ` +
          `pass secondaryCoveragePercent explicitly to override.`
      );
      return {
        coverageId,
        carrierName: patPlan.inssub?.insplan?.carrier?.CarrierName ?? null,
        cobPaymentMethod: method,
        cobInfoSource: profile?.cob_info_source ?? 'DEFAULT',
        estimate: null,
        inputs: {
          billedAmount,
          allowedAmount: allowedAmount ?? null,
          primaryPaid: primaryPaid ?? null,
          primaryPatientResponsibility: primaryPatientResponsibility ?? null,
          secondaryCoveragePercent: null,
          secondaryDeductibleRemaining: secondaryDeductibleRemaining ?? null,
          resolvedFrom,
        },
        warnings,
        disclaimer:
          'Estimate only. The amount actually paid comes from the payer’s remittance.',
      };
    }

    for (const [key, value] of Object.entries({
      billedAmount: input.billedAmount,
      allowedAmount: input.allowedAmount,
      primaryPaid: input.primaryPaid,
      primaryPatientResponsibility: input.primaryPatientResponsibility,
      secondaryCoveragePercent: input.secondaryCoveragePercent,
      secondaryDeductibleRemaining: input.secondaryDeductibleRemaining,
    })) {
      if (value !== undefined && !resolvedFrom[key]) resolvedFrom[key] = 'STAFF_OVERRIDE';
    }

    const estimateInput: SecondaryEstimateInput = {
      billedAmount,
      allowedAmount: allowedAmount ?? 0,
      primaryPaid: primaryPaid ?? 0,
      primaryPatientResponsibility: primaryPatientResponsibility ?? 0,
      secondaryCoveragePercent,
      secondaryDeductibleRemaining: secondaryDeductibleRemaining ?? 0,
    };

    return {
      coverageId,
      carrierName: patPlan.inssub?.insplan?.carrier?.CarrierName ?? null,
      cobPaymentMethod: method,
      cobInfoSource: profile?.cob_info_source ?? 'DEFAULT',
      estimate: estimateSecondaryPayment(method, estimateInput),
      /** Every figure the estimate used, and where it came from. */
      inputs: { ...estimateInput, resolvedFrom },
      warnings,
      disclaimer:
        'Estimate only. The amount actually paid comes from the payer’s remittance.',
    };
  }

  // ── COB denial ──────────────────────────────────────────────────────────

  /**
   * Called when a remittance denies a claim for a COB reason.
   *
   * Sets the order DISPUTED, raises COB_DENIAL, and creates a task for a
   * human — because a COB denial is the insurer telling us our order is
   * wrong, and nothing in this system is allowed to decide that on its own.
   */
  async handleCobDenial(input: {
    claimNum: bigint;
    adjustments?: AdjustmentCode[];
    freeText?: string | null;
    userNum?: bigint | null;
    req?: Request;
  }) {
    const detection = detectCobDenial(input.adjustments || [], input.freeText);
    if (!detection.isCobDenial) return { handled: false, detection };

    const claim = await prisma.claim.findUnique({
      where: { ClaimNum: input.claimNum },
      include: { patient: true },
    });
    if (!claim?.PatNum) return { handled: false, detection };

    const patNum = claim.PatNum;
    const dos = toIsoDate(claim.DateService) || todayIso();
    const userNum = input.userNum ?? null;

    const order = await prisma.cob_coverage_order.findFirst({
      where: {
        pat_num: patNum,
        effective_from: { lte: toDbDate(dos) },
        OR: [{ effective_to: null }, { effective_to: { gte: toDbDate(dos) } }],
      },
      orderBy: { version: 'desc' },
      include: { flags: true },
    });

    if (order) {
      await prisma.cob_coverage_order.update({
        where: { id: order.id },
        data: { status: 'DISPUTED' },
      });
      const existing = order.flags.find((f) => f.flag === 'COB_DENIAL' && f.resolved_at === null);
      if (!existing) {
        await prisma.cob_coverage_order_flag.create({
          data: {
            order_id: order.id,
            flag: 'COB_DENIAL',
            detail: {
              claimNum: input.claimNum.toString(),
              dateOfService: dos,
              matched: detection.matched,
              explanation: detection.explanation,
            } as any,
          },
        });
      }
    }

    const taskDescription =
      `COB denial on claim ${claim.ClaimNum} (${claim.patient?.FName ?? ''} ` +
      `${claim.patient?.LName ?? ''}, DOS ${dos}): ${detection.explanation}`;

    let taskNum: string | null = null;
    try {
      const { taskService } = await import('../task.service');
      const task = await taskService.createTask(
        {
          Descript: taskDescription.slice(0, 2000),
          KeyNum: patNum.toString(),
        },
        // The task service wants an acting user as a string. A
        // system-triggered denial (ERA auto-post with no logged-in user) has
        // none, and the task still has to exist — an unassigned COB task is
        // far better than a swallowed denial.
        userNum ? userNum.toString() : ''
      );
      taskNum = (task as any)?.TaskNum?.toString?.() ?? (task as any)?._id ?? null;
    } catch (error) {
      // A task we could not create must not swallow the denial itself: the
      // flag and the audit row above are the durable record, and losing the
      // whole handler to a task-list misconfiguration would hide the denial.
      console.error('COB denial: failed to create staff task', error);
    }

    await writeAudit({
      userNum,
      permType: PermType.COB_DENIAL,
      patNum,
      text:
        `COB denial detected on claim ${claim.ClaimNum} (DOS ${dos}); order ` +
        `${order ? `v${order.version} set DISPUTED` : 'not found'}; ` +
        `codes=${detection.matched.map((m) => `${m.groupCode}-${m.reasonCode}`).join('|')}` +
        `${taskNum ? `; task ${taskNum}` : '; task creation failed'}`,
      req: input.req,
    });

    return {
      handled: true,
      detection,
      orderId: order?.id.toString() ?? null,
      taskNum,
      suggestedAction: 'RE_VERIFY_ELIGIBILITY' as const,
    };
  }

  // ── Shaping ─────────────────────────────────────────────────────────────

  async getOrderById(orderId: string | bigint) {
    const order = await prisma.cob_coverage_order.findUnique({
      where: { id: asBigInt(orderId as any) },
      include: { positions: { orderBy: { position: 'asc' } }, flags: true },
    });
    if (!order) throw new NotFoundError('Coverage order not found');
    return this.shapeOrder(order);
  }

  private shapeOrder(order: any): ShapedOrder {
    const ranked = order.positions
      .filter((p: any) => !p.is_excluded)
      .sort((a: any, b: any) => (a.position || 0) - (b.position || 0));
    const excluded = order.positions.filter((p: any) => p.is_excluded);

    return {
      id: order.id.toString(),
      patientId: order.pat_num.toString(),
      version: order.version,
      status: order.status,
      effectiveFrom: toIsoDate(order.effective_from),
      effectiveTo: toIsoDate(order.effective_to),
      isCurrent: order.effective_to === null,
      verification: {
        status: order.verification_status,
        source: order.verification_source,
        date: toIsoDate(order.verification_date),
      },
      override: order.override_user_num
        ? {
            userNum: order.override_user_num.toString(),
            reason: order.override_reason,
            at: order.override_at,
          }
        : null,
      missingFields: order.missing_fields ?? [],
      triggerReason: order.trigger_reason,
      positions: ranked.map((p: any) => ({
        position: p.position,
        coverageId: p.patplan_num.toString(),
        ruleCode: p.rule_code,
        explanation: p.explanation,
      })),
      /** Fixed-benefit and other non-medical policies: shown, never ranked. */
      excludedCoverages: excluded.map((p: any) => ({
        coverageId: p.patplan_num.toString(),
        ruleCode: p.rule_code,
        explanation: p.explanation,
      })),
      flags: order.flags.map((f: any) => ({
        id: f.id.toString(),
        flag: f.flag,
        detail: f.detail ?? null,
        raisedAt: f.raised_at,
        resolvedAt: f.resolved_at,
        resolvedBy: f.resolved_by?.toString() ?? null,
        resolutionNote: f.resolution_note,
      })),
      createdAt: order.created_at,
      createdBy: order.created_by?.toString() ?? null,
    };
  }

  /**
   * Every COB vocabulary the UI needs, served from the server.
   *
   * This exists so the frontend never hardcodes a COB value. It covers the
   * field value lists, the order statuses and review flags, which flags block
   * billing, the rule catalogue (code + description, so a UI legend does not
   * restate rule names), the statutory thresholds behind the Medicare rules
   * (so a help string can say "20 or more employees" without the number being
   * duplicated client-side), the COB-denial CARCs, and the plan-profile
   * defaults (so a screen can show what an unrecorded plan is assumed to be).
   */
  getEnums() {
    return {
      ...COB_ENUMS,
      orderStatus: ORDER_STATUSES,
      reviewFlag: REVIEW_FLAGS,
      verificationStatus: VERIFICATION_STATUSES,
      eligibilitySource: ELIGIBILITY_SOURCES,
      responsibleParty: RESPONSIBLE_PARTIES,
      /** Unresolved, these stop claim submission. */
      blockingReviewFlags: BLOCKING_REVIEW_FLAGS,
      blockingOrderStatuses: BLOCKING_ORDER_STATUSES,
      /** Rule code -> what it means, in the statutory order they are applied. */
      rules: COB_RULES.map((rule) => ({ code: rule.code, description: rule.description })),
      /** Non-rule codes a position can carry. */
      positionRuleCodes: [
        { code: 'SOLE_COVERAGE', description: 'The only medical coverage in force' },
        { code: 'TIE_BREAK_STABLE', description: 'No rule could decide; stable fallback order' },
        { code: 'STAFF_OVERRIDE', description: 'Set manually by staff' },
        {
          code: 'STAFF_OVERRIDE_PENDING',
          description: 'Added after the override and appended, pending review',
        },
        {
          code: 'NOT_MEDICAL_COVERAGE',
          description: 'Listed but not ranked — takes no part in claim coordination',
        },
      ],
      /** Federal thresholds behind the Medicare Secondary Payer rules. */
      mspThresholds: MSP_THRESHOLDS,
      /** CARCs that mean the payer disputes our coverage order. */
      cobDenialCarcs: COB_DENIAL_CARCS,
      /** COB-related but routine — deliberately NOT treated as a denial. */
      cobInformationalCarcs: COB_INFORMATIONAL_CARCS,
      /** What a plan with no recorded COB profile is assumed to be. */
      planProfileDefaults: COB_PLAN_PROFILE_DEFAULTS,
      payerTypeDefault: COB_PAYER_TYPE_DEFAULT,
      /** The four real coordination methods; UNKNOWN yields a range instead. */
      cobPaymentMethodsEstimatable: COB_PAYMENT_METHODS,
    };
  }

  /** Which coverages are active on a date — the pipeline's step 1, exposed. */
  async listCoverages(patientId: string, dateOfService?: string) {
    const patNum = asBigInt(patientId);
    const dos = toIsoDate(dateOfService) || todayIso();
    const facts = await loadCoverageFacts(patNum);
    return facts.map((f) => ({
      ...f,
      activeOnDate: isActiveOn(f.effectiveDate, f.terminationDate, dos),
    }));
  }
}

export const cobService = new CobService();
