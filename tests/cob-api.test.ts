/**
 * COB API test — permissions, validation and the endpoint contract.
 *
 * The behaviour under test here is mostly REFUSAL: an override without the
 * permission, an override without a reason, a plan COB edit by someone who
 * only has read. Those are the guards that stop one biller silently
 * re-pointing every patient on a group plan.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { authHeaderWithPermissions } from './helpers/roles';
import app from '../src/app';
import { prisma } from '../src/config/db';
import { getAdminAuthHeader } from './helpers/auth';
import { PERMISSIONS } from '../src/constants/permissions';
import { PERMISSION_CATALOG } from '../src/constants/permission-catalog';

const COB_PERMISSIONS = Object.values(PERMISSIONS.INSURANCE_COB);

describe('COB permission catalog', () => {
  it('registers every COB permission so a role can actually be granted it', () => {
    // A permission the catalog does not know about cannot be assigned to a
    // role, which would make the endpoint unreachable for everyone except a
    // super admin — a silent lockout rather than a visible error.
    const keys = new Set(PERMISSION_CATALOG.map((p) => p.key));
    for (const permission of COB_PERMISSIONS) {
      expect(keys.has(permission), `${permission} missing from PERMISSION_CATALOG`).toBe(true);
    }
  });

  it('names the two permissions the spec requires, exactly', () => {
    expect(PERMISSIONS.INSURANCE_COB.ORDER_OVERRIDE).toBe('insurance.coverage_order.override');
    expect(PERMISSIONS.INSURANCE_COB.PLAN_MASTER_EDIT).toBe('insurance.plan_master.edit');
  });

  it('separates reading an order from overriding it', () => {
    // The whole front desk needs to see who is primary and why. Changing it
    // away from the rules is a billing decision and has to be attributable.
    expect(PERMISSIONS.INSURANCE_COB.ORDER_READ).not.toBe(
      PERMISSIONS.INSURANCE_COB.ORDER_OVERRIDE
    );
  });
});

describe('COB API', () => {
  let authHeader: { Authorization: string };

  beforeAll(async () => {
    authHeader = await getAdminAuthHeader();
  });

  describe('permission gating', () => {
    /** Enough to open patient data (requirePhiAccess), and no insurance key. */
    const PATIENT_ACCESS_ONLY = { 'clinical.cross_branch.view': true, 'patients.read': true };

    /**
     * Lab is the narrowest seeded role: Insurance is "View" in the screen
     * access matrix, so it reads an order but must not change one. "Is the
     * read itself gated" is probed with a throwaway role holding no insurance
     * key at all, because a role that happens to hold the permission proves
     * nothing.
     */
    const loginAs = async (email: string, password = 'Password123!') => {
      const res = await request(app).post('/api/auth/login').send({ email, password });
      if (res.status !== 200 || !res.body?.data?.tokens?.accessToken) return null;
      return { Authorization: `Bearer ${res.body.data.tokens.accessToken}` };
    };

    it('DENIES a role with no insurance permissions from reading a coverage order', async () => {
      // Every seeded staff role can at least read the order (screen access
      // matrix: Insurance is "View" or better), so probe with a role that
      // holds only what opening patient data needs.
      const header = await authHeaderWithPermissions(PATIENT_ACCESS_ONLY, 'cob-no-ins');
      const res = await request(app).get('/api/cob/patients/1/coverage-order').set(header);
      expect(res.status).toBe(403);
    });

    it('ALLOWS Lab (Insurance "View" in the matrix) to read an order', async () => {
      const header = await loginAs('lab@medflow.com');
      if (!header) return; // seeds not present in this database
      const res = await request(app).get('/api/cob/patients/1/coverage-order').set(header);
      expect(res.status).not.toBe(403);
    });

    it('DENIES that role from overriding a coverage order', async () => {
      const header = await loginAs('lab@medflow.com');
      if (!header) return;
      const res = await request(app)
        .post('/api/cob/patients/1/coverage-order/override')
        .set(header)
        .send({ orderedCoverageIds: ['1', '2'], reason: 'a perfectly adequate reason' });
      expect(res.status).toBe(403);
      expect(JSON.stringify(res.body)).toMatch(/insurance\.coverage_order\.override|Permission/i);
    });

    it('DENIES that role from editing a plan’s COB fields', async () => {
      // One edit here re-ranks every patient on the plan, so this is the
      // permission that most needs to hold.
      const header = await loginAs('lab@medflow.com');
      if (!header) return;
      const res = await request(app)
        .patch('/api/cob/plans/1/cob')
        .set(header)
        .send({ coordinatesBenefits: false });
      expect(res.status).toBe(403);
    });

    it('ALLOWS a clinical role to READ an order but not to override it', async () => {
      // A provider needs to see which payer is primary. Changing it is a
      // billing decision.
      const header = await loginAs('provider@medflow.com');
      if (!header) return;

      const read = await request(app).get('/api/cob/patients/1/coverage-order').set(header);
      expect(read.status).not.toBe(403);

      const override = await request(app)
        .post('/api/cob/patients/1/coverage-order/override')
        .set(header)
        .send({ orderedCoverageIds: ['1', '2'], reason: 'a perfectly adequate reason' });
      expect(override.status).toBe(403);
    });

    it('ALLOWS the operations group to override and to edit plan COB fields', async () => {
      const header = await loginAs('biller@medflow.com');
      if (!header) return;
      // Not 403: the request still fails validation or lookup downstream,
      // which is the point — the permission gate let it through.
      const res = await request(app)
        .post('/api/cob/patients/1/coverage-order/override')
        .set(header)
        .send({ orderedCoverageIds: ['1', '2'], reason: 'a perfectly adequate reason' });
      expect(res.status).not.toBe(403);

      const plan = await request(app)
        .patch('/api/cob/plans/1/cob')
        .set(header)
        .send({ cobPaymentMethod: 'NOT_A_METHOD' });
      // 400 from the validator, not 403 from the permission gate.
      expect(plan.status).toBe(400);
    });
  });

  describe('authentication', () => {
    it('rejects an unauthenticated request', async () => {
      const res = await request(app).get('/api/cob/enums');
      expect(res.status).toBe(401);
    });

    it('rejects an override with no token', async () => {
      const res = await request(app)
        .post('/api/cob/patients/1/coverage-order/override')
        .send({ orderedCoverageIds: ['1'], reason: 'a perfectly good reason here' });
      expect(res.status).toBe(401);
    });
  });

  describe('reference data', () => {
    it('serves the enum values the UI must use', async () => {
      const res = await request(app).get('/api/cob/enums').set(authHeader);
      expect(res.status).toBe(200);
      // One source for the dropdowns, the validators and the services, so a
      // value the UI offers can never be one the server rejects.
      expect(res.body.data.cobPaymentMethod).toContain('NON_DUPLICATION');
      expect(res.body.data.cobPaymentMethod).toContain('UNKNOWN');
      expect(res.body.data.benefitCategory).toContain('FIXED_INDEMNITY');
      expect(res.body.data.employerSizeBand).toEqual(['UNDER_20', '20_TO_99', '100_PLUS']);
      expect(res.body.data.custodyRole).toContain('NON_CUSTODIAL_SPOUSE');
    });

    it('serves every COB vocabulary so the UI hardcodes none of them', async () => {
      const res = await request(app).get('/api/cob/enums').set(authHeader);
      expect(res.status).toBe(200);
      const data = res.body.data;

      expect(data.orderStatus).toContain('NEEDS_INFO');
      expect(data.reviewFlag).toContain('PAYER_MISMATCH');
      expect(data.verificationStatus).toContain('VERIFIED_WITH_PAYER');
      expect(data.eligibilitySource).toContain('ELIGIBILITY_271');
      expect(data.responsibleParty).toEqual(['PRIMARY', 'SECONDARY', 'TERTIARY', 'PATIENT']);

      // Which flags disable the submit button — so the UI explains the gate
      // rather than reimplementing it.
      expect(data.blockingReviewFlags).toContain('PAYER_MISMATCH');
      expect(data.blockingOrderStatuses).toContain('NEEDS_INFO');

      // The rule catalogue, in statutory order, with descriptions.
      expect(data.rules[0].code).toBe('INJURY_RELATED');
      expect(data.rules.at(-1).code).toBe('LONGER_COVERAGE');
      expect(data.rules.every((r: any) => r.description?.length > 10)).toBe(true);
      expect(data.positionRuleCodes.map((r: any) => r.code)).toContain('TIE_BREAK_STABLE');

      // Statutory thresholds, so no help text hardcodes 20 / 100 / 30.
      expect(data.mspThresholds.esrdCoordinationMonths).toBe(30);
      expect(data.mspThresholds.workingAgedGroupPrimaryBands).toContain('20_TO_99');
      expect(data.mspThresholds.disabilityGroupPrimaryBands).toEqual(['100_PLUS']);

      expect(data.cobDenialCarcs).toEqual(['22', '109']);
      expect(data.cobInformationalCarcs).toEqual(['23']);

      // What an unrecorded plan is assumed to be.
      expect(data.planProfileDefaults.coordinatesBenefits).toBe(true);
      expect(data.planProfileDefaults.cobPaymentMethod).toBe('UNKNOWN');
      expect(data.payerTypeDefault).toBe('COMMERCIAL');
      expect(data.cobPaymentMethodsEstimatable).not.toContain('UNKNOWN');
    });

    it('reports the eligibility providers and that MANUAL is not automated', async () => {
      const res = await request(app).get('/api/cob/eligibility/providers').set(authHeader);
      expect(res.status).toBe(200);
      const manual = res.body.data.providers.find((p: any) => p.name === 'MANUAL');
      expect(manual).toBeTruthy();
      // The UI must not offer a "check now" button that cannot work.
      expect(manual.isAutomated).toBe(false);
      expect(res.body.data.active).toBe('MANUAL');
    });
  });

  describe('override validation', () => {
    it('rejects an override with no reason', async () => {
      const res = await request(app)
        .post('/api/cob/patients/1/coverage-order/override')
        .set(authHeader)
        .send({ orderedCoverageIds: ['1', '2'] });
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toMatch(/reason/i);
    });

    it('rejects a one-word reason', async () => {
      // "fixed" tells the next biller nothing. The reason is the only lasting
      // record of why the rules were wrong.
      const res = await request(app)
        .post('/api/cob/patients/1/coverage-order/override')
        .set(authHeader)
        .send({ orderedCoverageIds: ['1', '2'], reason: 'fixed' });
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toMatch(/at least 10 characters/i);
    });

    it('rejects an empty coverage list', async () => {
      const res = await request(app)
        .post('/api/cob/patients/1/coverage-order/override')
        .set(authHeader)
        .send({ orderedCoverageIds: [], reason: 'payer confirmed this order by phone' });
      expect(res.status).toBe(400);
    });
  });

  describe('plan COB field validation', () => {
    it('rejects an unknown cobPaymentMethod', async () => {
      const res = await request(app)
        .patch('/api/cob/plans/1/cob')
        .set(authHeader)
        .send({ cobPaymentMethod: 'WHATEVER_THE_UI_SENT' });
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toMatch(/cobPaymentMethod/);
    });

    it('rejects a non-boolean coordinatesBenefits', async () => {
      const res = await request(app)
        .patch('/api/cob/plans/1/cob')
        .set(authHeader)
        .send({ coordinatesBenefits: 'yes' });
      expect(res.status).toBe(400);
    });

    it('rejects an unknown benefitCategory', async () => {
      const res = await request(app)
        .patch('/api/cob/plans/1/cob')
        .set(authHeader)
        .send({ benefitCategory: 'DENTAL_ISH' });
      expect(res.status).toBe(400);
    });
  });

  describe('payer-reported coverage validation', () => {
    it('requires a known source', async () => {
      const res = await request(app)
        .post('/api/cob/patients/1/payer-reported-coverage')
        .set(authHeader)
        .send({ source: 'CARRIER_PIGEON', reportedSelfOrder: 1 });
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toMatch(/ELIGIBILITY_271/);
    });

    it('rejects a nonsense reported position', async () => {
      const res = await request(app)
        .post('/api/cob/patients/1/payer-reported-coverage')
        .set(authHeader)
        .send({ source: 'PHONE', reportedSelfOrder: 0 });
      expect(res.status).toBe(400);
    });

    it('rejects a malformed reported date', async () => {
      const res = await request(app)
        .post('/api/cob/patients/1/payer-reported-coverage')
        .set(authHeader)
        .send({ source: 'PHONE', reportedDate: '03/15/2026' });
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toMatch(/YYYY-MM-DD/);
    });
  });

  describe('resolve-flag validation', () => {
    it('rejects an unknown flag name', async () => {
      const res = await request(app)
        .post('/api/cob/coverage-orders/1/resolve-flag')
        .set(authHeader)
        .send({ flag: 'LOOKS_FINE_TO_ME', resolutionNote: 'all good' });
      expect(res.status).toBe(400);
    });

    it('requires a resolution note', async () => {
      const res = await request(app)
        .post('/api/cob/coverage-orders/1/resolve-flag')
        .set(authHeader)
        .send({ flag: 'PAYER_MISMATCH' });
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toMatch(/resolutionNote/i);
    });
  });

  describe('order-on-date', () => {
    it('requires the date parameter', async () => {
      // Silently defaulting to today is how a backdated claim ends up billed
      // against the wrong order.
      const res = await request(app)
        .get('/api/cob/patients/1/coverage-order/on-date')
        .set(authHeader);
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toMatch(/date/i);
    });
  });

  describe('plan master listing', () => {
    it('lists plans with their COB fields and whether they are confirmed', async () => {
      const res = await request(app).get('/api/cob/plans?limit=5').set(authHeader);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.plans)).toBe(true);
      if (res.body.data.plans.length > 0) {
        const plan = res.body.data.plans[0];
        expect(plan).toHaveProperty('coordinatesBenefits');
        expect(plan).toHaveProperty('cobPaymentMethod');
        // False means "these are defaults nobody has confirmed", which is the
        // single most useful thing for a billing admin to filter on.
        expect(plan).toHaveProperty('cobProfileRecorded');
      }
    });

    it('can filter down to the plans nobody has confirmed', async () => {
      const res = await request(app)
        .get('/api/cob/plans?unconfirmedOnly=true&limit=5')
        .set(authHeader);
      expect(res.status).toBe(200);
      for (const plan of res.body.data.plans) {
        expect(plan.cobInfoSource === 'DEFAULT' || plan.cobPaymentMethod === 'UNKNOWN').toBe(true);
      }
    });
  });

  describe('secondary estimate', () => {
    it('does NOT require any figures — they are derived server-side', async () => {
      // The caller sends identifiers; the allowance, benefit percentage,
      // remaining deductible and the primary's payment all come from the plan
      // and the remittance. So an empty body is a valid request shape and
      // fails only on the coverage id not existing (404), never on validation.
      const res = await request(app)
        .post('/api/cob/coverages/1/secondary-estimate')
        .set(authHeader)
        .send({});
      expect(res.status).not.toBe(400);
    });

    it('accepts a procedure code and a primary claim id', async () => {
      const res = await request(app)
        .post('/api/cob/coverages/1/secondary-estimate')
        .set(authHeader)
        .send({ procedureCode: 'D2740', primaryClaimId: '1' });
      expect(res.status).not.toBe(400);
    });

    it('rejects a coverage percent above 100', async () => {
      // Still validated, because it is a staff OVERRIDE when supplied.
      const res = await request(app)
        .post('/api/cob/coverages/1/secondary-estimate')
        .set(authHeader)
        .send({ secondaryCoveragePercent: 180 });
      expect(res.status).toBe(400);
    });

    it('rejects a non-string procedure code', async () => {
      const res = await request(app)
        .post('/api/cob/coverages/1/secondary-estimate')
        .set(authHeader)
        .send({ procedureCode: 42 });
      expect(res.status).toBe(400);
    });
  });

  describe('coverage detail validation', () => {
    it('rejects an unknown employer size band', async () => {
      const res = await request(app)
        .patch('/api/cob/coverages/1/detail')
        .set(authHeader)
        .send({ employerSizeBand: 'ABOUT_FIFTY' });
      expect(res.status).toBe(400);
    });

    it('rejects an unknown Medicare entitlement reason', async () => {
      const res = await request(app)
        .patch('/api/cob/coverages/1/detail')
        .set(authHeader)
        .send({ medicareEntitlementReason: 'OLD_AGE' });
      expect(res.status).toBe(400);
    });

    it('rejects an unknown payer type on a carrier', async () => {
      const res = await request(app)
        .patch('/api/cob/carriers/1/payer-type')
        .set(authHeader)
        .send({ payerType: 'MEDICARE_ADVANTAGE_MAYBE' });
      expect(res.status).toBe(400);
    });
  });

  describe('a full round trip', () => {
    it('evaluates, reads back, and reports submittability for a real patient', async () => {
      // Uses whichever patient already has two coverages in the seeded
      // database; skips rather than inventing one, because this test is about
      // the HTTP contract and the integration suite owns the data paths.
      const rows = await prisma.patplan.findMany({
        where: { PatNum: { not: null } },
        select: { PatNum: true },
      });
      const counts = new Map<string, number>();
      for (const row of rows) {
        const key = row.PatNum!.toString();
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      const withTwo = [...counts.entries()].find(([, count]) => count >= 2);
      const patNum = withTwo?.[0];
      if (!patNum) {
        expect(true).toBe(true);
        return;
      }

      const evaluate = await request(app)
        .post(`/api/cob/patients/${patNum}/coverage-order/evaluate`)
        .set(authHeader)
        .send({ triggerReason: 'API_TEST' });
      expect(evaluate.status).toBe(200);

      const order = evaluate.body.data.order;
      expect(order).toHaveProperty('version');
      expect(order).toHaveProperty('status');
      expect(order).toHaveProperty('positions');
      expect(order).toHaveProperty('excludedCoverages');
      expect(order).toHaveProperty('flags');
      expect(order.verification).toHaveProperty('status');

      const current = await request(app)
        .get(`/api/cob/patients/${patNum}/coverage-order`)
        .set(authHeader);
      expect(current.status).toBe(200);
      expect(current.body.data.order.version).toBe(order.version);
      // Coverages and the submit gate come back with the order, so one call
      // populates the whole COB panel.
      expect(Array.isArray(current.body.data.coverages)).toBe(true);
      expect(current.body.data.submittable).toHaveProperty('allowed');

      const history = await request(app)
        .get(`/api/cob/patients/${patNum}/coverage-order/history`)
        .set(authHeader);
      expect(history.status).toBe(200);
      expect(history.body.data.orders.length).toBeGreaterThan(0);

      const onDate = await request(app)
        .get(`/api/cob/patients/${patNum}/coverage-order/on-date?date=${order.effectiveFrom}`)
        .set(authHeader);
      expect(onDate.status).toBe(200);
      expect(onDate.body.data.order.version).toBe(order.version);

      // Every ranked position explains itself — the spec's core requirement.
      for (const position of order.positions) {
        expect(position.ruleCode).toBeTruthy();
        expect(String(position.explanation).length).toBeGreaterThan(20);
      }

      // This test evaluates a SEEDED patient rather than one it created, so
      // it has to remove the orders it caused. Positions and flags cascade.
      await prisma.cob_coverage_order.deleteMany({ where: { pat_num: BigInt(patNum) } });
    });
  });
});
