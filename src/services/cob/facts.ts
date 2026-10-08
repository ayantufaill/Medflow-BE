/**
 * Loading CoverageFacts out of the Open Dental tables.
 *
 * This is the only place that knows COB facts are spread across four tables
 * (patplan, inssub, insplan, carrier) plus two COB extension tables. Keeping
 * the translation here is what lets the rule engine stay pure, and what makes
 * the gaps visible: every `?? null` below is a fact we do not have, and the
 * rules are written to say NEEDS_INFO rather than paper over it.
 */

import { prisma } from '../../config/db';
import { toIsoDate } from './date.util';
import type {
  BenefitCategory,
  CobInfoSource,
  CobPaymentMethod,
  CoverageBasis,
  CoverageFacts,
  CustodyArrangement,
  CustodyRole,
  EmployerSizeBand,
  EmploymentStatus,
  MedicareEntitlementReason,
  PayerType,
  SubscriberRelationship,
} from './types';

/**
 * patplan.Relationship, Open Dental's encoding, read as "who the subscriber
 * is to the patient".
 *
 *   0 self    — the patient subscribes
 *   1 spouse  — the patient is the subscriber's spouse, so the subscriber is
 *               the patient's spouse
 *   2 child   — the patient is the subscriber's child, so the subscriber is
 *               the patient's PARENT. This is the dependent-child case the
 *               birthday and custody rules turn on.
 *   3 parent  — the patient is the subscriber's parent
 *
 * mapRelationshipToDb in opendental-mappers.util.ts writes these, and 2 is
 * what the front desk records for a child on a parent's policy.
 */
const relationshipFromDb = (value: number | null | undefined): SubscriberRelationship => {
  switch (value) {
    case 0:
      return 'SELF';
    case 1:
      return 'SPOUSE';
    case 2:
      return 'PARENT';
    default:
      return 'OTHER';
  }
};

const asEnum = <T extends string>(value: string | null | undefined, allowed: readonly T[]): T | null =>
  value && (allowed as readonly string[]).includes(value) ? (value as T) : null;

const PAYER_TYPES: readonly PayerType[] = [
  'COMMERCIAL',
  'MEDICARE',
  'MEDICAID',
  'TRICARE',
  'WORKERS_COMP',
  'AUTO_LIABILITY',
];
const BENEFIT_CATEGORIES: readonly BenefitCategory[] = [
  'MEDICAL',
  'FIXED_INDEMNITY',
  'DENTAL',
  'VISION',
  'OTHER',
];
const COB_METHODS: readonly CobPaymentMethod[] = [
  'STANDARD',
  'NON_DUPLICATION',
  'CARVE_OUT',
  'REMAINING_BALANCE',
  'UNKNOWN',
];
const INFO_SOURCES: readonly CobInfoSource[] = ['DEFAULT', 'PAYER_CONFIRMED', 'PLAN_DOCUMENT'];
const COVERAGE_BASES: readonly CoverageBasis[] = [
  'EMPLOYER_GROUP',
  'INDIVIDUAL',
  'MEDICARE',
  'MEDICAID',
  'TRICARE',
  'COBRA',
  'RETIREE',
  'WORKERS_COMP',
  'AUTO_LIABILITY',
];
const EMPLOYMENT_STATUSES: readonly EmploymentStatus[] = ['ACTIVE', 'RETIRED', 'LAID_OFF', 'COBRA'];
const SIZE_BANDS: readonly EmployerSizeBand[] = ['UNDER_20', '20_TO_99', '100_PLUS'];
const ENTITLEMENT_REASONS: readonly MedicareEntitlementReason[] = ['AGE', 'DISABILITY', 'ESRD'];
const CUSTODY_ARRANGEMENTS: readonly CustodyArrangement[] = [
  'TOGETHER',
  'SEPARATED',
  'DIVORCED',
  'JOINT_CUSTODY',
];
const CUSTODY_ROLES: readonly CustodyRole[] = [
  'CUSTODIAL',
  'CUSTODIAL_SPOUSE',
  'NON_CUSTODIAL',
  'NON_CUSTODIAL_SPOUSE',
];

/**
 * What a plan's COB profile is when nobody has recorded one.
 *
 * SINGLE SOURCE. These values previously appeared in three places — the
 * `cob_plan_profile` column defaults in schema.prisma, the `??` fallbacks in
 * `loadCoverageFacts` below, and a `DEFAULTS` object in
 * plan-master.service.ts. Three copies of "does this plan coordinate?" is
 * three chances for the rule engine and the plan screen to disagree about a
 * plan nobody has filled in, which is most of them.
 *
 * They must stay equal to the column defaults in schema.prisma; the
 * assertion in tests/cob-defaults.test.ts pins that.
 */
export const COB_PLAN_PROFILE_DEFAULTS = {
  benefitCategory: 'MEDICAL' as BenefitCategory,
  /**
   * TRUE because the overwhelming majority of group plans coordinate. The
   * NO_COB_PROVISION rule therefore only fires on a plan a human has
   * positively recorded as NOT coordinating — never on an unfilled one.
   */
  coordinatesBenefits: true,
  /**
   * UNKNOWN, not STANDARD. Guessing the method produces a confidently wrong
   * secondary estimate; UNKNOWN makes the estimator return a range instead.
   */
  cobPaymentMethod: 'UNKNOWN' as CobPaymentMethod,
  cobInfoSource: 'DEFAULT' as CobInfoSource,
} as const;

/** A carrier with no recorded payer type is treated as commercial. */
export const COB_PAYER_TYPE_DEFAULT: PayerType = 'COMMERCIAL';

export const COB_ENUMS = {
  payerType: PAYER_TYPES,
  benefitCategory: BENEFIT_CATEGORIES,
  cobPaymentMethod: COB_METHODS,
  cobInfoSource: INFO_SOURCES,
  coverageBasis: COVERAGE_BASES,
  employmentStatus: EMPLOYMENT_STATUSES,
  employerSizeBand: SIZE_BANDS,
  medicareEntitlementReason: ENTITLEMENT_REASONS,
  custodyArrangement: CUSTODY_ARRANGEMENTS,
  custodyRole: CUSTODY_ROLES,
} as const;

/**
 * Loads every coverage on a patient as rule-engine facts.
 *
 * Pending coverages (patplan.IsPending) are included: a policy still being
 * verified is a policy the patient holds, and leaving it out would produce an
 * order that silently changes the moment verification completes.
 */
export const loadCoverageFacts = async (patNum: bigint): Promise<CoverageFacts[]> => {
  const patPlans = await prisma.patplan.findMany({
    where: { PatNum: patNum },
    orderBy: { Ordinal: 'asc' },
    include: {
      inssub: {
        include: {
          insplan: { include: { carrier: true } },
          patient: true,
        },
      },
    },
  });

  if (patPlans.length === 0) return [];

  const patPlanNums = patPlans.map((p) => p.PatPlanNum);
  const planNums = patPlans
    .map((p) => p.inssub?.insplan?.PlanNum)
    .filter((v): v is bigint => v != null);
  const carrierNums = patPlans
    .map((p) => p.inssub?.insplan?.CarrierNum)
    .filter((v): v is bigint => v != null);

  const [details, planProfiles, payerProfiles] = await Promise.all([
    prisma.cob_coverage_detail.findMany({ where: { patplan_num: { in: patPlanNums } } }),
    planNums.length
      ? prisma.cob_plan_profile.findMany({ where: { plan_num: { in: planNums } } })
      : Promise.resolve([]),
    carrierNums.length
      ? prisma.cob_payer_profile.findMany({ where: { carrier_num: { in: carrierNums } } })
      : Promise.resolve([]),
  ]);

  const detailBy = new Map(details.map((d) => [d.patplan_num.toString(), d]));
  const planBy = new Map(planProfiles.map((p) => [p.plan_num.toString(), p]));
  const payerBy = new Map(payerProfiles.map((p) => [p.carrier_num.toString(), p]));

  return patPlans.map((patPlan) => {
    const sub = patPlan.inssub;
    const plan = sub?.insplan;
    const carrier = plan?.carrier;
    const detail = detailBy.get(patPlan.PatPlanNum.toString());
    const planProfile = plan ? planBy.get(plan.PlanNum.toString()) : undefined;
    const payerProfile = carrier ? payerBy.get(carrier.CarrierNum.toString()) : undefined;

    const relationship = relationshipFromDb(patPlan.Relationship);

    // Subscriber DOB: prefer the patient record the subscriber points at,
    // since that is maintained; fall back to the COB detail override, which
    // exists for a subscriber who is not a patient here (a child's other
    // parent, the usual birthday-rule case). Null if we have neither — the
    // rule will ask rather than guess.
    const subscriberBirthdate =
      toIsoDate(sub?.patient?.Birthdate) ?? toIsoDate(detail?.subscriber_birthdate) ?? null;

    const subscriberName =
      [sub?.patient?.FName, sub?.patient?.LName].filter(Boolean).join(' ').trim() ||
      detail?.subscriber_name ||
      null;

    // Identifies "the same person" for the active-vs-retiree/COBRA rules.
    // The subscriber's patient number when we have it, else their name — a
    // name is weak, but these two rules only fire when the statuses differ,
    // so a false match still has to clear that gate.
    const subscriberKey = sub?.Subscriber
      ? `pat:${sub.Subscriber.toString()}`
      : subscriberName
        ? `name:${subscriberName.toLowerCase()}`
        : null;

    return {
      id: patPlan.PatPlanNum.toString(),
      planId: plan?.PlanNum.toString() ?? '',
      carrierId: carrier?.CarrierNum.toString() ?? null,
      carrierName: carrier?.CarrierName ?? null,

      payerType: asEnum(payerProfile?.payer_type, PAYER_TYPES) ?? COB_PAYER_TYPE_DEFAULT,
      benefitCategory:
        asEnum(planProfile?.benefit_category, BENEFIT_CATEGORIES) ??
        COB_PLAN_PROFILE_DEFAULTS.benefitCategory,
      // An absent profile means nobody has recorded this plan's COB provision.
      coordinatesBenefits: planProfile
        ? planProfile.coordinates_benefits
        : COB_PLAN_PROFILE_DEFAULTS.coordinatesBenefits,
      cobPaymentMethod:
        asEnum(planProfile?.cob_payment_method, COB_METHODS) ??
        COB_PLAN_PROFILE_DEFAULTS.cobPaymentMethod,
      cobInfoSource:
        asEnum(planProfile?.cob_info_source, INFO_SOURCES) ??
        COB_PLAN_PROFILE_DEFAULTS.cobInfoSource,

      relationship,
      subscriberName,
      subscriberBirthdate,
      subscriberKey,

      coverageBasis: asEnum(detail?.coverage_basis, COVERAGE_BASES),
      employmentStatus: asEnum(detail?.subscriber_employment_status, EMPLOYMENT_STATUSES),
      employerSizeBand: asEnum(detail?.employer_size_band, SIZE_BANDS),
      medicareEntitlementReason: asEnum(detail?.medicare_entitlement_reason, ENTITLEMENT_REASONS),
      esrdEntitlementDate: toIsoDate(detail?.esrd_entitlement_date),

      custodyArrangement: asEnum(detail?.custody_arrangement, CUSTODY_ARRANGEMENTS),
      custodyRole: asEnum(detail?.custody_role, CUSTODY_ROLES),
      courtOrderExists: detail?.court_order_exists ?? false,
      courtOrderNamesThisCoverage: detail?.court_order_names_this_coverage ?? false,
      isTricareSupplement: detail?.is_tricare_supplement ?? false,

      effectiveDate: toIsoDate(sub?.DateEffective),
      terminationDate: toIsoDate(sub?.DateTerm),
    };
  });
};
