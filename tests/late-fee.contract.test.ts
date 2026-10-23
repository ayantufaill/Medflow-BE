/**
 * Late-fee HTTP contract test.
 *
 * The service tests prove the engine; this proves the WIRING — that the two
 * endpoints the LateFeeDialog actually calls exist, accept the exact body the
 * frontend sends, pass through auth/branch/permission middleware, and return
 * the field names `LateFeeDialog.jsx` reads.
 *
 * That last part is the reason this file exists. A unit test would pass happily
 * while the dialog posted to a wrong URL, sent `basis` under the wrong key, or
 * read `patientBalance` from a response that returns `patient_portion` — none of
 * which a service-level test can see.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/db';
import { getAdminAuthHeader } from './helpers/auth';
import { uniqueToken } from './helpers/unique';
import { createInvoiceStatement, createPatientRecord } from './helpers/fixtures';

let authHeader: { Authorization: string };
let patNum: bigint;

const daysAgo = (days: number) => {
  const d = new Date(Date.now() - days * 86_400_000);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

/** A statement with a real balance, aged by `days`. */
const agedStatement = async (token: string, balance: number, days: number) => {
  const stmt = await createInvoiceStatement({ patientId: patNum, token });
  await prisma.statement.update({
    where: { StatementNum: stmt.StatementNum },
    data: {
      DateSent: daysAgo(days),
      BalTotal: balance,
      NoteBold: JSON.stringify({
        status: 'draft',
        patientPortion: balance,
        totalAmount: balance,
      }),
    },
  });
  return stmt;
};

describe('late fee HTTP contract', () => {
  beforeAll(async () => {
    authHeader = await getAdminAuthHeader();
    const token = uniqueToken('lfhttp');
    const patient = await createPatientRecord(token);
    patNum = patient.PatNum;
  });

  afterAll(async () => {
    await prisma.procedurelog.deleteMany({ where: { PatNum: patNum } });
    await prisma.statement.deleteMany({ where: { PatNum: patNum } });
    await prisma.$executeRawUnsafe('DELETE FROM famaging WHERE "PatNum" = $1', patNum);
    await prisma.patient.delete({ where: { PatNum: patNum } });
  });

  it('rejects an unauthenticated eligibility request', async () => {
    const res = await request(app).get(
      `/api/invoices/patient/${patNum}/late-fee-eligibility?tier=30`,
    );
    expect(res.status).toBe(401);
  });

  it('returns eligibility rows with the field names the dialog reads', async () => {
    const token = uniqueToken('lfelig');
    const stmt = await agedStatement(token, 200, 40);

    const res = await request(app)
      .get(`/api/invoices/patient/${patNum}/late-fee-eligibility?tier=30`)
      .set(authHeader);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const rows = res.body.data.invoices as any[];
    expect(res.body.data.tier).toBe(30);

    const row = rows.find((r) => r.id === stmt.StatementNum.toString());
    expect(row).toBeDefined();

    // Exactly the keys LateFeeDialog destructures and renders.
    expect(row).toMatchObject({
      id: expect.any(String),
      invoiceNumber: expect.anything(),
      daysOutstanding: 40,
      patientBalance: 200,
      totalBalance: 200,
      alreadyCharged: false,
    });
  });

  it('rejects a bogus tier rather than silently listing everything', async () => {
    const res = await request(app)
      .get(`/api/invoices/patient/${patNum}/late-fee-eligibility?tier=45`)
      .set(authHeader);
    expect(res.status).toBe(400);
  });

  it('applies the tier default from the exact body LateFeeDialog now sends', async () => {
    const token = uniqueToken('lfpost');
    const stmt = await agedStatement(token, 300, 50);

    // Mirrors handleAddLateFee in PatientFinanceInfo.jsx: no `mode`, no `rate`,
    // because the amount is fixed per tier and decided server-side.
    const res = await request(app)
      .post('/api/invoices/late-fee')
      .set(authHeader)
      .send({
        patientId: Number(patNum.toString()),
        tier: 30,
        invoiceIds: [stmt.StatementNum.toString()],
        basis: 'patient',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    expect(data.charged).toHaveLength(1);
    // The 30-day tier is a fixed $50, not 10% of anything.
    expect(data.totalFee).toBe(50);
    expect(data.invoice.id).toBeTruthy();
    expect(data.rejected).toHaveLength(0);
  });

  it('returns the four ledger columns and they reconcile to the total', async () => {
    const token = uniqueToken('lfcols');
    const stmt = await createInvoiceStatement({ patientId: patNum, token });
    await prisma.statement.update({
      where: { StatementNum: stmt.StatementNum },
      data: {
        DateSent: daysAgo(44),
        BalTotal: 300,
        InsEst: 120,
        NoteBold: JSON.stringify({
          status: 'draft',
          patientPortion: 300,
          totalAmount: 300,
          writeoffAmount: 50,
        }),
      },
    });

    const res = await request(app)
      .get(`/api/invoices/patient/${patNum}/late-fee-eligibility?tier=30`)
      .set(authHeader);
    expect(res.status).toBe(200);

    const row = (res.body.data.invoices as any[]).find(
      (r) => r.id === stmt.StatementNum.toString(),
    );
    expect(row).toBeDefined();

    // Exactly the keys the dialog renders.
    expect(row).toMatchObject({
      insuranceWriteOff: 50,
      patientBalance: 180,
      insuranceBalance: 120,
      totalBalance: 300,
    });
    // Patient + insurance must account for everything still owing.
    expect(Number((row.patientBalance + row.insuranceBalance).toFixed(2))).toBe(
      row.totalBalance,
    );
  });

  it('returns the fixed amount on eligibility for each tier', async () => {
    const expected: Record<number, number> = { 30: 50, 60: 100, 90: 150 };
    for (const [tier, rate] of Object.entries(expected)) {
      const res = await request(app)
        .get(`/api/invoices/patient/${patNum}/late-fee-eligibility?tier=${tier}`)
        .set(authHeader);
      expect(res.status).toBe(200);
      expect(res.body.data.defaultRate).toBe(rate);
    }
  });

  it('honours the total-outstanding basis differently from the patient basis', async () => {
    // One invoice where the total balance is meaningfully larger than the
    // patient portion, so the two bases cannot be confused.
    const token = uniqueToken('lfbasis');
    const stmt = await createInvoiceStatement({ patientId: patNum, token });
    await prisma.statement.update({
      where: { StatementNum: stmt.StatementNum },
      data: {
        DateSent: daysAgo(45),
        BalTotal: 800,
        NoteBold: JSON.stringify({
          status: 'draft',
          patientPortion: 80,
          totalAmount: 800,
        }),
      },
    });

    const res = await request(app)
      .post('/api/invoices/late-fee')
      .set(authHeader)
      .send({
        patientId: Number(patNum.toString()),
        tier: 30,
        invoiceIds: [stmt.StatementNum.toString()],
        mode: 'percentage',
        rate: 10,
        basis: 'total',
      });

    expect(res.status).toBe(201);
    // 10% of 800 total, which would have been 8 on the patient basis.
    expect(res.body.data.totalFee).toBe(80);
  });

  it('returns 409 when a re-charge is attempted over HTTP', async () => {
    const token = uniqueToken('lfdup');
    const stmt = await agedStatement(token, 150, 38);

    const body = {
      patientId: Number(patNum.toString()),
      tier: 30,
      invoiceIds: [stmt.StatementNum.toString()],
      mode: 'flat',
      rate: 20,
      basis: 'patient',
    };

    const first = await request(app).post('/api/invoices/late-fee').set(authHeader).send(body);
    expect(first.status).toBe(201);

    const second = await request(app).post('/api/invoices/late-fee').set(authHeader).send(body);
    expect(second.status).toBe(409);
  });

  it('returns 400 for a non-positive rate', async () => {
    const token = uniqueToken('lfrate');
    const stmt = await agedStatement(token, 100, 33);

    const res = await request(app)
      .post('/api/invoices/late-fee')
      .set(authHeader)
      .send({
        patientId: Number(patNum.toString()),
        tier: 30,
        invoiceIds: [stmt.StatementNum.toString()],
        mode: 'flat',
        rate: 0,
        basis: 'patient',
      });

    expect(res.status).toBe(400);
  });

  it('serves the un-tiered form used by flat-rate and percentage', async () => {
    // No `tier` key at all — the dialog omits it for those two menu items, and
    // that must mean "any overdue invoice" rather than a 400.
    const res = await request(app)
      .get(`/api/invoices/patient/${patNum}/late-fee-eligibility`)
      .set(authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data.tier).toBeNull();
  });

  it('reports partial rejection rather than failing the whole batch', async () => {
    const token = uniqueToken('lfpartial');
    const ok = await agedStatement(token, 120, 36);
    const alreadyCharged = await agedStatement(token, 140, 37);

    // Charge the second invoice's 30-day tier first.
    await request(app)
      .post('/api/invoices/late-fee')
      .set(authHeader)
      .send({
        patientId: Number(patNum.toString()),
        tier: 30,
        invoiceIds: [alreadyCharged.StatementNum.toString()],
        mode: 'flat',
        rate: 5,
        basis: 'patient',
      });

    // Now batch both: the first should succeed, the second be rejected.
    const res = await request(app)
      .post('/api/invoices/late-fee')
      .set(authHeader)
      .send({
        patientId: Number(patNum.toString()),
        tier: 30,
        invoiceIds: [ok.StatementNum.toString(), alreadyCharged.StatementNum.toString()],
        mode: 'flat',
        rate: 5,
        basis: 'patient',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.charged).toHaveLength(1);
    expect(res.body.data.charged[0].sourceStatement).toBe(ok.StatementNum.toString());
    expect(res.body.data.rejected).toHaveLength(1);
    expect(res.body.data.rejected[0].invoiceId).toBe(alreadyCharged.StatementNum.toString());
    expect(res.body.data.rejected[0].reason).toMatch(/already been charged/i);
  });
});