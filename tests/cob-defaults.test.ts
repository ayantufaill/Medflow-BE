/**
 * Drift guards for the COB values that exist in more than one place.
 *
 * None of these test behaviour. They test that a number or a letter written
 * in two files still agrees — the failure mode where a Prisma column default
 * is changed, the service keeps showing the old one, and an unfilled plan is
 * described differently by the rule engine and the plan screen.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  COB_PLAN_PROFILE_DEFAULTS,
  COB_PAYER_TYPE_DEFAULT,
  COB_ENUMS,
} from '../src/services/cob/facts';
import { MSP_THRESHOLDS, COB_RULES } from '../src/services/cob/rules';
import {
  CLAIM_STATUS_CODE,
  ADJUDICATED_CLAIM_STATUS_CODES,
  CLOSED_CLAIM_STATUS_CODES,
  isAdjudicated,
} from '../src/constants/claim-status';
import {
  ORDER_STATUSES,
  REVIEW_FLAGS,
  BLOCKING_REVIEW_FLAGS,
  BLOCKING_ORDER_STATUSES,
  ELIGIBILITY_SOURCES,
  RESPONSIBLE_PARTIES,
} from '../src/services/cob/types';
import { mapRelationshipToDb } from '../src/utils/opendental-mappers.util';
import { loadCoverageFacts } from '../src/services/cob/facts';

const schema = fs.readFileSync(
  path.join(__dirname, '../prisma/schema.prisma'),
  'utf8'
);

/** The `model cob_plan_profile { ... }` block, for default extraction. */
const planProfileBlock = (() => {
  const start = schema.indexOf('model cob_plan_profile {');
  return schema.slice(start, schema.indexOf('\n}', start));
})();

const defaultFor = (block: string, column: string): string | null => {
  const line = block.split('\n').find((l) => l.trim().startsWith(`${column} `));
  if (!line) return null;
  const match = /@default\(([^)]*)\)/.exec(line);
  return match ? match[1].replace(/"/g, '') : null;
};

describe('cob_plan_profile defaults match the schema', () => {
  // If these diverge, a plan nobody has filled in is described one way by the
  // rule engine (which reads the code defaults) and another by the database
  // (which writes the column defaults on the first insert).
  it('benefit_category', () => {
    expect(defaultFor(planProfileBlock, 'benefit_category')).toBe(
      COB_PLAN_PROFILE_DEFAULTS.benefitCategory
    );
  });

  it('coordinates_benefits', () => {
    expect(defaultFor(planProfileBlock, 'coordinates_benefits')).toBe(
      String(COB_PLAN_PROFILE_DEFAULTS.coordinatesBenefits)
    );
  });

  it('cob_payment_method', () => {
    expect(defaultFor(planProfileBlock, 'cob_payment_method')).toBe(
      COB_PLAN_PROFILE_DEFAULTS.cobPaymentMethod
    );
  });

  it('cob_info_source', () => {
    expect(defaultFor(planProfileBlock, 'cob_info_source')).toBe(
      COB_PLAN_PROFILE_DEFAULTS.cobInfoSource
    );
  });

  it('cob_payer_profile.payer_type', () => {
    const start = schema.indexOf('model cob_payer_profile {');
    const block = schema.slice(start, schema.indexOf('\n}', start));
    expect(defaultFor(block, 'payer_type')).toBe(COB_PAYER_TYPE_DEFAULT);
  });

  it('every default is a value the enums actually allow', () => {
    expect(COB_ENUMS.benefitCategory).toContain(COB_PLAN_PROFILE_DEFAULTS.benefitCategory);
    expect(COB_ENUMS.cobPaymentMethod).toContain(COB_PLAN_PROFILE_DEFAULTS.cobPaymentMethod);
    expect(COB_ENUMS.cobInfoSource).toContain(COB_PLAN_PROFILE_DEFAULTS.cobInfoSource);
    expect(COB_ENUMS.payerType).toContain(COB_PAYER_TYPE_DEFAULT);
  });
});

describe('statutory thresholds', () => {
  it('are the CMS numbers', () => {
    // Changing any of these changes who gets billed first, by law. They are
    // here as a tripwire, not as configuration.
    expect(MSP_THRESHOLDS.esrdCoordinationMonths).toBe(30);
    expect(MSP_THRESHOLDS.workingAgedGroupPrimaryBands).toEqual(['20_TO_99', '100_PLUS']);
    expect(MSP_THRESHOLDS.disabilityGroupPrimaryBands).toEqual(['100_PLUS']);
  });

  it('reference only employer size bands the enum defines', () => {
    for (const band of [
      ...MSP_THRESHOLDS.workingAgedGroupPrimaryBands,
      ...MSP_THRESHOLDS.disabilityGroupPrimaryBands,
    ]) {
      expect(COB_ENUMS.employerSizeBand).toContain(band);
    }
  });

  it('leave UNDER_20 out of both, so the smallest band never makes a group primary', () => {
    expect(MSP_THRESHOLDS.workingAgedGroupPrimaryBands).not.toContain('UNDER_20');
    expect(MSP_THRESHOLDS.disabilityGroupPrimaryBands).not.toContain('UNDER_20');
  });
});

describe('claim status codes', () => {
  it('are single characters', () => {
    for (const code of Object.values(CLAIM_STATUS_CODE)) {
      expect(code).toHaveLength(1);
    }
  });

  it('are distinct', () => {
    const codes = Object.values(CLAIM_STATUS_CODE);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('treat a denial as adjudicated', () => {
    // A denial IS a remittance. The secondary-claim gate depends on this.
    expect(isAdjudicated(CLAIM_STATUS_CODE.DENIED)).toBe(true);
    expect(isAdjudicated(CLAIM_STATUS_CODE.RECEIVED)).toBe(true);
    expect(isAdjudicated(CLAIM_STATUS_CODE.PARTIAL)).toBe(true);
  });

  it('do NOT treat a sent or pending claim as adjudicated', () => {
    expect(isAdjudicated(CLAIM_STATUS_CODE.SENT)).toBe(false);
    expect(isAdjudicated(CLAIM_STATUS_CODE.PENDING)).toBe(false);
    expect(isAdjudicated(CLAIM_STATUS_CODE.READY)).toBe(false);
    expect(isAdjudicated(null)).toBe(false);
    expect(isAdjudicated(undefined)).toBe(false);
  });

  it('keep denied and rejected OUT of the closed set, because they need rework', () => {
    expect(CLOSED_CLAIM_STATUS_CODES).not.toContain(CLAIM_STATUS_CODE.DENIED);
    expect(CLOSED_CLAIM_STATUS_CODES).not.toContain(CLAIM_STATUS_CODE.REJECTED);
    expect(CLOSED_CLAIM_STATUS_CODES).toContain(CLAIM_STATUS_CODE.CANCELLED);
  });

  it('match the letters claim.service actually writes', () => {
    // claimStatusToCode is module-private, so this reads the source. Crude,
    // but it is the only thing standing between the shared vocabulary and the
    // function that produces the values it describes.
    const source = fs.readFileSync(
      path.join(__dirname, '../src/services/claim.service.ts'),
      'utf8'
    );
    const mapper = source.slice(
      source.indexOf('const claimStatusToCode'),
      source.indexOf('const claimCodeToStatus')
    );
    // Every return in the mapper must go through the shared constant rather
    // than a bare letter.
    const bareLetterReturns = mapper.match(/return '[A-Z]';/g) || [];
    expect(bareLetterReturns).toEqual([]);
    expect(mapper).toContain('CLAIM_STATUS_CODE.RECEIVED');
    expect(mapper).toContain('CLAIM_STATUS_CODE.DENIED');
  });
});

describe('COB vocabularies', () => {
  it('derive the blocking lists from the full lists', () => {
    for (const flag of BLOCKING_REVIEW_FLAGS) {
      expect(REVIEW_FLAGS).toContain(flag);
    }
    for (const status of BLOCKING_ORDER_STATUSES) {
      expect(ORDER_STATUSES).toContain(status);
    }
  });

  it('do not block on NEITHER_PLAN_COORDINATES or COVERAGE_CHANGED', () => {
    // Both are informational. Neither plan coordinating is a real billing
    // situation, not an error, and a coverage change on an override is a
    // "look again" rather than a stop.
    expect(BLOCKING_REVIEW_FLAGS).not.toContain('NEITHER_PLAN_COORDINATES');
    expect(BLOCKING_REVIEW_FLAGS).not.toContain('COVERAGE_CHANGED');
  });

  it('have no duplicates', () => {
    for (const list of [
      ORDER_STATUSES,
      REVIEW_FLAGS,
      ELIGIBILITY_SOURCES,
      RESPONSIBLE_PARTIES,
      ...Object.values(COB_ENUMS),
    ]) {
      expect(new Set(list as readonly string[]).size).toBe((list as readonly string[]).length);
    }
  });

  it('give every rule a unique code and a real description', () => {
    const codes = COB_RULES.map((r) => r.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const rule of COB_RULES) {
      expect(rule.description.length).toBeGreaterThan(10);
    }
  });
});

describe('OpenDental relationship encoding', () => {
  it('matches the codes mapRelationshipToDb writes', () => {
    // loadCoverageFacts reads patplan.Relationship back into
    // SELF/SPOUSE/PARENT/OTHER. The numbers are Open Dental's, and
    // mapRelationshipToDb is what writes them — if that mapping changes, the
    // birthday and custody rules start firing on the wrong coverages.
    expect(mapRelationshipToDb('self')).toBe(0);
    expect(mapRelationshipToDb('spouse')).toBe(1);
    expect(mapRelationshipToDb('child')).toBe(2);
    expect(mapRelationshipToDb('parent')).toBe(3);
  });

  it('reads code 2 (patient is the child) as subscriber = PARENT', () => {
    // The direction that matters: the facts loader reports who the SUBSCRIBER
    // is to the patient, so "child" on the patplan means the subscriber is
    // the patient's parent. Getting this backwards would stop the birthday
    // rule from ever applying.
    const source = fs.readFileSync(
      path.join(__dirname, '../src/services/cob/facts.ts'),
      'utf8'
    );
    const fn = source.slice(
      source.indexOf('const relationshipFromDb'),
      source.indexOf('const asEnum')
    );
    expect(fn).toMatch(/case 2:\s*\n\s*return 'PARENT';/);
  });

  it('exposes loadCoverageFacts for the pipeline', () => {
    expect(typeof loadCoverageFacts).toBe('function');
  });
});
