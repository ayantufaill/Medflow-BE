import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/db';
import { getAdminAuthHeader } from './helpers/auth';
import { uniqueToken } from './helpers/unique';
import { createPatientRecord, createInvoiceStatement } from './helpers/fixtures';

const addProcedure = async (patientId: bigint, statementNum: bigint, token: string) => {
  const procNum = BigInt(`${Date.now()}${Math.floor(Math.random() * 1000)}`);
  return prisma.procedurelog.create({
    data: {
      ProcNum: procNum,
      PatNum: patientId,
      ProcDate: new Date(),
      ProcFee: 150,
      UnitQty: 1,
      StatementNum: statementNum,
      ProcStatus: 1,
      OldCode: 'D0120',
      BillingNote: JSON.stringify({
        description: 'Periodic Oral Evaluation',
        insPortion: 100,
        ptPortion: 50,
      }),
    },
  });
};

describe('Claim lock', () => {
  let authHeader: { Authorization: string };

  beforeAll(async () => {
    authHeader = await getAdminAuthHeader();
  });

  it('locks and unlocks a claim', async () => {
    const token = uniqueToken('lock-basic');
    const patient = await createPatientRecord(token);
    const statement = await createInvoiceStatement({ patientId: patient.PatNum, token });
    await addProcedure(patient.PatNum, statement.StatementNum, token);

    const createRes = await request(app)
      .post(`/api/claims/from-invoice/${statement.StatementNum}`)
      .set(authHeader)
      .send({ insuranceType: 'Primary', claimAmount: 100, submittedAmount: 100 });
    expect(createRes.status).toBe(201);
    const claimId = createRes.body?.data?.claim?._id;
    expect(claimId).toBeDefined();

    const lockRes = await request(app)
      .patch(`/api/claims/${claimId}/lock`)
      .set(authHeader)
      .send({ isLocked: true });
    expect(lockRes.status).toBe(200);
    expect(lockRes.body?.data?.claim?.isLocked).toBe(true);
    expect(lockRes.body?.data?.claim?.lockedDate).toBeTruthy();

    // Persisted in the claim narrative, not just the response.
    const persisted = await prisma.claim.findUnique({ where: { ClaimNum: BigInt(claimId) } });
    expect(JSON.parse(persisted?.Narrative || '{}').isLocked).toBe(true);

    // Surfaced by the read endpoints the ledger uses.
    const getRes = await request(app).get(`/api/claims/${claimId}`).set(authHeader);
    expect(getRes.body?.data?.claim?.isLocked).toBe(true);

    const unlockRes = await request(app)
      .patch(`/api/claims/${claimId}/lock`)
      .set(authHeader)
      .send({ isLocked: false });
    expect(unlockRes.status).toBe(200);
    expect(unlockRes.body?.data?.claim?.isLocked).toBe(false);

    const afterUnlock = await prisma.claim.findUnique({ where: { ClaimNum: BigInt(claimId) } });
    expect(JSON.parse(afterUnlock?.Narrative || '{}').isLocked).toBe(false);
  });

  it('blocks building another claim on a locked invoice, but only that invoice', async () => {
    const token = uniqueToken('lock-guard');
    const patient = await createPatientRecord(token);

    const lockedInvoice = await createInvoiceStatement({ patientId: patient.PatNum, token });
    await addProcedure(patient.PatNum, lockedInvoice.StatementNum, token);
    const otherInvoice = await createInvoiceStatement({ patientId: patient.PatNum, token });
    await addProcedure(patient.PatNum, otherInvoice.StatementNum, token);

    const createRes = await request(app)
      .post(`/api/claims/from-invoice/${lockedInvoice.StatementNum}`)
      .set(authHeader)
      .send({ insuranceType: 'Primary', claimAmount: 100, submittedAmount: 100 });
    expect(createRes.status).toBe(201);
    const claimId = createRes.body?.data?.claim?._id;

    await request(app)
      .patch(`/api/claims/${claimId}/lock`)
      .set(authHeader)
      .send({ isLocked: true })
      .expect(200);

    // Same invoice: refused because of the lock.
    const blocked = await request(app)
      .post(`/api/claims/from-invoice/${lockedInvoice.StatementNum}`)
      .set(authHeader)
      .send({ insuranceType: 'Primary', claimAmount: 100, submittedAmount: 100 });
    expect(blocked.status).toBe(409);
    expect(blocked.body?.error?.message || blocked.body?.message).toMatch(/locked/i);

    // A different invoice for the same patient is untouched by the lock.
    const allowed = await request(app)
      .post(`/api/claims/from-invoice/${otherInvoice.StatementNum}`)
      .set(authHeader)
      .send({ insuranceType: 'Primary', claimAmount: 100, submittedAmount: 100 });
    expect(allowed.status).toBe(201);

    // Unlocking releases the invoice again (the generic duplicate guard then applies).
    await request(app)
      .patch(`/api/claims/${claimId}/lock`)
      .set(authHeader)
      .send({ isLocked: false })
      .expect(200);

    const afterUnlock = await request(app)
      .post(`/api/claims/from-invoice/${lockedInvoice.StatementNum}`)
      .set(authHeader)
      .send({ insuranceType: 'Primary', claimAmount: 100, submittedAmount: 100 });
    expect(afterUnlock.status).toBe(409);
    expect(afterUnlock.body?.error?.message || afterUnlock.body?.message).toMatch(/already exists/i);
  });

  it('blocks secondary claim generation while the primary is locked', async () => {
    const token = uniqueToken('lock-secondary');
    const patient = await createPatientRecord(token);
    const statement = await createInvoiceStatement({ patientId: patient.PatNum, token });
    await addProcedure(patient.PatNum, statement.StatementNum, token);

    const createRes = await request(app)
      .post(`/api/claims/from-invoice/${statement.StatementNum}`)
      .set(authHeader)
      .send({ insuranceType: 'Primary', claimAmount: 100, submittedAmount: 100 });
    expect(createRes.status).toBe(201);
    const claimId = createRes.body?.data?.claim?._id;

    await request(app)
      .patch(`/api/claims/${claimId}/lock`)
      .set(authHeader)
      .send({ isLocked: true })
      .expect(200);

    const secondary = await request(app)
      .post(`/api/claims/${claimId}/generate-secondary`)
      .set(authHeader)
      .send({});
    // No secondary plan on this patient, so the lock guard fires before plan resolution.
    expect(secondary.status).toBe(409);
    expect(secondary.body?.error?.message || secondary.body?.message).toMatch(/locked/i);
  });

  it('refuses to lock a paid claim and refuses to lock a voided claim', async () => {
    const token = uniqueToken('lock-guardrails');
    const patient = await createPatientRecord(token);
    const statement = await createInvoiceStatement({ patientId: patient.PatNum, token });
    await addProcedure(patient.PatNum, statement.StatementNum, token);

    const createRes = await request(app)
      .post(`/api/claims/from-invoice/${statement.StatementNum}`)
      .set(authHeader)
      .send({ insuranceType: 'Primary', claimAmount: 100, submittedAmount: 100 });
    const claimId = createRes.body?.data?.claim?._id;

    // Paid claims cannot be locked.
    await prisma.claim.update({
      where: { ClaimNum: BigInt(claimId) },
      data: { InsPayAmt: 100 },
    });
    const paidLock = await request(app)
      .patch(`/api/claims/${claimId}/lock`)
      .set(authHeader)
      .send({ isLocked: true });
    expect(paidLock.status).toBe(400);
    expect(paidLock.body?.error?.message || paidLock.body?.message).toMatch(/paid/i);

    // Voided claims cannot be locked.
    await prisma.claim.update({
      where: { ClaimNum: BigInt(claimId) },
      data: { InsPayAmt: 0 },
    });
    await request(app).post(`/api/claims/${claimId}/void`).set(authHeader).send({}).expect(200);
    const voidedLock = await request(app)
      .patch(`/api/claims/${claimId}/lock`)
      .set(authHeader)
      .send({ isLocked: true });
    expect(voidedLock.status).toBe(400);
    expect(voidedLock.body?.error?.message || voidedLock.body?.message).toMatch(/voided/i);
  });
});
