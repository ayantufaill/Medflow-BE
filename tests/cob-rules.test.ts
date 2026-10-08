/**
 * COB rule-engine unit tests.
 *
 * Pure: no database, no fixtures, no clock. Each test states a real front-desk
 * situation and pins the one rule that should decide it, because the failure
 * mode this suite exists to catch is subtle — a rule that still returns an
 * answer, just the wrong payer, after someone reorders COB_RULES or "tidies"
 * a guard.
 */
import { describe, it, expect } from 'vitest';
import {
  ACTIVE_BEFORE_COBRA,
  ACTIVE_BEFORE_RETIREE,
  BIRTHDAY_RULE,
  COB_RULES,
  CUSTODY,
  INJURY_RELATED,
  LONGER_COVERAGE,
  MEDICAID_LAST,
  MEDICARE_DISABILITY,
  MEDICARE_ESRD,
  MEDICARE_RETIREE,
  MEDICARE_WORKING_AGED,
  NO_COB_PROVISION,
  SUBSCRIBER_BEFORE_DEPENDENT,
  TRICARE_SECONDARY,
  evaluatePair,
} from '../src/services/cob/rules';
import type { ClaimContext, CoverageFacts } from '../src/services/cob/types';

const DOS = '2026-03-01';
const ctx: ClaimContext = { dateOfService: DOS };

let seq = 0;
const coverage = (overrides: Partial<CoverageFacts> = {}): CoverageFacts => ({
  id: String(++seq),
  planId: `plan-${seq}`,
  carrierId: `carrier-${seq}`,
  carrierName: `Carrier ${seq}`,
  payerType: 'COMMERCIAL',
  benefitCategory: 'MEDICAL',
  coordinatesBenefits: true,
  cobPaymentMethod: 'UNKNOWN',
  cobInfoSource: 'DEFAULT',
  relationship: 'SELF',
  subscriberName: 'Subscriber',
  subscriberBirthdate: null,
  subscriberKey: `sub-${seq}`,
  coverageBasis: 'EMPLOYER_GROUP',
  employmentStatus: 'ACTIVE',
  employerSizeBand: null,
  medicareEntitlementReason: null,
  esrdEntitlementDate: null,
  custodyArrangement: null,
  custodyRole: null,
  courtOrderExists: false,
  courtOrderNamesThisCoverage: false,
  isTricareSupplement: false,
  effectiveDate: '2020-01-01',
  terminationDate: null,
  ...overrides,
});

describe('INJURY_RELATED', () => {
  it("puts workers' comp first on a claim flagged as injury-related", () => {
    const comp = coverage({ payerType: 'WORKERS_COMP', carrierName: 'State Fund' });
    const health = coverage({ carrierName: 'Aetna' });
    const result = INJURY_RELATED.evaluate(comp, health, { ...ctx, injuryRelated: true });
    expect(result.decision).toBe('A_FIRST');
    expect(result.explanation).toContain('State Fund');
  });

  it('ignores the comp policy entirely on an unrelated claim', () => {
    // The flu shot is not the back injury. A comp policy that paid for it
    // would be a billing error, not coordination.
    const comp = coverage({ payerType: 'WORKERS_COMP' });
    const health = coverage();
    expect(INJURY_RELATED.evaluate(comp, health, ctx).decision).toBe('UNDECIDED');
  });

  it('respects the injury TYPE when the claim names one', () => {
    const auto = coverage({ payerType: 'AUTO_LIABILITY' });
    const comp = coverage({ payerType: 'WORKERS_COMP' });
    const result = INJURY_RELATED.evaluate(auto, comp, {
      ...ctx,
      injuryRelated: true,
      injuryType: 'AUTO_LIABILITY',
    });
    expect(result.decision).toBe('A_FIRST');
  });
});

describe('Medicare Secondary Payer rules', () => {
  const medicare = (overrides: Partial<CoverageFacts> = {}) =>
    coverage({
      payerType: 'MEDICARE',
      coverageBasis: 'MEDICARE',
      carrierName: 'Medicare',
      employmentStatus: null,
      ...overrides,
    });

  it('age-based with a 25-employee employer: group plan is primary', () => {
    const mc = medicare({ medicareEntitlementReason: 'AGE' });
    const group = coverage({ employerSizeBand: '20_TO_99', carrierName: 'BCBS' });
    const result = MEDICARE_WORKING_AGED.evaluate(mc, group, ctx);
    expect(result.decision).toBe('B_FIRST');
    expect(result.explanation).toContain('20 or more employees');
  });

  it('age-based with a 15-employee employer: Medicare is primary', () => {
    const mc = medicare({ medicareEntitlementReason: 'AGE' });
    const group = coverage({ employerSizeBand: 'UNDER_20' });
    const result = MEDICARE_WORKING_AGED.evaluate(mc, group, ctx);
    expect(result.decision).toBe('A_FIRST');
    expect(result.explanation).toContain('fewer than 20');
  });

  it('asks for the employer size rather than guessing it', () => {
    const mc = medicare({ medicareEntitlementReason: 'AGE' });
    const group = coverage({ employerSizeBand: null });
    const result = MEDICARE_WORKING_AGED.evaluate(mc, group, ctx);
    expect(result.decision).toBe('NEEDS_INFO');
    expect(result.missingFields).toContain(`${group.id}.employerSizeBand`);
  });

  it('asks for the entitlement reason when Medicare meets active employment', () => {
    const mc = medicare({ medicareEntitlementReason: null });
    const group = coverage({ employerSizeBand: '100_PLUS' });
    const result = MEDICARE_WORKING_AGED.evaluate(mc, group, ctx);
    expect(result.decision).toBe('NEEDS_INFO');
    expect(result.missingFields).toContain(`${mc.id}.medicareEntitlementReason`);
  });

  it('disability with an 80-employee employer: Medicare is primary', () => {
    // The disability threshold is 100, not 20 — an 80-employee employer is a
    // group plan under working-aged and secondary under disability.
    const mc = medicare({ medicareEntitlementReason: 'DISABILITY' });
    const group = coverage({ employerSizeBand: '20_TO_99' });
    const result = MEDICARE_DISABILITY.evaluate(mc, group, ctx);
    expect(result.decision).toBe('A_FIRST');
    expect(result.explanation).toContain('fewer than 100');
  });

  it('disability with a 100+ employer: group plan is primary', () => {
    const mc = medicare({ medicareEntitlementReason: 'DISABILITY' });
    const group = coverage({ employerSizeBand: '100_PLUS' });
    expect(MEDICARE_DISABILITY.evaluate(mc, group, ctx).decision).toBe('B_FIRST');
  });

  it('ESRD month 12: group plan is primary', () => {
    const mc = medicare({ medicareEntitlementReason: 'ESRD', esrdEntitlementDate: '2025-04-01' });
    const group = coverage();
    const result = MEDICARE_ESRD.evaluate(mc, group, { ...ctx, dateOfService: '2026-03-01' });
    expect(result.decision).toBe('B_FIRST');
    expect(result.explanation).toContain('coordination period');
  });

  it('ESRD month 31: Medicare is primary', () => {
    const mc = medicare({ medicareEntitlementReason: 'ESRD', esrdEntitlementDate: '2023-08-01' });
    const group = coverage();
    const result = MEDICARE_ESRD.evaluate(mc, group, { ...ctx, dateOfService: '2026-03-01' });
    expect(result.decision).toBe('A_FIRST');
    expect(result.explanation).toContain('past the 30-month');
  });

  it('ESRD without an entitlement date asks rather than assuming month 1', () => {
    const mc = medicare({ medicareEntitlementReason: 'ESRD', esrdEntitlementDate: null });
    const result = MEDICARE_ESRD.evaluate(mc, coverage(), ctx);
    expect(result.decision).toBe('NEEDS_INFO');
    expect(result.missingFields?.[0]).toContain('esrdEntitlementDate');
  });

  it('the 30-month boundary is exclusive at month 30', () => {
    const mc = medicare({ medicareEntitlementReason: 'ESRD', esrdEntitlementDate: '2023-09-01' });
    // 2023-09-01 + 30 months = 2026-03-01, the first day Medicare is primary.
    expect(
      MEDICARE_ESRD.evaluate(mc, coverage(), { ...ctx, dateOfService: '2026-03-01' }).decision
    ).toBe('A_FIRST');
    expect(
      MEDICARE_ESRD.evaluate(mc, coverage(), { ...ctx, dateOfService: '2026-02-28' }).decision
    ).toBe('B_FIRST');
  });

  it('Medicare pays before retiree coverage', () => {
    const mc = medicare({ medicareEntitlementReason: 'AGE' });
    const retiree = coverage({ coverageBasis: 'RETIREE', employmentStatus: 'RETIRED' });
    const result = MEDICARE_RETIREE.evaluate(mc, retiree, ctx);
    expect(result.decision).toBe('A_FIRST');
    expect(result.explanation).toContain('retiree');
  });

  it('does not fire the working-aged rule on retiree coverage', () => {
    // Retiree coverage is not current employment, so the employer size band
    // is irrelevant and the rule must stay out of the way.
    const mc = medicare({ medicareEntitlementReason: 'AGE' });
    const retiree = coverage({
      coverageBasis: 'RETIREE',
      employmentStatus: 'RETIRED',
      employerSizeBand: '100_PLUS',
    });
    expect(MEDICARE_WORKING_AGED.evaluate(mc, retiree, ctx).decision).toBe('UNDECIDED');
  });
});

describe('MEDICAID_LAST', () => {
  it('puts Medicaid after a commercial plan', () => {
    const medicaid = coverage({ payerType: 'MEDICAID', carrierName: 'State Medicaid' });
    const commercial = coverage({ carrierName: 'Cigna' });
    const result = MEDICAID_LAST.evaluate(medicaid, commercial, ctx);
    expect(result.decision).toBe('B_FIRST');
    expect(result.explanation).toContain('last resort');
  });

  it('puts Medicaid after Medicare too', () => {
    const medicaid = coverage({ payerType: 'MEDICAID' });
    const medicare = coverage({ payerType: 'MEDICARE' });
    expect(MEDICAID_LAST.evaluate(medicare, medicaid, ctx).decision).toBe('A_FIRST');
  });

  it('cannot separate two Medicaid coverages', () => {
    const a = coverage({ payerType: 'MEDICAID' });
    const b = coverage({ payerType: 'MEDICAID' });
    expect(MEDICAID_LAST.evaluate(a, b, ctx).decision).toBe('UNDECIDED');
  });
});

describe('TRICARE', () => {
  it('is secondary to commercial coverage', () => {
    const tricare = coverage({ payerType: 'TRICARE', carrierName: 'TRICARE' });
    const commercial = coverage({ carrierName: 'UHC' });
    const result = TRICARE_SECONDARY.evaluate(tricare, commercial, ctx);
    expect(result.decision).toBe('B_FIRST');
  });

  it('pays before Medicaid', () => {
    const tricare = coverage({ payerType: 'TRICARE' });
    const medicaid = coverage({ payerType: 'MEDICAID' });
    expect(TRICARE_SECONDARY.evaluate(tricare, medicaid, ctx).decision).toBe('A_FIRST');
  });

  it('pays before a TRICARE supplement', () => {
    const tricare = coverage({ payerType: 'TRICARE' });
    const supplement = coverage({ payerType: 'TRICARE', isTricareSupplement: true });
    expect(TRICARE_SECONDARY.evaluate(tricare, supplement, ctx).decision).toBe('A_FIRST');
  });
});

describe('NO_COB_PROVISION', () => {
  it('makes the non-coordinating plan primary', () => {
    const noCob = coverage({ coordinatesBenefits: false, carrierName: 'Indemnity Co' });
    const withCob = coverage({ carrierName: 'Aetna' });
    const result = NO_COB_PROVISION.evaluate(noCob, withCob, ctx);
    expect(result.decision).toBe('A_FIRST');
    expect(result.explanation).toContain('no coordination-of-benefits provision');
  });

  it('falls through and flags when NEITHER plan coordinates', () => {
    // Both may pay in full. There is no primary to find, and the usual
    // "secondary pays the gap" arithmetic does not apply.
    const a = coverage({ coordinatesBenefits: false });
    const b = coverage({ coordinatesBenefits: false });
    const result = NO_COB_PROVISION.evaluate(a, b, ctx);
    expect(result.decision).toBe('UNDECIDED');
    expect(result.flags).toContain('NEITHER_PLAN_COORDINATES');
  });

  it('stays out of the way when both coordinate', () => {
    expect(NO_COB_PROVISION.evaluate(coverage(), coverage(), ctx).decision).toBe('UNDECIDED');
  });
});

describe('SUBSCRIBER_BEFORE_DEPENDENT', () => {
  it("puts the patient's own plan before their spouse's", () => {
    const own = coverage({ relationship: 'SELF', carrierName: 'Own Employer' });
    const spouse = coverage({ relationship: 'SPOUSE', carrierName: "Spouse's Employer" });
    const result = SUBSCRIBER_BEFORE_DEPENDENT.evaluate(own, spouse, ctx);
    expect(result.decision).toBe('A_FIRST');
    expect(result.explanation).toContain('own policy');
  });

  it('cannot separate two policies the patient subscribes to', () => {
    const a = coverage({ relationship: 'SELF' });
    const b = coverage({ relationship: 'SELF' });
    expect(SUBSCRIBER_BEFORE_DEPENDENT.evaluate(a, b, ctx).decision).toBe('UNDECIDED');
  });
});

describe('BIRTHDAY_RULE', () => {
  const parentPlan = (birthdate: string | null, name: string, extra: Partial<CoverageFacts> = {}) =>
    coverage({
      relationship: 'PARENT',
      subscriberBirthdate: birthdate,
      subscriberName: name,
      custodyArrangement: 'TOGETHER',
      carrierName: `${name}'s plan`,
      ...extra,
    });

  it('mother 1985-03-10 before father 1980-07-22 — the YEAR is ignored', () => {
    // The father is older. The birthday rule does not care: March precedes
    // July, so the mother's plan is primary. Comparing full dates here would
    // reverse it, which is the classic implementation bug.
    const mother = parentPlan('1985-03-10', 'Mother');
    const father = parentPlan('1980-07-22', 'Father');
    const result = BIRTHDAY_RULE.evaluate(mother, father, ctx);
    expect(result.decision).toBe('A_FIRST');
    expect(result.explanation).toContain('03-10');
    expect(result.explanation).toContain('not considered');
  });

  it('is argument-order independent', () => {
    const mother = parentPlan('1985-03-10', 'Mother');
    const father = parentPlan('1980-07-22', 'Father');
    expect(BIRTHDAY_RULE.evaluate(father, mother, ctx).decision).toBe('B_FIRST');
  });

  it('compares the day when the month is the same', () => {
    const a = parentPlan('1990-06-04', 'A');
    const b = parentPlan('1975-06-21', 'B');
    expect(BIRTHDAY_RULE.evaluate(a, b, ctx).decision).toBe('A_FIRST');
  });

  it('falls through to longer coverage on the same birthday', () => {
    const a = parentPlan('1985-03-10', 'A');
    const b = parentPlan('1979-03-10', 'B');
    const result = BIRTHDAY_RULE.evaluate(a, b, ctx);
    expect(result.decision).toBe('UNDECIDED');
    expect(result.explanation).toContain('same birthday');
  });

  it('refuses to guess when a subscriber DOB is missing', () => {
    const known = parentPlan('1985-03-10', 'Mother');
    const unknown = parentPlan(null, 'Father');
    const result = BIRTHDAY_RULE.evaluate(known, unknown, ctx);
    expect(result.decision).toBe('NEEDS_INFO');
    expect(result.missingFields).toEqual([`${unknown.id}.subscriberBirthdate`]);
  });

  it('does not apply to divorced parents', () => {
    const a = parentPlan('1985-03-10', 'Mother', { custodyArrangement: 'DIVORCED' });
    const b = parentPlan('1980-07-22', 'Father', { custodyArrangement: 'DIVORCED' });
    expect(BIRTHDAY_RULE.evaluate(a, b, ctx).decision).toBe('UNDECIDED');
  });

  it('applies to joint custody with no court order', () => {
    const a = parentPlan('1985-03-10', 'Mother', { custodyArrangement: 'JOINT_CUSTODY' });
    const b = parentPlan('1980-07-22', 'Father', { custodyArrangement: 'JOINT_CUSTODY' });
    expect(BIRTHDAY_RULE.evaluate(a, b, ctx).decision).toBe('A_FIRST');
  });

  it('says so when it is assuming the parents live together', () => {
    const a = parentPlan('1985-03-10', 'Mother', { custodyArrangement: null });
    const b = parentPlan('1980-07-22', 'Father', { custodyArrangement: null });
    const result = BIRTHDAY_RULE.evaluate(a, b, ctx);
    expect(result.decision).toBe('A_FIRST');
    expect(result.explanation).toContain('no custody arrangement on file');
  });
});

describe('CUSTODY', () => {
  const parentPlan = (overrides: Partial<CoverageFacts>) =>
    coverage({
      relationship: 'PARENT',
      custodyArrangement: 'DIVORCED',
      subscriberBirthdate: '1985-01-01',
      ...overrides,
    });

  it('a court order naming the father beats the mother having custody', () => {
    const mother = parentPlan({
      subscriberName: 'Mother',
      custodyRole: 'CUSTODIAL',
      courtOrderExists: true,
      courtOrderNamesThisCoverage: false,
    });
    const father = parentPlan({
      subscriberName: 'Father',
      custodyRole: 'NON_CUSTODIAL',
      courtOrderExists: true,
      courtOrderNamesThisCoverage: true,
    });
    const result = CUSTODY.evaluate(mother, father, ctx);
    expect(result.decision).toBe('B_FIRST');
    expect(result.explanation).toContain('court order');
    expect(result.explanation).toContain('Father');
  });

  it('follows the custodial chain with no court order', () => {
    const custodial = parentPlan({ custodyRole: 'CUSTODIAL', subscriberName: 'Mother' });
    const nonCustodial = parentPlan({ custodyRole: 'NON_CUSTODIAL', subscriberName: 'Father' });
    const result = CUSTODY.evaluate(nonCustodial, custodial, ctx);
    expect(result.decision).toBe('B_FIRST');
    expect(result.explanation).toContain('custodial chain');
  });

  it("puts the custodial parent's spouse ahead of the non-custodial parent", () => {
    const stepParent = parentPlan({ custodyRole: 'CUSTODIAL_SPOUSE' });
    const nonCustodial = parentPlan({ custodyRole: 'NON_CUSTODIAL' });
    expect(CUSTODY.evaluate(stepParent, nonCustodial, ctx).decision).toBe('A_FIRST');
  });

  it('sends joint custody with no court order back to the birthday rule', () => {
    const a = parentPlan({ custodyArrangement: 'JOINT_CUSTODY', custodyRole: 'CUSTODIAL' });
    const b = parentPlan({ custodyArrangement: 'JOINT_CUSTODY', custodyRole: 'NON_CUSTODIAL' });
    expect(CUSTODY.evaluate(a, b, ctx).decision).toBe('UNDECIDED');
  });

  it('asks when a court order exists but names nobody', () => {
    const a = parentPlan({ custodyRole: 'CUSTODIAL', courtOrderExists: true });
    const b = parentPlan({ custodyRole: 'NON_CUSTODIAL', courtOrderExists: true });
    const result = CUSTODY.evaluate(a, b, ctx);
    expect(result.decision).toBe('NEEDS_INFO');
    expect(result.explanation).toContain('neither policy is marked');
  });

  it('asks when the two policies disagree about the custody arrangement', () => {
    const a = parentPlan({ custodyArrangement: 'DIVORCED', custodyRole: 'CUSTODIAL' });
    const b = parentPlan({ custodyArrangement: 'TOGETHER', custodyRole: 'NON_CUSTODIAL' });
    const result = CUSTODY.evaluate(a, b, ctx);
    expect(result.decision).toBe('NEEDS_INFO');
    expect(result.explanation).toContain('cannot both be');
  });

  it('asks for the custody role rather than inventing a chain position', () => {
    const a = parentPlan({ custodyRole: null });
    const b = parentPlan({ custodyRole: 'NON_CUSTODIAL' });
    const result = CUSTODY.evaluate(a, b, ctx);
    expect(result.decision).toBe('NEEDS_INFO');
    expect(result.missingFields).toContain(`${a.id}.custodyRole`);
  });
});

describe('ACTIVE_BEFORE_RETIREE and ACTIVE_BEFORE_COBRA', () => {
  it('active employment beats the same person’s retiree plan', () => {
    const active = coverage({ subscriberKey: 'same', employmentStatus: 'ACTIVE' });
    const retiree = coverage({
      subscriberKey: 'same',
      employmentStatus: 'RETIRED',
      coverageBasis: 'RETIREE',
    });
    const result = ACTIVE_BEFORE_RETIREE.evaluate(active, retiree, ctx);
    expect(result.decision).toBe('A_FIRST');
    expect(result.explanation).toContain('same person');
  });

  it('active employment beats the same person’s COBRA continuation', () => {
    const active = coverage({ subscriberKey: 'same', employmentStatus: 'ACTIVE' });
    const cobra = coverage({
      subscriberKey: 'same',
      employmentStatus: 'COBRA',
      coverageBasis: 'COBRA',
    });
    const result = ACTIVE_BEFORE_COBRA.evaluate(active, cobra, ctx);
    expect(result.decision).toBe('A_FIRST');
    expect(result.explanation).toContain('COBRA');
  });

  it('stays out of it when the subscribers are different people', () => {
    // The patient's active plan vs their spouse's retiree plan is a
    // subscriber-vs-dependent question, already settled by an earlier rule.
    const mine = coverage({ subscriberKey: 'me', employmentStatus: 'ACTIVE' });
    const theirs = coverage({
      subscriberKey: 'spouse',
      employmentStatus: 'RETIRED',
      coverageBasis: 'RETIREE',
    });
    expect(ACTIVE_BEFORE_RETIREE.evaluate(mine, theirs, ctx).decision).toBe('UNDECIDED');
  });
});

describe('LONGER_COVERAGE', () => {
  it('the earlier effective date pays first', () => {
    const older = coverage({ effectiveDate: '2015-06-01', carrierName: 'Old Plan' });
    const newer = coverage({ effectiveDate: '2024-01-01', carrierName: 'New Plan' });
    const result = LONGER_COVERAGE.evaluate(older, newer, ctx);
    expect(result.decision).toBe('A_FIRST');
    expect(result.explanation).toContain('covered the patient longer');
  });

  it('cannot separate plans that started the same day', () => {
    const a = coverage({ effectiveDate: '2020-01-01' });
    const b = coverage({ effectiveDate: '2020-01-01' });
    expect(LONGER_COVERAGE.evaluate(a, b, ctx).decision).toBe('UNDECIDED');
  });

  it('asks for a missing effective date', () => {
    const a = coverage({ effectiveDate: null });
    const b = coverage({ effectiveDate: '2020-01-01' });
    const result = LONGER_COVERAGE.evaluate(a, b, ctx);
    expect(result.decision).toBe('NEEDS_INFO');
    expect(result.missingFields).toEqual([`${a.id}.effectiveDate`]);
  });
});

describe('evaluatePair: the sequence as a whole', () => {
  it('stops at the first decisive rule', () => {
    // Both SUBSCRIBER_BEFORE_DEPENDENT and LONGER_COVERAGE could speak here.
    // The earlier one must win, and must be the rule reported.
    const own = coverage({ relationship: 'SELF', effectiveDate: '2024-01-01' });
    const spouse = coverage({ relationship: 'SPOUSE', effectiveDate: '2010-01-01' });
    const outcome = evaluatePair(own, spouse, ctx);
    expect(outcome.ruleCode).toBe('SUBSCRIBER_BEFORE_DEPENDENT');
    expect(outcome.decision).toBe('A_FIRST');
  });

  it("own plan coordinates, spouse's does not: the spouse's plan is primary", () => {
    // NO_COB_PROVISION runs BEFORE SUBSCRIBER_BEFORE_DEPENDENT, so it
    // overrides the usual "own plan first" answer. Reordering those two rules
    // would silently flip this case.
    const own = coverage({ relationship: 'SELF', coordinatesBenefits: true });
    const spouse = coverage({ relationship: 'SPOUSE', coordinatesBenefits: false });
    const outcome = evaluatePair(own, spouse, ctx);
    expect(outcome.ruleCode).toBe('NO_COB_PROVISION');
    expect(outcome.decision).toBe('B_FIRST');
  });

  it('carries a flag raised by an UNDECIDED rule through to the decision', () => {
    const own = coverage({
      relationship: 'SELF',
      coordinatesBenefits: false,
      effectiveDate: '2024-01-01',
    });
    const spouse = coverage({
      relationship: 'SPOUSE',
      coordinatesBenefits: false,
      effectiveDate: '2010-01-01',
    });
    const outcome = evaluatePair(own, spouse, ctx);
    // NO_COB_PROVISION flagged and fell through; a later rule decided.
    expect(outcome.flags).toContain('NEITHER_PLAN_COORDINATES');
    expect(outcome.ruleCode).toBe('SUBSCRIBER_BEFORE_DEPENDENT');
  });

  it('reports NEEDS_INFO instead of falling through to a later rule', () => {
    // The birthday rule applies and cannot answer. LONGER_COVERAGE could
    // answer, but reaching it would produce a confident order from a rule the
    // statute never got to.
    const a = coverage({
      relationship: 'PARENT',
      custodyArrangement: 'TOGETHER',
      subscriberBirthdate: null,
      effectiveDate: '2015-01-01',
    });
    const b = coverage({
      relationship: 'PARENT',
      custodyArrangement: 'TOGETHER',
      subscriberBirthdate: '1980-01-01',
      effectiveDate: '2020-01-01',
    });
    const outcome = evaluatePair(a, b, ctx);
    expect(outcome.decision).toBe('NEEDS_INFO');
    expect(outcome.ruleCode).toBe('BIRTHDAY_RULE');
  });

  it('keeps the statutory rule order', () => {
    // A guard against a well-meaning alphabetical sort.
    expect(COB_RULES.map((r) => r.code)).toEqual([
      'INJURY_RELATED',
      'MEDICARE_WORKING_AGED',
      'MEDICARE_DISABILITY',
      'MEDICARE_ESRD',
      'MEDICARE_RETIREE',
      'MEDICAID_LAST',
      'TRICARE',
      'NO_COB_PROVISION',
      'SUBSCRIBER_BEFORE_DEPENDENT',
      'BIRTHDAY_RULE',
      'CUSTODY',
      'ACTIVE_BEFORE_RETIREE',
      'ACTIVE_BEFORE_COBRA',
      'LONGER_COVERAGE',
    ]);
  });
});
