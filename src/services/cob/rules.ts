/**
 * Coordination of Benefits — the pairwise rule engine.
 *
 * HOW THIS WORKS
 * --------------
 * COB is not expressible as a sort key. "Whose plan pays first" is a sequence
 * of pairwise tests applied in a fixed statutory order, and the FIRST rule
 * that can decide a pair wins for that pair. So each rule here answers one
 * question about two coverages and nothing else:
 *
 *   A_FIRST / B_FIRST  this rule decides; stop.
 *   UNDECIDED          this rule does not apply, or applies and still cannot
 *                      separate them; try the next rule.
 *   NEEDS_INFO         this rule DOES apply but a fact is missing. Stop and
 *                      ask a human. Never fall through, because falling
 *                      through would answer a question we were told to ask.
 *
 * The NEEDS_INFO / UNDECIDED distinction is the whole safety property. A rule
 * that returns UNDECIDED when it meant NEEDS_INFO is how a system silently
 * bills the wrong payer first.
 *
 * ORDER MATTERS AND IS NOT ALPHABETICAL. `COB_RULES` is the statutory
 * sequence from the NAIC model regulation plus the CMS Medicare Secondary
 * Payer rules. Reordering it changes who gets billed.
 */

import type { ClaimContext, CobRule, CoverageFacts, RuleResult } from './types';
import { compareIsoDate, compareMonthDay, monthsBetween, parseYmd } from './date.util';

/**
 * STATUTORY THRESHOLDS — federal law, not practice configuration.
 *
 * Named rather than inlined so they are greppable and so the two employer-size
 * thresholds can never be confused with each other (they differ by a factor of
 * five and sit in near-identical rules).
 *
 * Deliberately NOT database-configurable. These are the numbers in the CMS
 * Medicare Secondary Payer rules, identical for every practice and every
 * payer; a per-tenant override would let a clinic configure itself into
 * billing Medicare first when the law says otherwise. They change only when
 * Congress changes them, which is a code change.
 *
 *   WORKING_AGED  42 CFR 411.172 — an employer with 20+ employees sponsoring a
 *                 Group Health Plan pays before age-entitled Medicare.
 *   DISABILITY    42 CFR 411.206 — the Large Group Health Plan threshold is
 *                 100+ employees for disability-entitled beneficiaries.
 *   ESRD          42 CFR 411.162 — the group plan pays first for a 30-month
 *                 coordination period beginning at ESRD entitlement.
 */
export const MSP_THRESHOLDS = {
  /** Employer size bands at or above which the GROUP plan pays first. */
  workingAgedGroupPrimaryBands: ['20_TO_99', '100_PLUS'] as const,
  disabilityGroupPrimaryBands: ['100_PLUS'] as const,
  /** Months of ESRD coordination during which the group plan pays first. */
  esrdCoordinationMonths: 30,
} as const;

const undecided = (): RuleResult => ({ decision: 'UNDECIDED' });

const needsInfo = (fields: string[], explanation: string): RuleResult => ({
  decision: 'NEEDS_INFO',
  missingFields: fields,
  explanation,
});

const label = (c: CoverageFacts): string =>
  c.carrierName ? c.carrierName : `coverage ${c.id}`;

const isInjuryPayer = (c: CoverageFacts): boolean =>
  c.payerType === 'WORKERS_COMP' ||
  c.payerType === 'AUTO_LIABILITY' ||
  c.coverageBasis === 'WORKERS_COMP' ||
  c.coverageBasis === 'AUTO_LIABILITY';

const isMedicare = (c: CoverageFacts): boolean =>
  c.payerType === 'MEDICARE' || c.coverageBasis === 'MEDICARE';

const isMedicaid = (c: CoverageFacts): boolean =>
  c.payerType === 'MEDICAID' || c.coverageBasis === 'MEDICAID';

const isTricare = (c: CoverageFacts): boolean =>
  c.payerType === 'TRICARE' || c.coverageBasis === 'TRICARE';

/**
 * "Active employer group coverage, through the beneficiary's own or their
 * spouse's current employment" — the CMS phrase the working-aged and
 * disability rules both turn on. Retiree and COBRA coverage is NOT current
 * employment, which is why those get their own rules below.
 */
const isActiveEmployerGroup = (c: CoverageFacts): boolean =>
  c.coverageBasis === 'EMPLOYER_GROUP' &&
  c.employmentStatus === 'ACTIVE' &&
  (c.relationship === 'SELF' || c.relationship === 'SPOUSE');

const isRetireeCoverage = (c: CoverageFacts): boolean =>
  c.coverageBasis === 'RETIREE' || c.employmentStatus === 'RETIRED';

const isCobraCoverage = (c: CoverageFacts): boolean =>
  c.coverageBasis === 'COBRA' || c.employmentStatus === 'COBRA';

/** The patient is a dependent child on this policy. */
const isDependentChild = (c: CoverageFacts): boolean => c.relationship === 'PARENT';

/** Same human subscribes to both — required by the retiree/COBRA rules. */
const sameSubscriber = (a: CoverageFacts, b: CoverageFacts): boolean =>
  !!a.subscriberKey && !!b.subscriberKey && a.subscriberKey === b.subscriberKey;

/** Picks the winner from a boolean "is A the one that goes first". */
const decide = (aFirst: boolean, explanation: string): RuleResult => ({
  decision: aFirst ? 'A_FIRST' : 'B_FIRST',
  explanation,
});

// ── 1. Injury-related liability ────────────────────────────────────────────

/**
 * Workers' comp, auto and other liability coverage pays first for the injury
 * it covers — and is irrelevant to everything else. The gate is the CLAIM's
 * injury flag, not the coverage: the same comp policy is primary for the back
 * strain and takes no part in the flu shot.
 */
export const INJURY_RELATED: CobRule = {
  code: 'INJURY_RELATED',
  description: "Workers' comp / auto / liability pays first for the related injury",
  evaluate(a, b, ctx) {
    if (!ctx.injuryRelated) return undecided();

    const matches = (c: CoverageFacts): boolean => {
      if (!isInjuryPayer(c)) return false;
      if (!ctx.injuryType) return true;
      return c.payerType === ctx.injuryType || c.coverageBasis === ctx.injuryType;
    };

    const aMatch = matches(a);
    const bMatch = matches(b);
    if (aMatch === bMatch) return undecided();

    const winner = aMatch ? a : b;
    return decide(
      aMatch,
      `${label(winner)} is injury-related liability coverage and this claim is flagged ` +
        `as related to that injury, so it pays before health coverage.`
    );
  },
};

// ── 2. Medicare Secondary Payer rules ─────────────────────────────────────

/**
 * Working aged: age-entitled Medicare against active employment coverage.
 * The employer's size is the whole rule — 20+ employees and the group plan
 * pays first; under 20 and Medicare does. Without the size band we cannot
 * tell which, and guessing picks the wrong payer half the time.
 */
export const MEDICARE_WORKING_AGED: CobRule = {
  code: 'MEDICARE_WORKING_AGED',
  description: 'Age-entitled Medicare vs active employer group coverage, by employer size',
  evaluate(a, b) {
    const medicare = isMedicare(a) ? a : isMedicare(b) ? b : null;
    if (!medicare) return undecided();
    const group = medicare === a ? b : a;
    if (isMedicare(group) || !isActiveEmployerGroup(group)) return undecided();

    if (!medicare.medicareEntitlementReason) {
      return needsInfo(
        [`${medicare.id}.medicareEntitlementReason`],
        `${label(medicare)} is Medicare, but why the patient is entitled (age, ` +
          `disability or ESRD) is not recorded, and each of the three coordinates ` +
          `differently.`
      );
    }
    if (medicare.medicareEntitlementReason !== 'AGE') return undecided();

    if (!group.employerSizeBand) {
      return needsInfo(
        [`${group.id}.employerSizeBand`],
        `Medicare coordinates with ${label(group)} based on the employer's size, ` +
          `and the employer size band is not recorded.`
      );
    }

    const groupIsPrimary = (
      MSP_THRESHOLDS.workingAgedGroupPrimaryBands as readonly string[]
    ).includes(group.employerSizeBand);
    const winner = groupIsPrimary ? group : medicare;
    const loser = groupIsPrimary ? medicare : group;
    return decide(
      winner === a,
      groupIsPrimary
        ? `The patient is entitled to Medicare by age and has active employment ` +
            `coverage through an employer with 20 or more employees, so ` +
            `${label(group)} pays before ${label(loser)}.`
        : `The patient is entitled to Medicare by age and the employer has fewer ` +
            `than 20 employees, so ${label(medicare)} pays before ${label(loser)}.`
    );
  },
};

/**
 * Disability: same shape as working aged, different threshold. A Large Group
 * Health Plan is 100+ employees; below that Medicare pays first.
 */
export const MEDICARE_DISABILITY: CobRule = {
  code: 'MEDICARE_DISABILITY',
  description: 'Disability-entitled Medicare vs active employer group coverage (100+ threshold)',
  evaluate(a, b) {
    const medicare = isMedicare(a) ? a : isMedicare(b) ? b : null;
    if (!medicare) return undecided();
    const group = medicare === a ? b : a;
    if (isMedicare(group) || !isActiveEmployerGroup(group)) return undecided();
    if (medicare.medicareEntitlementReason !== 'DISABILITY') return undecided();

    if (!group.employerSizeBand) {
      return needsInfo(
        [`${group.id}.employerSizeBand`],
        `Disability-based Medicare coordinates with ${label(group)} on whether the ` +
          `employer has 100 or more employees, which is not recorded.`
      );
    }

    const groupIsPrimary = (
      MSP_THRESHOLDS.disabilityGroupPrimaryBands as readonly string[]
    ).includes(group.employerSizeBand);
    const winner = groupIsPrimary ? group : medicare;
    return decide(
      winner === a,
      groupIsPrimary
        ? `The patient is entitled to Medicare by disability and has active ` +
            `employment coverage through an employer with 100 or more employees, so ` +
            `${label(group)} pays first.`
        : `The patient is entitled to Medicare by disability and the employer has ` +
            `fewer than 100 employees, so ${label(medicare)} pays first.`
    );
  },
};

/**
 * ESRD: the group plan pays first for the 30-month coordination period that
 * begins at ESRD entitlement, and Medicare pays first from month 31 onward.
 * Unlike the other two Medicare rules this one depends on the DATE OF
 * SERVICE, so the same two coverages legitimately rank differently on two
 * claims — which is exactly why orders are stored per effective date range.
 */
export const MEDICARE_ESRD: CobRule = {
  code: 'MEDICARE_ESRD',
  description: 'ESRD: group plan primary for the 30-month coordination period, then Medicare',
  evaluate(a, b, ctx) {
    const medicare = isMedicare(a) ? a : isMedicare(b) ? b : null;
    if (!medicare) return undecided();
    const group = medicare === a ? b : a;
    if (isMedicare(group)) return undecided();
    if (medicare.medicareEntitlementReason !== 'ESRD') return undecided();
    // Any group health plan coordinates during the ESRD period, including
    // retiree and COBRA coverage — not only active employment coverage.
    if (group.coverageBasis === 'MEDICAID' || isMedicaid(group)) return undecided();

    if (!medicare.esrdEntitlementDate) {
      return needsInfo(
        [`${medicare.id}.esrdEntitlementDate`],
        `ESRD coordination runs for ${MSP_THRESHOLDS.esrdCoordinationMonths} months ` +
          `from the ESRD entitlement date, ` +
          `which is not recorded, so we cannot tell which side of that window ` +
          `this date of service falls on.`
      );
    }

    const start = parseYmd(medicare.esrdEntitlementDate);
    const dos = parseYmd(ctx.dateOfService);
    if (!start || !dos) {
      return needsInfo(
        [`${medicare.id}.esrdEntitlementDate`],
        `The ESRD entitlement date could not be read as a date.`
      );
    }

    const monthsElapsed = monthsBetween(start, dos);
    const inCoordinationPeriod = monthsElapsed < MSP_THRESHOLDS.esrdCoordinationMonths;
    const winner = inCoordinationPeriod ? group : medicare;
    const monthNumber = monthsElapsed + 1;
    return decide(
      winner === a,
      inCoordinationPeriod
        ? `This date of service is month ${monthNumber} of the ` +
            `${MSP_THRESHOLDS.esrdCoordinationMonths}-month ESRD coordination period, ` +
            `so the group plan ${label(group)} pays before ${label(medicare)}.`
        : `This date of service is month ${monthNumber}, past the ` +
            `${MSP_THRESHOLDS.esrdCoordinationMonths}-month ESRD coordination period, ` +
            `so ${label(medicare)} pays before ${label(group)}.`
    );
  },
};

/**
 * Retiree coverage is not current employment, so Medicare pays first. This
 * catches the large population the working-aged rule deliberately misses.
 */
export const MEDICARE_RETIREE: CobRule = {
  code: 'MEDICARE_RETIREE',
  description: 'Medicare pays before retiree coverage',
  evaluate(a, b) {
    const medicare = isMedicare(a) ? a : isMedicare(b) ? b : null;
    if (!medicare) return undecided();
    const other = medicare === a ? b : a;
    if (isMedicare(other) || !isRetireeCoverage(other)) return undecided();

    return decide(
      medicare === a,
      `${label(other)} is retiree coverage rather than active employment ` +
        `coverage, so ${label(medicare)} pays first.`
    );
  },
};

// ── 3. Medicaid ───────────────────────────────────────────────────────────

/**
 * Medicaid is the payer of last resort by statute. It sits after everything,
 * which is why this rule runs before the plan-level rules below: no COB
 * provision, no birthday rule and no longer-coverage test can move Medicaid
 * off the bottom.
 */
export const MEDICAID_LAST: CobRule = {
  code: 'MEDICAID_LAST',
  description: 'Medicaid is always the payer of last resort',
  evaluate(a, b) {
    const aMedicaid = isMedicaid(a);
    const bMedicaid = isMedicaid(b);
    if (aMedicaid === bMedicaid) return undecided();

    const medicaid = aMedicaid ? a : b;
    const other = aMedicaid ? b : a;
    return decide(
      !aMedicaid,
      `${label(medicaid)} is Medicaid, the payer of last resort, so it pays after ` +
        `${label(other)}.`
    );
  },
};

// ── 4. TRICARE ────────────────────────────────────────────────────────────

/**
 * TRICARE is secondary to all other health coverage, with two exceptions it
 * is primary to: Medicaid, and TRICARE supplement plans.
 */
export const TRICARE_SECONDARY: CobRule = {
  code: 'TRICARE',
  description: 'TRICARE is secondary to all coverage except Medicaid and TRICARE supplements',
  evaluate(a, b) {
    const aTricare = isTricare(a) && !a.isTricareSupplement;
    const bTricare = isTricare(b) && !b.isTricareSupplement;
    if (aTricare === bTricare) return undecided();

    const tricare = aTricare ? a : b;
    const other = aTricare ? b : a;

    if (isMedicaid(other) || other.isTricareSupplement) {
      return decide(
        aTricare,
        `${label(tricare)} is TRICARE, which pays before ${label(other)} ` +
          `(${isMedicaid(other) ? 'Medicaid' : 'a TRICARE supplement'}).`
      );
    }

    return decide(
      !aTricare,
      `${label(tricare)} is TRICARE, which is secondary to other health coverage, ` +
        `so ${label(other)} pays first.`
    );
  },
};

// ── 5. The COB provision ──────────────────────────────────────────────────

/**
 * A plan with no COB provision does not coordinate, so it pays as if it were
 * the only coverage — which makes it primary over a plan that does
 * coordinate.
 *
 * When NEITHER plan coordinates there is no primary to find: both may pay in
 * full, and the combined payment can exceed the charge. That is a real
 * billing situation, not an error, so this returns UNDECIDED (let the later
 * rules produce a submission order) and raises NEITHER_PLAN_COORDINATES so a
 * human knows the usual COB arithmetic does not apply.
 */
export const NO_COB_PROVISION: CobRule = {
  code: 'NO_COB_PROVISION',
  description: 'A plan without a COB provision is primary over one with it',
  evaluate(a, b) {
    if (a.coordinatesBenefits && b.coordinatesBenefits) return undecided();

    if (!a.coordinatesBenefits && !b.coordinatesBenefits) {
      return {
        decision: 'UNDECIDED',
        flags: ['NEITHER_PLAN_COORDINATES'],
        explanation:
          `Neither ${label(a)} nor ${label(b)} has a coordination-of-benefits ` +
          `provision, so each may pay as though it were the only coverage. The ` +
          `order below is only a submission sequence — do not expect the usual ` +
          `primary/secondary arithmetic.`,
      };
    }

    const noCob = a.coordinatesBenefits ? b : a;
    const withCob = a.coordinatesBenefits ? a : b;
    return decide(
      !a.coordinatesBenefits,
      `${label(noCob)} has no coordination-of-benefits provision, so it pays as ` +
        `though it were the only coverage and comes before ${label(withCob)}.`
    );
  },
};

// ── 6. Subscriber before dependent ────────────────────────────────────────

/**
 * The plan covering the patient as the subscriber pays before a plan covering
 * them as a dependent. This is the rule behind the single most common
 * two-plan case at the front desk: the patient's own work plan pays before
 * their spouse's.
 */
export const SUBSCRIBER_BEFORE_DEPENDENT: CobRule = {
  code: 'SUBSCRIBER_BEFORE_DEPENDENT',
  description: "The patient's own policy pays before one they are a dependent on",
  evaluate(a, b) {
    const aSelf = a.relationship === 'SELF';
    const bSelf = b.relationship === 'SELF';
    if (aSelf === bSelf) return undecided();

    const own = aSelf ? a : b;
    const dependent = aSelf ? b : a;
    return decide(
      aSelf,
      `The patient is the subscriber on ${label(own)} and only a dependent on ` +
        `${label(dependent)}, so their own policy pays first.`
    );
  },
};

// ── 7. The birthday rule ──────────────────────────────────────────────────

/**
 * For a child covered by both parents who live together: the parent whose
 * birthday falls earlier in the calendar year is primary. The YEAR IS
 * IGNORED — this is not about which parent is older, a mistake that silently
 * reverses the order for most couples.
 *
 * Identical month and day is not a tie to break here; it falls through to
 * LONGER_COVERAGE, as the NAIC model provides.
 *
 * On the missing-DOB case this returns NEEDS_INFO rather than falling
 * through. Falling through to LONGER_COVERAGE would produce a confident
 * order from a rule that was never reached, and the biller would have no
 * idea the birthday rule had been skipped.
 */
export const BIRTHDAY_RULE: CobRule = {
  code: 'BIRTHDAY_RULE',
  description: 'Dependent child, parents together: earlier birthday month/day is primary',
  evaluate(a, b) {
    if (!isDependentChild(a) || !isDependentChild(b)) return undecided();

    // Separated or divorced parents are the CUSTODY rule's business. Joint
    // custody with no court order lands back here by design.
    const arrangements = [a.custodyArrangement, b.custodyArrangement];
    if (arrangements.some((v) => v === 'SEPARATED' || v === 'DIVORCED')) return undecided();
    if (arrangements.some((v) => v === 'JOINT_CUSTODY') && (a.courtOrderExists || b.courtOrderExists)) {
      return undecided();
    }

    const missing: string[] = [];
    if (!a.subscriberBirthdate) missing.push(`${a.id}.subscriberBirthdate`);
    if (!b.subscriberBirthdate) missing.push(`${b.id}.subscriberBirthdate`);
    if (missing.length) {
      return needsInfo(
        missing,
        `The birthday rule decides which parent's plan pays first for a dependent ` +
          `child, and we do not have ${
            missing.length === 2 ? "either subscriber's" : "one subscriber's"
          } date of birth. Enter it rather than letting the claim go to a guessed payer.`
      );
    }

    const aYmd = parseYmd(a.subscriberBirthdate);
    const bYmd = parseYmd(b.subscriberBirthdate);
    if (!aYmd || !bYmd) {
      return needsInfo(
        [
          ...(aYmd ? [] : [`${a.id}.subscriberBirthdate`]),
          ...(bYmd ? [] : [`${b.id}.subscriberBirthdate`]),
        ],
        `A subscriber date of birth is present but could not be read as a date.`
      );
    }

    const cmp = compareMonthDay(aYmd, bYmd);
    if (cmp === 0) {
      return {
        decision: 'UNDECIDED',
        explanation:
          `Both subscribers share the same birthday (month and day), so the ` +
          `birthday rule cannot separate them; the plan in force longer decides.`,
      };
    }

    const winner = cmp < 0 ? a : b;
    const loser = cmp < 0 ? b : a;
    const fmt = (c: CoverageFacts) => {
      const y = parseYmd(c.subscriberBirthdate)!;
      return `${String(y.month).padStart(2, '0')}-${String(y.day).padStart(2, '0')}`;
    };
    const presumed =
      !a.custodyArrangement && !b.custodyArrangement
        ? ` (no custody arrangement on file, so the parents are taken to be living together)`
        : '';
    return decide(
      cmp < 0,
      `Birthday rule: ${winner.subscriberName || 'the subscriber'} on ${label(winner)} ` +
        `has the earlier birthday in the year (${fmt(winner)} before ${fmt(loser)}), ` +
        `so that plan pays first. The birth year is not considered${presumed}.`
    );
  },
};

// ── 8. Custody ────────────────────────────────────────────────────────────

/**
 * Separated or divorced parents. A court order naming the parent responsible
 * for health costs overrides everything else. With no court order the order
 * is: custodial parent, that parent's spouse, non-custodial parent, that
 * parent's spouse. Joint custody with no court order is sent back to the
 * birthday rule.
 *
 * Custody facts are recorded per coverage (that is where the front desk
 * enters them), so this rule cross-checks the two sides and asks a human when
 * they disagree rather than picking one.
 */
export const CUSTODY: CobRule = {
  code: 'CUSTODY',
  description: 'Separated/divorced parents: court order, else custodial-parent chain',
  evaluate(a, b) {
    if (!isDependentChild(a) || !isDependentChild(b)) return undecided();

    const separated = (c: CoverageFacts): boolean =>
      c.custodyArrangement === 'SEPARATED' ||
      c.custodyArrangement === 'DIVORCED' ||
      c.custodyArrangement === 'JOINT_CUSTODY';

    if (!separated(a) && !separated(b)) return undecided();

    // One side says divorced, the other says living together. Both cannot be
    // true, and the two readings give different primaries.
    if (a.custodyArrangement && b.custodyArrangement && a.custodyArrangement !== b.custodyArrangement) {
      return needsInfo(
        [`${a.id}.custodyArrangement`, `${b.id}.custodyArrangement`],
        `The two policies record different custody arrangements for this child ` +
          `(${a.custodyArrangement} vs ${b.custodyArrangement}). They cannot both be ` +
          `right, and they lead to different primary payers.`
      );
    }

    const courtOrder = a.courtOrderExists || b.courtOrderExists;

    if (courtOrder) {
      const aNamed = a.courtOrderNamesThisCoverage;
      const bNamed = b.courtOrderNamesThisCoverage;
      if (aNamed === bNamed) {
        return needsInfo(
          [`${a.id}.courtOrderNamesThisCoverage`, `${b.id}.courtOrderNamesThisCoverage`],
          aNamed
            ? `A court order is on file but both policies are marked as the one it ` +
                `names. Exactly one parent can be the court-ordered responsible party.`
            : `A court order assigning responsibility for this child's health costs ` +
                `is on file, but neither policy is marked as the one it names.`
        );
      }
      const named = aNamed ? a : b;
      const other = aNamed ? b : a;
      return decide(
        aNamed,
        `A court order names ${named.subscriberName || 'the subscriber'} on ` +
          `${label(named)} as responsible for this child's health care costs, so ` +
          `that plan pays first regardless of custody or birthdays — including ` +
          `where the other parent has custody.`
      );
    }

    // Joint custody, nobody named by a court: the birthday rule applies.
    if (a.custodyArrangement === 'JOINT_CUSTODY' || b.custodyArrangement === 'JOINT_CUSTODY') {
      return undecided();
    }

    const CHAIN: Record<string, number> = {
      CUSTODIAL: 0,
      CUSTODIAL_SPOUSE: 1,
      NON_CUSTODIAL: 2,
      NON_CUSTODIAL_SPOUSE: 3,
    };

    const missing: string[] = [];
    if (!a.custodyRole) missing.push(`${a.id}.custodyRole`);
    if (!b.custodyRole) missing.push(`${b.id}.custodyRole`);
    if (missing.length) {
      return needsInfo(
        missing,
        `With separated or divorced parents and no court order, the order runs ` +
          `custodial parent, then their spouse, then the non-custodial parent, then ` +
          `their spouse — and we do not know which of those this policy's ` +
          `subscriber is.`
      );
    }

    const aRank = CHAIN[a.custodyRole!];
    const bRank = CHAIN[b.custodyRole!];
    if (aRank === bRank) {
      return needsInfo(
        [`${a.id}.custodyRole`, `${b.id}.custodyRole`],
        `Both policies are recorded with the same role in the custody chain ` +
          `(${a.custodyRole}), so the chain cannot order them.`
      );
    }

    const NAMES: Record<string, string> = {
      CUSTODIAL: 'the custodial parent',
      CUSTODIAL_SPOUSE: "the custodial parent's spouse",
      NON_CUSTODIAL: 'the non-custodial parent',
      NON_CUSTODIAL_SPOUSE: "the non-custodial parent's spouse",
    };
    const winner = aRank < bRank ? a : b;
    const loser = aRank < bRank ? b : a;
    return decide(
      aRank < bRank,
      `The parents are ${(a.custodyArrangement || b.custodyArrangement || '').toLowerCase()} ` +
        `with no court order, so the custodial chain applies: ${label(winner)} covers ` +
        `the child through ${NAMES[winner.custodyRole!]}, which comes before ` +
        `${NAMES[loser.custodyRole!]} on ${label(loser)}.`
    );
  },
};

// ── 9 & 10. Active employment before retiree / COBRA ──────────────────────

/**
 * Both rules below are "same person, two statuses". The guard on
 * `sameSubscriber` is essential: an active plan held by the patient and a
 * retiree plan held by their spouse is a subscriber-vs-dependent question,
 * already settled above, not this one.
 */
export const ACTIVE_BEFORE_RETIREE: CobRule = {
  code: 'ACTIVE_BEFORE_RETIREE',
  description: 'Same subscriber: active employment coverage pays before retiree coverage',
  evaluate(a, b) {
    if (!sameSubscriber(a, b)) return undecided();
    const aActive = a.employmentStatus === 'ACTIVE';
    const bActive = b.employmentStatus === 'ACTIVE';
    if (aActive === bActive) return undecided();
    const active = aActive ? a : b;
    const other = aActive ? b : a;
    if (!isRetireeCoverage(other)) return undecided();

    return decide(
      aActive,
      `The same person holds both policies: ${label(active)} is through active ` +
        `employment and ${label(other)} is retiree coverage, so the active plan ` +
        `pays first.`
    );
  },
};

export const ACTIVE_BEFORE_COBRA: CobRule = {
  code: 'ACTIVE_BEFORE_COBRA',
  description: 'Same subscriber: active employment coverage pays before COBRA continuation',
  evaluate(a, b) {
    if (!sameSubscriber(a, b)) return undecided();
    const aActive = a.employmentStatus === 'ACTIVE';
    const bActive = b.employmentStatus === 'ACTIVE';
    if (aActive === bActive) return undecided();
    const active = aActive ? a : b;
    const other = aActive ? b : a;
    if (!isCobraCoverage(other)) return undecided();

    return decide(
      aActive,
      `The same person holds both policies: ${label(active)} is through active ` +
        `employment and ${label(other)} is COBRA continuation coverage, so the ` +
        `active plan pays first.`
    );
  },
};

// ── 11. Longer coverage ───────────────────────────────────────────────────

/**
 * The last resort in the statutory sequence: the plan that has covered the
 * patient longer pays first. Reaching this rule with no effective dates means
 * the sequence has run out of ways to decide, so this asks rather than
 * inventing an order.
 */
export const LONGER_COVERAGE: CobRule = {
  code: 'LONGER_COVERAGE',
  description: 'The plan in force longer pays first (earlier effective date)',
  evaluate(a, b) {
    const missing: string[] = [];
    if (!a.effectiveDate) missing.push(`${a.id}.effectiveDate`);
    if (!b.effectiveDate) missing.push(`${b.id}.effectiveDate`);
    if (missing.length) {
      return needsInfo(
        missing,
        `Every earlier coordination rule was inconclusive, so the plan in force ` +
          `longer decides — and we do not have ${
            missing.length === 2 ? 'either plan' : 'one plan'
          }'s effective date.`
      );
    }

    const cmp = compareIsoDate(a.effectiveDate!, b.effectiveDate!);
    if (cmp === 0) {
      return {
        decision: 'UNDECIDED',
        explanation: `Both plans took effect on ${a.effectiveDate}, so neither has ` +
          `covered the patient longer.`,
      };
    }

    const winner = cmp < 0 ? a : b;
    const loser = cmp < 0 ? b : a;
    return decide(
      cmp < 0,
      `${label(winner)} has covered the patient longer (effective ` +
        `${winner.effectiveDate} vs ${loser.effectiveDate}), so it pays first.`
    );
  },
};

/**
 * THE STATUTORY ORDER. Do not sort this list.
 *
 * Injury liability first because it displaces health coverage entirely.
 * Medicare next, because the MSP rules are federal and override plan terms.
 * Medicaid and TRICARE next, because their statutory position cannot be moved
 * by any plan-level rule. Then the plan-level rules, and finally the
 * longer-coverage tiebreak.
 */
export const COB_RULES: CobRule[] = [
  INJURY_RELATED,
  MEDICARE_WORKING_AGED,
  MEDICARE_DISABILITY,
  MEDICARE_ESRD,
  MEDICARE_RETIREE,
  MEDICAID_LAST,
  TRICARE_SECONDARY,
  NO_COB_PROVISION,
  SUBSCRIBER_BEFORE_DEPENDENT,
  BIRTHDAY_RULE,
  CUSTODY,
  ACTIVE_BEFORE_RETIREE,
  ACTIVE_BEFORE_COBRA,
  LONGER_COVERAGE,
];

export interface PairOutcome {
  ruleCode: string;
  decision: 'A_FIRST' | 'B_FIRST' | 'UNDECIDED' | 'NEEDS_INFO';
  explanation: string;
  missingFields: string[];
  flags: string[];
}

/**
 * Runs the sequence over one pair and returns the first decisive outcome.
 *
 * Flags accumulate across rules even when the rule that raised them was not
 * the one that decided: NEITHER_PLAN_COORDINATES comes from an UNDECIDED
 * NO_COB_PROVISION and must survive the rules that run after it.
 */
export const evaluatePair = (
  a: CoverageFacts,
  b: CoverageFacts,
  ctx: ClaimContext,
  rules: CobRule[] = COB_RULES
): PairOutcome => {
  const flags: string[] = [];
  let lastExplanation = '';

  for (const rule of rules) {
    const result = rule.evaluate(a, b, ctx);
    for (const flag of result.flags || []) {
      if (!flags.includes(flag)) flags.push(flag);
    }
    if (result.explanation) lastExplanation = result.explanation;

    if (result.decision === 'A_FIRST' || result.decision === 'B_FIRST') {
      return {
        ruleCode: rule.code,
        decision: result.decision,
        explanation: result.explanation || rule.description,
        missingFields: [],
        flags,
      };
    }

    if (result.decision === 'NEEDS_INFO') {
      return {
        ruleCode: rule.code,
        decision: 'NEEDS_INFO',
        explanation: result.explanation || rule.description,
        missingFields: result.missingFields || [],
        flags,
      };
    }
  }

  return {
    ruleCode: 'NO_RULE_DECIDED',
    decision: 'UNDECIDED',
    explanation:
      lastExplanation ||
      `No coordination rule could separate ${label(a)} and ${label(b)}.`,
    missingFields: [],
    flags,
  };
};
