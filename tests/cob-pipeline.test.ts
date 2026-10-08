/**
 * COB ranking pipeline tests — the scenarios a biller would recognise.
 *
 * These drive `determineOrder` end to end (steps 1-6) with no database, so a
 * scenario reads as the situation plus the expected order, and a failure
 * points at a rule rather than at fixture plumbing.
 */
import { describe, it, expect } from 'vitest';
import { determineOrder, comparePayerReported, findCycle } from '../src/services/cob/order';
import type { ClaimContext, CoverageFacts } from '../src/services/cob/types';

const ctx = (dateOfService = '2026-03-01', extra: Partial<ClaimContext> = {}): ClaimContext => ({
  dateOfService,
  ...extra,
});

const coverage = (id: string, overrides: Partial<CoverageFacts> = {}): CoverageFacts => ({
  id,
  planId: `plan-${id}`,
  carrierId: `carrier-${id}`,
  carrierName: `Carrier ${id}`,
  payerType: 'COMMERCIAL',
  benefitCategory: 'MEDICAL',
  coordinatesBenefits: true,
  cobPaymentMethod: 'UNKNOWN',
  cobInfoSource: 'DEFAULT',
  relationship: 'SELF',
  subscriberName: `Subscriber ${id}`,
  subscriberBirthdate: null,
  subscriberKey: `sub-${id}`,
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

/** The ordered coverage ids, which is what a biller actually reads. */
const sequence = (result: ReturnType<typeof determineOrder>): string[] =>
  result.positions.map((p) => p.coverageId);

describe('two plans, the everyday cases', () => {
  it("own employer plan before spouse's plan", () => {
    const own = coverage('1', { relationship: 'SELF' });
    const spouse = coverage('2', { relationship: 'SPOUSE' });
    const result = determineOrder([own, spouse], ctx());
    expect(result.status).toBe('SUGGESTED');
    expect(sequence(result)).toEqual(['1', '2']);
    expect(result.positions[0].ruleCode).toBe('SUBSCRIBER_BEFORE_DEPENDENT');
  });

  it("spouse's plan first when it has no COB provision", () => {
    const own = coverage('1', { relationship: 'SELF', coordinatesBenefits: true });
    const spouse = coverage('2', { relationship: 'SPOUSE', coordinatesBenefits: false });
    const result = determineOrder([own, spouse], ctx());
    expect(sequence(result)).toEqual(['2', '1']);
    expect(result.positions[0].ruleCode).toBe('NO_COB_PROVISION');
    expect(result.positions[0].explanation).toContain('no coordination-of-benefits provision');
  });

  it('neither plan coordinates: ordered by the next rules, and flagged', () => {
    const own = coverage('1', { relationship: 'SELF', coordinatesBenefits: false });
    const spouse = coverage('2', { relationship: 'SPOUSE', coordinatesBenefits: false });
    const result = determineOrder([own, spouse], ctx());
    // The subscriber rule, which runs next, decides the submission sequence.
    expect(sequence(result)).toEqual(['1', '2']);
    expect(result.flags).toContain('NEITHER_PLAN_COORDINATES');
    expect(result.status).toBe('SUGGESTED');
  });

  it('active plan before the same person’s COBRA', () => {
    const active = coverage('1', { subscriberKey: 'same', employmentStatus: 'ACTIVE' });
    const cobra = coverage('2', {
      subscriberKey: 'same',
      employmentStatus: 'COBRA',
      coverageBasis: 'COBRA',
    });
    expect(sequence(determineOrder([cobra, active], ctx()))).toEqual(['1', '2']);
  });

  it('active plan before the same person’s retiree coverage', () => {
    const active = coverage('1', { subscriberKey: 'same', employmentStatus: 'ACTIVE' });
    const retiree = coverage('2', {
      subscriberKey: 'same',
      employmentStatus: 'RETIRED',
      coverageBasis: 'RETIREE',
    });
    expect(sequence(determineOrder([retiree, active], ctx()))).toEqual(['1', '2']);
  });
});

describe('fixed-benefit indemnity coverage', () => {
  it('is excluded from the ranking and listed separately', () => {
    // It pays the patient a flat sum directly. Ranking it would put a payer
    // in the sequence that never receives this claim.
    const medical = coverage('1', { carrierName: 'Aetna' });
    const indemnity = coverage('2', {
      benefitCategory: 'FIXED_INDEMNITY',
      carrierName: 'Hospital Cash Co',
    });
    const result = determineOrder([medical, indemnity], ctx());

    expect(sequence(result)).toEqual(['1']);
    expect(result.excluded).toHaveLength(1);
    expect(result.excluded[0].coverageId).toBe('2');
    expect(result.excluded[0].ruleCode).toBe('NOT_MEDICAL_COVERAGE');
    expect(result.excluded[0].explanation).toContain('pays the patient a set amount directly');
  });

  it('leaves the one real plan as the sole primary', () => {
    const result = determineOrder(
      [coverage('1'), coverage('2', { benefitCategory: 'FIXED_INDEMNITY' })],
      ctx()
    );
    expect(result.positions[0].ruleCode).toBe('SOLE_COVERAGE');
  });

  it('excludes dental and vision from a medical claim too', () => {
    const result = determineOrder(
      [
        coverage('1'),
        coverage('2', { benefitCategory: 'DENTAL' }),
        coverage('3', { benefitCategory: 'VISION' }),
      ],
      ctx()
    );
    expect(sequence(result)).toEqual(['1']);
    expect(result.excluded.map((e) => e.coverageId).sort()).toEqual(['2', '3']);
  });
});

describe('a dependent child', () => {
  const parent = (id: string, birthdate: string, name: string, extra: Partial<CoverageFacts> = {}) =>
    coverage(id, {
      relationship: 'PARENT',
      subscriberBirthdate: birthdate,
      subscriberName: name,
      custodyArrangement: 'TOGETHER',
      ...extra,
    });

  it('married parents: mother 1985-03-10 is primary over father 1980-07-22', () => {
    const mother = parent('1', '1985-03-10', 'Mother');
    const father = parent('2', '1980-07-22', 'Father');
    const result = determineOrder([father, mother], ctx());
    expect(sequence(result)).toEqual(['1', '2']);
    expect(result.positions[0].ruleCode).toBe('BIRTHDAY_RULE');
  });

  it('same birthday: the plan in force longer wins', () => {
    const mother = parent('1', '1985-03-10', 'Mother', { effectiveDate: '2022-01-01' });
    const father = parent('2', '1979-03-10', 'Father', { effectiveDate: '2012-01-01' });
    const result = determineOrder([mother, father], ctx());
    expect(sequence(result)).toEqual(['2', '1']);
    expect(result.positions[0].ruleCode).toBe('LONGER_COVERAGE');
  });

  it('divorced with a court order naming the father: father is primary', () => {
    const mother = parent('1', '1985-03-10', 'Mother', {
      custodyArrangement: 'DIVORCED',
      custodyRole: 'CUSTODIAL',
      courtOrderExists: true,
      courtOrderNamesThisCoverage: false,
    });
    const father = parent('2', '1980-07-22', 'Father', {
      custodyArrangement: 'DIVORCED',
      custodyRole: 'NON_CUSTODIAL',
      courtOrderExists: true,
      courtOrderNamesThisCoverage: true,
    });
    const result = determineOrder([mother, father], ctx());
    // Despite the mother having custody AND the earlier birthday.
    expect(sequence(result)).toEqual(['2', '1']);
    expect(result.positions[0].ruleCode).toBe('CUSTODY');
    expect(result.positions[0].explanation).toContain('court order');
  });

  it('divorced with no court order: the custodial chain decides', () => {
    const custodial = parent('1', '1990-11-01', 'Mother', {
      custodyArrangement: 'DIVORCED',
      custodyRole: 'CUSTODIAL',
    });
    const stepParent = parent('2', '1988-02-01', 'Stepfather', {
      custodyArrangement: 'DIVORCED',
      custodyRole: 'CUSTODIAL_SPOUSE',
    });
    const nonCustodial = parent('3', '1985-01-15', 'Father', {
      custodyArrangement: 'DIVORCED',
      custodyRole: 'NON_CUSTODIAL',
    });
    const result = determineOrder([nonCustodial, stepParent, custodial], ctx());
    expect(sequence(result)).toEqual(['1', '2', '3']);
  });

  it('a missing subscriber DOB produces NEEDS_INFO and no order at all', () => {
    // Deliberately no partial order: a suggestion with a hole in it reads as
    // an answer, and the claim would go out on it.
    const mother = parent('1', '1985-03-10', 'Mother');
    const father = coverage('2', {
      relationship: 'PARENT',
      custodyArrangement: 'TOGETHER',
      subscriberBirthdate: null,
      subscriberName: 'Father',
    });
    const result = determineOrder([mother, father], ctx());
    expect(result.status).toBe('NEEDS_INFO');
    expect(result.positions).toEqual([]);
    expect(result.missingFields).toEqual([{ coverageId: '2', field: 'subscriberBirthdate' }]);
  });
});

describe('Medicare, Medicaid and TRICARE in a full order', () => {
  it('Medicaid always lands last', () => {
    const commercial = coverage('1', { carrierName: 'Aetna' });
    const medicaid = coverage('2', { payerType: 'MEDICAID', carrierName: 'Medicaid' });
    expect(sequence(determineOrder([medicaid, commercial], ctx()))).toEqual(['1', '2']);
  });

  it('Medicare before retiree coverage before Medicaid', () => {
    const medicare = coverage('1', {
      payerType: 'MEDICARE',
      coverageBasis: 'MEDICARE',
      medicareEntitlementReason: 'AGE',
      employmentStatus: null,
    });
    const retiree = coverage('2', { coverageBasis: 'RETIREE', employmentStatus: 'RETIRED' });
    const medicaid = coverage('3', { payerType: 'MEDICAID', employmentStatus: null });
    const result = determineOrder([medicaid, retiree, medicare], ctx());
    expect(sequence(result)).toEqual(['1', '2', '3']);
  });

  it("workers' comp displaces everything on an injury claim", () => {
    const comp = coverage('1', { payerType: 'WORKERS_COMP', coverageBasis: 'WORKERS_COMP' });
    const own = coverage('2', { relationship: 'SELF' });
    const spouse = coverage('3', { relationship: 'SPOUSE' });
    const result = determineOrder([own, spouse, comp], ctx('2026-03-01', { injuryRelated: true }));
    expect(sequence(result)).toEqual(['1', '2', '3']);
    expect(result.positions[0].ruleCode).toBe('INJURY_RELATED');
  });

  it('ESRD moves the same two coverages on two different dates of service', () => {
    // The whole reason orders are stored per effective date range.
    const medicare = coverage('1', {
      payerType: 'MEDICARE',
      coverageBasis: 'MEDICARE',
      medicareEntitlementReason: 'ESRD',
      esrdEntitlementDate: '2024-01-01',
      employmentStatus: null,
    });
    const group = coverage('2');

    expect(sequence(determineOrder([medicare, group], ctx('2025-01-01')))).toEqual(['2', '1']);
    expect(sequence(determineOrder([medicare, group], ctx('2026-08-01')))).toEqual(['1', '2']);
  });
});

describe('three coverages', () => {
  it('produces the correct full order', () => {
    const own = coverage('1', { relationship: 'SELF', carrierName: 'Own Employer' });
    const spouse = coverage('2', { relationship: 'SPOUSE', carrierName: "Spouse's Employer" });
    const medicaid = coverage('3', {
      payerType: 'MEDICAID',
      carrierName: 'Medicaid',
      employmentStatus: null,
    });
    const result = determineOrder([spouse, medicaid, own], ctx());
    expect(sequence(result)).toEqual(['1', '2', '3']);
    expect(result.status).toBe('SUGGESTED');
    // Every position carries its own reasoning.
    expect(result.positions.every((p) => p.explanation.length > 20)).toBe(true);
  });

  it('is independent of the input order', () => {
    const build = () => [
      coverage('1', { relationship: 'SELF' }),
      coverage('2', { relationship: 'SPOUSE' }),
      coverage('3', { payerType: 'MEDICAID', employmentStatus: null }),
    ];
    const [a, b, c] = build();
    const permutations = [
      [a, b, c],
      [c, b, a],
      [b, a, c],
      [c, a, b],
    ];
    for (const input of permutations) {
      expect(sequence(determineOrder(input, ctx()))).toEqual(['1', '2', '3']);
    }
  });

  it('detects a ranking cycle and refuses to call it an order', () => {
    // A real contradiction, not a contrived one. Three coverages:
    //
    //   A  the patient's own plan, employer with under 20 employees
    //   B  the spouse's plan, employer with 20-99 employees
    //   C  Medicare, age-entitled
    //
    // A before B   SUBSCRIBER_BEFORE_DEPENDENT (own plan before spouse's)
    // B before C   MEDICARE_WORKING_AGED (20+ employees, group pays first)
    // C before A   MEDICARE_WORKING_AGED (under 20, Medicare pays first)
    //
    // Every edge is correct on its own and the three cannot all hold. The
    // pairwise rules are not transitive, so this is reachable from real data
    // — and Array.sort with these rules as a comparator would have returned
    // a confident, arbitrary, unbillable order instead of reporting it.
    const own = coverage('1', {
      relationship: 'SELF',
      employerSizeBand: 'UNDER_20',
      carrierName: 'Small Employer Plan',
    });
    const spouse = coverage('2', {
      relationship: 'SPOUSE',
      employerSizeBand: '20_TO_99',
      carrierName: "Spouse's Employer Plan",
    });
    const medicare = coverage('3', {
      payerType: 'MEDICARE',
      coverageBasis: 'MEDICARE',
      medicareEntitlementReason: 'AGE',
      employmentStatus: null,
      carrierName: 'Medicare',
    });

    const result = determineOrder([own, spouse, medicare], ctx());
    expect(result.status).toBe('NEEDS_REVIEW');
    expect(result.flags).toContain('RANKING_CYCLE');
    // Still returns a complete list so the UI has something to show, but the
    // status is what gates billing.
    expect(result.positions).toHaveLength(3);
    // And the pairwise record is kept, so a biller can see the contradiction.
    expect(result.pairwise).toHaveLength(3);
    expect(result.pairwise.every((p) => p.decision !== 'UNDECIDED')).toBe(true);
  });
});

describe('coverage active on the date of service', () => {
  it('ignores a coverage that had terminated', () => {
    const current = coverage('1', { effectiveDate: '2025-01-01' });
    const ended = coverage('2', { effectiveDate: '2019-01-01', terminationDate: '2024-12-31' });
    const result = determineOrder([current, ended], ctx('2026-03-01'));
    expect(sequence(result)).toEqual(['1']);
  });

  it('ignores a coverage that had not started yet', () => {
    const current = coverage('1', { effectiveDate: '2020-01-01' });
    const future = coverage('2', { effectiveDate: '2026-06-01' });
    expect(sequence(determineOrder([current, future], ctx('2026-03-01')))).toEqual(['1']);
  });

  it('uses the coverage that WAS active on an older date of service', () => {
    const older = coverage('1', { effectiveDate: '2019-01-01', terminationDate: '2025-06-30' });
    const newer = coverage('2', { effectiveDate: '2025-07-01' });
    expect(sequence(determineOrder([older, newer], ctx('2025-02-01')))).toEqual(['1']);
    expect(sequence(determineOrder([older, newer], ctx('2026-02-01')))).toEqual(['2']);
  });
});

describe('cycle detection', () => {
  it('finds a three-node cycle and reports its path', () => {
    const edges = new Map([
      ['1', new Set(['2'])],
      ['2', new Set(['3'])],
      ['3', new Set(['1'])],
    ]);
    const cycle = findCycle(['1', '2', '3'], edges);
    expect(cycle).not.toBeNull();
    expect(cycle!.sort()).toEqual(['1', '2', '3']);
  });

  it('returns null for an acyclic graph', () => {
    const edges = new Map([
      ['1', new Set(['2', '3'])],
      ['2', new Set(['3'])],
      ['3', new Set<string>()],
    ]);
    expect(findCycle(['1', '2', '3'], edges)).toBeNull();
  });

  it('is not fooled by a diamond', () => {
    // Two paths to the same node is not a cycle, and a naive "already seen"
    // check would call it one.
    const edges = new Map([
      ['1', new Set(['2', '3'])],
      ['2', new Set(['4'])],
      ['3', new Set(['4'])],
      ['4', new Set<string>()],
    ]);
    expect(findCycle(['1', '2', '3', '4'], edges)).toBeNull();
  });
});

describe('payer comparison (step 6)', () => {
  const positions = [
    { position: 1, coverageId: '1', ruleCode: 'X', explanation: '' },
    { position: 2, coverageId: '2', ruleCode: 'X', explanation: '' },
  ];

  it('is silent when the payer agrees', () => {
    const comparison = comparePayerReported(positions, [
      {
        coverageId: '1',
        reportedSelfOrder: 1,
        reportedDate: '2026-02-01',
        source: 'PHONE',
        reportingCarrierName: 'Aetna',
      },
    ]);
    expect(comparison.mismatch).toBe(false);
  });

  it('flags a disagreement and says exactly what it is', () => {
    const comparison = comparePayerReported(positions, [
      {
        coverageId: '2',
        reportedSelfOrder: 1,
        reportedDate: '2026-02-01',
        source: 'ELIGIBILITY_271',
        reportingCarrierName: 'Cigna',
      },
    ]);
    expect(comparison.mismatch).toBe(true);
    expect(comparison.detail[0]).toMatchObject({
      coverageId: '2',
      ourPosition: 2,
      payerReportedPosition: 1,
    });
    expect(comparison.explanation).toContain('Cigna');
    expect(comparison.explanation).toContain('primary');
    expect(comparison.explanation).toContain('secondary');
  });

  it('uses the most recent report from a payer that changed its mind', () => {
    const comparison = comparePayerReported(positions, [
      {
        coverageId: '1',
        reportedSelfOrder: 2,
        reportedDate: '2025-01-01',
        source: 'PHONE',
        reportingCarrierName: 'Aetna',
      },
      {
        coverageId: '1',
        reportedSelfOrder: 1,
        reportedDate: '2026-02-01',
        source: 'PHONE',
        reportingCarrierName: 'Aetna',
      },
    ]);
    expect(comparison.mismatch).toBe(false);
  });

  it('flags a payer reporting coverage we do not rank at all', () => {
    const comparison = comparePayerReported(positions, [
      {
        coverageId: '99',
        reportedSelfOrder: 1,
        reportedDate: '2026-02-01',
        source: 'PORTAL',
        reportingCarrierName: 'Unknown Payer',
      },
    ]);
    expect(comparison.mismatch).toBe(true);
    expect(comparison.explanation).toContain('not in the order at all');
  });

  it('never changes the order — only reports the disagreement', () => {
    const before = [...positions];
    comparePayerReported(positions, [
      {
        coverageId: '2',
        reportedSelfOrder: 1,
        reportedDate: '2026-02-01',
        source: 'PHONE',
        reportingCarrierName: 'Cigna',
      },
    ]);
    expect(positions).toEqual(before);
  });
});

describe('edge cases', () => {
  it('handles a patient with no coverage', () => {
    const result = determineOrder([], ctx());
    expect(result.status).toBe('SUGGESTED');
    expect(result.positions).toEqual([]);
  });

  it('handles a patient whose only coverage is non-medical', () => {
    const result = determineOrder([coverage('1', { benefitCategory: 'FIXED_INDEMNITY' })], ctx());
    expect(result.positions).toEqual([]);
    expect(result.excluded).toHaveLength(1);
  });

  it('falls back to a stable order and SAYS it is a fallback', () => {
    // Two identical self-policies with the same effective date. Every rule
    // runs out. The order is arbitrary, and the explanation must admit it
    // rather than cite a rule that never fired.
    const a = coverage('1', { relationship: 'SELF', effectiveDate: '2020-01-01' });
    const b = coverage('2', { relationship: 'SELF', effectiveDate: '2020-01-01' });
    const result = determineOrder([b, a], ctx());
    expect(sequence(result)).toEqual(['1', '2']);
    expect(result.positions[0].ruleCode).toBe('TIE_BREAK_STABLE');
    expect(result.positions[0].explanation).toContain('stable fallback');
    expect(result.positions[0].explanation).toContain('Confirm it with the payer');
  });
});
