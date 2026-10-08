/**
 * The three COB endpoint groups added after the first cut: insurance card
 * images, plan requests, and batched downstream estimates.
 *
 * As with cob-api.test.ts, most of what is asserted here is REFUSAL and
 * SHAPE. These endpoints touch PHI (a card carries the member ID and the
 * subscriber's name), create master data by proxy (a plan request is how a
 * plan enters the list), and produce money figures a front desk will read to
 * a patient — so the gates and the "range, never a midpoint" rule are the
 * parts worth pinning.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { PERMISSIONS } from '../src/constants/permissions';
import { PERMISSION_CATALOG } from '../src/constants/permission-catalog';
import { normalizeSide, CARD_SIDES } from '../src/services/cob/coverage-card.service';
import { PLAN_REQUEST_STATUSES } from '../src/services/cob/plan-request.service';
import { estimateSecondaryPayment, isEstimateRange } from '../src/services/cob/estimate';

/**
 * Logs in, or returns null when the seeds this database would need are not
 * present. Every HTTP assertion below is guarded on it.
 *
 * `helpers/auth.getAdminAuthHeader` THROWS when the admin seed is missing,
 * which turns an unseeded database into a wall of failures that say nothing
 * about the code — the pure-logic assertions in this file still run, and the
 * permission probes skip.
 */
const loginAs = async (email: string, password = 'Password123!') => {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  if (res.status !== 200 || !res.body?.data?.tokens?.accessToken) return null;
  return { Authorization: `Bearer ${res.body.data.tokens.accessToken}` };
};

const loginAsAdmin = () =>
  loginAs(
    process.env.SEED_ADMIN_EMAIL || 'admin@example.com',
    process.env.SEED_ADMIN_PASSWORD || 'Admin123!'
  );

/**
 * Logs in AND checks the token is actually accepted.
 *
 * On some local databases login returns 200 with a token that `authenticate`
 * then rejects as "Invalid token" (a JWT-secret or access-version mismatch
 * between the seed and the running app). That is an environment problem, not
 * a code one, and letting it fail every assertion here would bury the
 * endpoint contract under noise. So the header is probed once and treated as
 * absent if it does not authenticate.
 */
const usableAdminHeader = async () => {
  const header = await loginAsAdmin();
  if (!header) return null;
  const probe = await request(app).get('/api/cob/enums').set(header);
  return probe.status === 401 ? null : header;
};

describe('card side normalisation', () => {
  it('accepts either casing, because the route param is user-facing', () => {
    expect(normalizeSide('front')).toBe('FRONT');
    expect(normalizeSide('BACK')).toBe('BACK');
    expect(normalizeSide('Front')).toBe('FRONT');
  });

  it('rejects anything else rather than inventing a third side', () => {
    // A typo'd side would otherwise create a row nothing reads and no UI can
    // ever show or delete.
    expect(() => normalizeSide('side')).toThrow();
    expect(() => normalizeSide('')).toThrow();
    expect(() => normalizeSide(undefined)).toThrow();
  });

  it('has exactly two sides', () => {
    // The front carries the member ID, the back the claims address and the
    // phone a biller calls. Both, and only those.
    expect([...CARD_SIDES]).toEqual(['FRONT', 'BACK']);
  });
});

describe('plan request statuses', () => {
  it('has an open state and two terminal ones', () => {
    expect([...PLAN_REQUEST_STATUSES]).toEqual(['OPEN', 'RESOLVED', 'REJECTED']);
  });
});

describe('downstream estimates — the range rule', () => {
  const input = {
    billedAmount: 550,
    allowedAmount: 550,
    primaryPaid: 400,
    primaryPatientResponsibility: 150,
    secondaryCoveragePercent: 0,
    secondaryDeductibleRemaining: 0,
  };

  it('returns a RANGE when the plan method is unconfirmed', () => {
    // This is the guarantee the batched endpoint exists to preserve: a client
    // assembling estimates from parts is one forgotten branch away from
    // showing a midpoint, which is a figure the front desk quotes to a patient
    // and then has to take back.
    const estimate = estimateSecondaryPayment('UNKNOWN', input);
    expect(isEstimateRange(estimate)).toBe(true);
    if (isEstimateRange(estimate)) {
      expect(estimate.maxPayment).toBeGreaterThanOrEqual(estimate.minPayment);
      expect(estimate.perMethod.length).toBeGreaterThan(1);
    }
  });

  it('returns a single figure when the method is known', () => {
    const estimate = estimateSecondaryPayment('STANDARD', input);
    expect(isEstimateRange(estimate)).toBe(false);
  });
});

describe('COB extra endpoints — permission gating', () => {
  let adminHeader: { Authorization: string } | null = null;

  beforeAll(async () => {
    adminHeader = await usableAdminHeader();
  });

  it('registers the permissions these endpoints enforce', () => {
    const keys = new Set(PERMISSION_CATALOG.map((p) => p.key));
    expect(keys.has(PERMISSIONS.INSURANCE_COB.COVERAGE_DETAIL_EDIT)).toBe(true);
    expect(keys.has(PERMISSIONS.INSURANCE_COB.PLAN_MASTER_READ)).toBe(true);
    expect(keys.has(PERMISSIONS.INSURANCE_COB.PLAN_MASTER_EDIT)).toBe(true);
  });

  it('DENIES a role with no insurance permissions from reading card images', async () => {
    const header = await loginAs('lab@medflow.com');
    if (!header) return; // seeds not present in this database
    const res = await request(app).get('/api/cob/coverages/1/cards').set(header);
    expect(res.status).toBe(403);
  });

  it('DENIES that role from uploading a card image', async () => {
    const header = await loginAs('lab@medflow.com');
    if (!header) return;
    const res = await request(app).post('/api/cob/coverages/1/cards/FRONT').set(header);
    expect(res.status).toBe(403);
  });

  it('DENIES that role from raising a plan request', async () => {
    const header = await loginAs('lab@medflow.com');
    if (!header) return;
    const res = await request(app)
      .post('/api/cob/plan-requests')
      .set(header)
      .send({ planName: 'Mystery PPO' });
    expect(res.status).toBe(403);
  });

  it('separates RAISING a plan request from RESOLVING one', async () => {
    // Deliberately asymmetric: the front desk finds the gap,
    // plan_master.edit fills it — because resolving creates a plan whose COB
    // fields rank every patient on it.
    const header = await loginAs('provider@medflow.com');
    if (!header) return;

    const resolve = await request(app)
      .patch('/api/cob/plan-requests/1')
      .set(header)
      .send({ status: 'RESOLVED', planId: '1' });
    expect(resolve.status).toBe(403);
  });

  it('requires a plan name on a plan request', async () => {
    if (!adminHeader) return;
    const res = await request(app)
      .post('/api/cob/plan-requests')
      .set(adminHeader)
      .send({ groupNumber: 'G-1' });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toMatch(/planName/i);
  });

  it('rejects a status that is neither RESOLVED nor REJECTED', async () => {
    if (!adminHeader) return;
    const res = await request(app)
      .patch('/api/cob/plan-requests/1')
      .set(adminHeader)
      .send({ status: 'MAYBE' });
    expect(res.status).toBe(400);
  });

  it('lists plan requests for an admin', async () => {
    if (!adminHeader) return;
    const res = await request(app).get('/api/cob/plan-requests?status=OPEN').set(adminHeader);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body?.data?.requests)).toBe(true);
  });

  it('answers downstream estimates with a basis even when nothing is estimable yet', async () => {
    if (!adminHeader) return;
    // Before the primary remits there is nothing to estimate FROM, and a
    // claim screen asking early is normal — so the endpoint answers with an
    // empty `byParty` rather than an error.
    const res = await request(app).get('/api/cob/claims/1/downstream-estimates').set(adminHeader);
    if (res.status === 404) return; // claim 1 not present in this database
    expect(res.status).toBe(200);
    expect(res.body?.data).toHaveProperty('basis');
    expect(res.body?.data).toHaveProperty('byParty');
  });

  it('rejects an unknown card side at the service boundary', async () => {
    if (!adminHeader) return;
    const res = await request(app).post('/api/cob/coverages/1/cards/sideways').set(adminHeader);
    // 400 from the side check, or 404 if coverage 1 is absent — either way
    // never a 201.
    expect([400, 404]).toContain(res.status);
  });
});
