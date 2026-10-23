/**
 * The COB facts the front desk records about a patient's coverage.
 *
 * These are the fields the rules ask for and Open Dental has nowhere to
 * store: employment status, employer size, Medicare entitlement reason,
 * custody. Writing any of them re-runs the pipeline, because the whole point
 * of recording them is to answer a NEEDS_INFO.
 */

import type { Request } from 'express';
import { prisma } from '../../config/db';
import { BadRequestError, NotFoundError } from '../../utils/error.util';
import { writeAudit } from '../audit.service';
import { PermType } from '../../constants/audit-types';
import { COB_ENUMS } from './facts';
import { cobService } from './cob.service';
import { toIsoDate } from './date.util';

export interface CoverageDetailInput {
  coverageBasis?: string | null;
  subscriberEmploymentStatus?: string | null;
  employerSizeBand?: string | null;
  medicareEntitlementReason?: string | null;
  esrdEntitlementDate?: string | null;
  subscriberName?: string | null;
  subscriberBirthdate?: string | null;
  custodyArrangement?: string | null;
  custodyRole?: string | null;
  courtOrderExists?: boolean;
  courtOrderNamesThisCoverage?: boolean;
  isTricareSupplement?: boolean;
}

const COLUMN: Record<keyof CoverageDetailInput, string> = {
  coverageBasis: 'coverage_basis',
  subscriberEmploymentStatus: 'subscriber_employment_status',
  employerSizeBand: 'employer_size_band',
  medicareEntitlementReason: 'medicare_entitlement_reason',
  esrdEntitlementDate: 'esrd_entitlement_date',
  subscriberName: 'subscriber_name',
  subscriberBirthdate: 'subscriber_birthdate',
  custodyArrangement: 'custody_arrangement',
  custodyRole: 'custody_role',
  courtOrderExists: 'court_order_exists',
  courtOrderNamesThisCoverage: 'court_order_names_this_coverage',
  isTricareSupplement: 'is_tricare_supplement',
};

const toDbDate = (iso: string | null): Date | null =>
  iso ? new Date(`${iso}T00:00:00.000Z`) : null;

export class CoverageDetailService {
  async get(coverageId: string) {
    const patPlanNum = BigInt(coverageId);
    const patPlan = await prisma.patplan.findUnique({ where: { PatPlanNum: patPlanNum } });
    if (!patPlan) throw new NotFoundError('Coverage not found');

    const detail = await prisma.cob_coverage_detail.findUnique({
      where: { patplan_num: patPlanNum },
    });
    return this.shape(coverageId, detail);
  }

  /**
   * Upserts the detail and re-evaluates the patient's order.
   *
   * Explicit nulls are honoured (they clear a field) — distinguishing
   * "not supplied" from "supplied as empty" matters here, because clearing an
   * employer size band must take the order back to NEEDS_INFO rather than
   * leaving a stale value deciding who gets billed.
   */
  async upsert(
    coverageId: string,
    input: CoverageDetailInput,
    userNum: bigint,
    options: { req?: Request } = {}
  ) {
    const patPlanNum = BigInt(coverageId);
    const patPlan = await prisma.patplan.findUnique({ where: { PatPlanNum: patPlanNum } });
    if (!patPlan) throw new NotFoundError('Coverage not found');
    if (!patPlan.PatNum) throw new BadRequestError('Coverage is not linked to a patient');

    this.validate(input);

    const before = await prisma.cob_coverage_detail.findUnique({
      where: { patplan_num: patPlanNum },
    });

    const data: Record<string, any> = {};
    for (const key of Object.keys(input) as Array<keyof CoverageDetailInput>) {
      if (input[key] === undefined) continue;
      const column = COLUMN[key];
      if (key === 'esrdEntitlementDate' || key === 'subscriberBirthdate') {
        data[column] = toDbDate(toIsoDate(input[key] as string | null));
      } else {
        data[column] = input[key];
      }
    }

    const saved = await prisma.cob_coverage_detail.upsert({
      where: { patplan_num: patPlanNum },
      create: { patplan_num: patPlanNum, ...data, updated_by: userNum },
      update: { ...data, updated_by: userNum },
    });

    const changes = Object.keys(data)
      .filter((column) => (before as any)?.[column]?.toString() !== (saved as any)[column]?.toString())
      .map((column) => `${column}: ${(before as any)?.[column] ?? 'null'} -> ${(saved as any)[column] ?? 'null'}`);

    await writeAudit({
      userNum,
      permType: PermType.COB_COVERAGE_DETAIL_CHANGED,
      patNum: patPlan.PatNum,
      text:
        `COB coverage detail changed on coverage ${coverageId}` +
        (changes.length ? `: ${changes.join(', ')}` : ' (no effective change)'),
      req: options.req,
    });

    const order = changes.length
      ? await cobService.evaluateAndSave(patPlan.PatNum.toString(), {
          triggerReason: 'COVERAGE_DETAIL_CHANGED',
          userNum,
          req: options.req,
        })
      : await cobService.getCurrentOrder(patPlan.PatNum.toString());

    return { detail: this.shape(coverageId, saved), order };
  }

  private validate(input: CoverageDetailInput): void {
    const check = (value: unknown, allowed: readonly string[], field: string) => {
      if (value === undefined || value === null) return;
      if (typeof value !== 'string' || !allowed.includes(value)) {
        throw new BadRequestError(`${field} must be one of: ${allowed.join(', ')}`);
      }
    };
    check(input.coverageBasis, COB_ENUMS.coverageBasis, 'coverageBasis');
    check(input.subscriberEmploymentStatus, COB_ENUMS.employmentStatus, 'subscriberEmploymentStatus');
    check(input.employerSizeBand, COB_ENUMS.employerSizeBand, 'employerSizeBand');
    check(
      input.medicareEntitlementReason,
      COB_ENUMS.medicareEntitlementReason,
      'medicareEntitlementReason'
    );
    check(input.custodyArrangement, COB_ENUMS.custodyArrangement, 'custodyArrangement');
    check(input.custodyRole, COB_ENUMS.custodyRole, 'custodyRole');

    for (const field of ['esrdEntitlementDate', 'subscriberBirthdate'] as const) {
      const value = input[field];
      if (value && !toIsoDate(value)) {
        throw new BadRequestError(`${field} must be a date in YYYY-MM-DD form`);
      }
    }

    // ESRD is the one entitlement reason that needs a second field, because
    // the 30-month coordination period is measured from it.
    if (input.medicareEntitlementReason === 'ESRD' && input.esrdEntitlementDate === null) {
      throw new BadRequestError(
        'esrdEntitlementDate is required when medicareEntitlementReason is ESRD — the ' +
          '30-month coordination period is measured from it.'
      );
    }
  }

  private shape(coverageId: string, detail: any) {
    if (!detail) {
      return {
        coverageId,
        recorded: false,
        coverageBasis: null,
        subscriberEmploymentStatus: null,
        employerSizeBand: null,
        medicareEntitlementReason: null,
        esrdEntitlementDate: null,
        subscriberName: null,
        subscriberBirthdate: null,
        custodyArrangement: null,
        custodyRole: null,
        courtOrderExists: false,
        courtOrderNamesThisCoverage: false,
        isTricareSupplement: false,
        updatedBy: null,
        updatedAt: null,
      };
    }
    return {
      coverageId,
      recorded: true,
      coverageBasis: detail.coverage_basis,
      subscriberEmploymentStatus: detail.subscriber_employment_status,
      employerSizeBand: detail.employer_size_band,
      medicareEntitlementReason: detail.medicare_entitlement_reason,
      esrdEntitlementDate: toIsoDate(detail.esrd_entitlement_date),
      subscriberName: detail.subscriber_name,
      subscriberBirthdate: toIsoDate(detail.subscriber_birthdate),
      custodyArrangement: detail.custody_arrangement,
      custodyRole: detail.custody_role,
      courtOrderExists: detail.court_order_exists,
      courtOrderNamesThisCoverage: detail.court_order_names_this_coverage,
      isTricareSupplement: detail.is_tricare_supplement,
      updatedBy: detail.updated_by?.toString() ?? null,
      updatedAt: detail.updated_at,
    };
  }
}

export const coverageDetailService = new CoverageDetailService();

/**
 * Payer type on a carrier. Small enough not to need its own service file, and
 * it belongs next to the other master-data write: the Medicare, Medicaid and
 * TRICARE rules are unreachable until somebody sets this.
 */
export const setPayerType = async (
  carrierId: string,
  payerType: string,
  userNum: bigint,
  req?: Request
) => {
  if (!(COB_ENUMS.payerType as readonly string[]).includes(payerType)) {
    throw new BadRequestError(`payerType must be one of: ${COB_ENUMS.payerType.join(', ')}`);
  }
  const carrierNum = BigInt(carrierId);
  const carrier = await prisma.carrier.findUnique({ where: { CarrierNum: carrierNum } });
  if (!carrier) throw new NotFoundError('Insurance carrier not found');

  const before = await prisma.cob_payer_profile.findUnique({ where: { carrier_num: carrierNum } });
  const saved = await prisma.cob_payer_profile.upsert({
    where: { carrier_num: carrierNum },
    create: { carrier_num: carrierNum, payer_type: payerType, updated_by: userNum },
    update: { payer_type: payerType, updated_by: userNum },
  });

  await writeAudit({
    userNum,
    permType: PermType.COB_PLAN_FIELD_CHANGED,
    text:
      `Payer type for carrier ${carrierNum} (${carrier.CarrierName ?? 'unnamed'}) set to ` +
      `${payerType}${before ? ` (was ${before.payer_type})` : ''}`,
    req,
  });

  return {
    carrierId,
    carrierName: carrier.CarrierName,
    payerType: saved.payer_type,
    updatedAt: saved.updated_at,
  };
};
