/**
 * Coordination of Benefits — domain types.
 *
 * Everything in this file is plain data. The rule engine and the ranking
 * pipeline are pure functions over `CoverageFacts`, with no Prisma import
 * anywhere, which is what makes the 40-odd rule tests run without a database
 * and makes a disputed order reproducible from its stored facts.
 *
 * The one principle these types exist to protect: OUR SYSTEM SUGGESTS, THE
 * INSURER DECIDES. Nothing here can express "the payer is wrong" — only
 * "we and the payer disagree", which is a flag for a human.
 */

export type PayerType =
  | 'COMMERCIAL'
  | 'MEDICARE'
  | 'MEDICAID'
  | 'TRICARE'
  | 'WORKERS_COMP'
  | 'AUTO_LIABILITY';

export type BenefitCategory = 'MEDICAL' | 'FIXED_INDEMNITY' | 'DENTAL' | 'VISION' | 'OTHER';

export type CobPaymentMethod =
  | 'STANDARD'
  | 'NON_DUPLICATION'
  | 'CARVE_OUT'
  | 'REMAINING_BALANCE'
  | 'UNKNOWN';

export type CobInfoSource = 'DEFAULT' | 'PAYER_CONFIRMED' | 'PLAN_DOCUMENT';

export type SubscriberRelationship = 'SELF' | 'SPOUSE' | 'PARENT' | 'OTHER';

export type CoverageBasis =
  | 'EMPLOYER_GROUP'
  | 'INDIVIDUAL'
  | 'MEDICARE'
  | 'MEDICAID'
  | 'TRICARE'
  | 'COBRA'
  | 'RETIREE'
  | 'WORKERS_COMP'
  | 'AUTO_LIABILITY';

export type EmploymentStatus = 'ACTIVE' | 'RETIRED' | 'LAID_OFF' | 'COBRA';

export type EmployerSizeBand = 'UNDER_20' | '20_TO_99' | '100_PLUS';

export type MedicareEntitlementReason = 'AGE' | 'DISABILITY' | 'ESRD';

export type CustodyArrangement = 'TOGETHER' | 'SEPARATED' | 'DIVORCED' | 'JOINT_CUSTODY';

export type CustodyRole =
  | 'CUSTODIAL'
  | 'CUSTODIAL_SPOUSE'
  | 'NON_CUSTODIAL'
  | 'NON_CUSTODIAL_SPOUSE';

/**
 * THE VOCABULARIES BELOW ARE RUNTIME ARRAYS, AND THE TYPES ARE DERIVED FROM
 * THEM — never the other way round.
 *
 * A hand-written union plus a separate array for the API and the validators is
 * three copies of the same list, and the compiler checks none of them against
 * each other. Deriving the type with `[number]` means adding a flag in one
 * place adds it to the type, to the validator and to the `GET /cob/enums`
 * payload at once, so the UI's dropdown can never offer a value the server
 * rejects (or miss one the server can return).
 */

export const ORDER_STATUSES = [
  'SUGGESTED',
  'NEEDS_INFO',
  'NEEDS_REVIEW',
  'CONFIRMED',
  'STAFF_OVERRIDE',
  'DISPUTED',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const REVIEW_FLAGS = [
  'NEITHER_PLAN_COORDINATES',
  'RANKING_CYCLE',
  'PAYER_MISMATCH',
  'COB_DENIAL',
  'COVERAGE_CHANGED',
] as const;
export type ReviewFlag = (typeof REVIEW_FLAGS)[number];

export const VERIFICATION_STATUSES = ['UNVERIFIED', 'VERIFIED_WITH_PAYER'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const ELIGIBILITY_SOURCES = ['ELIGIBILITY_271', 'PHONE', 'PORTAL'] as const;
export type EligibilitySource = (typeof ELIGIBILITY_SOURCES)[number];

export const RESPONSIBLE_PARTIES = ['PRIMARY', 'SECONDARY', 'TERTIARY', 'PATIENT'] as const;
export type ResponsibleParty = (typeof RESPONSIBLE_PARTIES)[number];

/**
 * Which flags stop a claim going out the door while unresolved.
 *
 * Served to the UI so it can explain a disabled submit button without
 * reimplementing the gate, and read by cob.service's own check so the
 * explanation and the enforcement are the same list.
 */
export const BLOCKING_REVIEW_FLAGS = [
  'RANKING_CYCLE',
  'PAYER_MISMATCH',
  'COB_DENIAL',
] as const satisfies readonly ReviewFlag[];

/** Order statuses that block submission on their own. */
export const BLOCKING_ORDER_STATUSES = [
  'NEEDS_INFO',
  'NEEDS_REVIEW',
  'DISPUTED',
] as const satisfies readonly OrderStatus[];

/**
 * Everything a rule is allowed to know about one coverage.
 *
 * `id` is the patplan number as a string. Dates are ISO `YYYY-MM-DD` strings
 * rather than Date objects on purpose: the birthday rule compares month/day
 * and must not be shifted by a timezone, and a stored order has to replay
 * identically on a server in another zone.
 */
export interface CoverageFacts {
  id: string;
  planId: string;
  carrierId: string | null;
  carrierName: string | null;

  payerType: PayerType;
  benefitCategory: BenefitCategory;
  coordinatesBenefits: boolean;
  cobPaymentMethod: CobPaymentMethod;
  cobInfoSource: CobInfoSource;

  /**
   * Who the SUBSCRIBER is to the patient. SELF = the patient's own policy,
   * PARENT = the patient is a dependent child on a parent's policy. Read in
   * this direction because every rule asks "is the patient the subscriber
   * here, or a dependent?", never the reverse.
   */
  relationship: SubscriberRelationship;
  subscriberName: string | null;
  /** ISO YYYY-MM-DD, or null when we do not have it. Never defaulted. */
  subscriberBirthdate: string | null;
  /** Identifies "the same person" for the active-vs-retiree/COBRA rules. */
  subscriberKey: string | null;

  coverageBasis: CoverageBasis | null;
  employmentStatus: EmploymentStatus | null;
  employerSizeBand: EmployerSizeBand | null;
  medicareEntitlementReason: MedicareEntitlementReason | null;
  esrdEntitlementDate: string | null;

  custodyArrangement: CustodyArrangement | null;
  custodyRole: CustodyRole | null;
  courtOrderExists: boolean;
  courtOrderNamesThisCoverage: boolean;
  isTricareSupplement: boolean;

  effectiveDate: string | null;
  terminationDate: string | null;
}

/**
 * Claim-side context. Injury relatedness is a property of the CLAIM, never of
 * the coverage: the same workers' comp policy is primary for the back injury
 * and irrelevant for the flu shot.
 */
export interface ClaimContext {
  /** ISO YYYY-MM-DD. The date of service every rule reasons about. */
  dateOfService: string;
  /** True only when staff flagged this claim as related to the injury. */
  injuryRelated?: boolean;
  /** WORKERS_COMP | AUTO_LIABILITY — which injury, when known. */
  injuryType?: 'WORKERS_COMP' | 'AUTO_LIABILITY' | null;
  claimId?: string | null;
}

export type PairDecision = 'A_FIRST' | 'B_FIRST' | 'UNDECIDED' | 'NEEDS_INFO';

export interface RuleResult {
  decision: PairDecision;
  /** Plain English, aimed at a biller on the phone with a payer. */
  explanation?: string;
  /** Dotted field paths a human must fill in. NEEDS_INFO only. */
  missingFields?: string[];
  flags?: ReviewFlag[];
}

export interface CobRule {
  code: string;
  description: string;
  evaluate(a: CoverageFacts, b: CoverageFacts, ctx: ClaimContext): RuleResult;
}

export interface OrderedPosition {
  position: number;
  coverageId: string;
  ruleCode: string;
  explanation: string;
}

export interface ExcludedCoverage {
  coverageId: string;
  ruleCode: string;
  explanation: string;
}

export interface MissingField {
  coverageId: string;
  field: string;
}

export interface DetermineOrderResult {
  status: OrderStatus;
  positions: OrderedPosition[];
  excluded: ExcludedCoverage[];
  flags: ReviewFlag[];
  missingFields: MissingField[];
  /** Every pairwise outcome, for "why is this one second?" in the UI. */
  pairwise: Array<{
    aId: string;
    bId: string;
    ruleCode: string;
    decision: PairDecision;
    explanation: string;
  }>;
}

/** UNDECIDED exhausted every rule; the order fell back to a stable tie-break. */
export const TIE_BREAK_RULE_CODE = 'TIE_BREAK_STABLE';
