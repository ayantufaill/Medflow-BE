import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/db';
import { getAdminAuthHeader } from './helpers/auth';
import { uniqueToken } from './helpers/unique';
import { createPatientRecord, createInvoiceStatement, deletePatientRecord } from './helpers/fixtures';
import { getNextId } from '../src/utils/opendental-ids.util';

// Scenario (the one this feature was built for):
//   charge/allowed 950, 50/50 split -> primary portion 475, secondary portion 475.
//   Primary underpays ($400). With a secondary claim still to be filed, the $75
//   shortfall is DEFERRED (stays on the insurance side) instead of moving to the
//   patient. The secondary then pays its $475; the deferred $75 is released to
//   the patient because the secondary did not cover it.
describe('Primary underpayment deferred to a pending secondary', () => {
  let authHeader: { Authorization: string };
  const cleanupPatientIds: bigint[] = [];
  const cleanupStatementNums: bigint[] = [];

  beforeAll(async () => {
    authHeader = await getAdminAuthHeader();
  });

  afterEach(async () => {
    for (const patNum of cleanupPatientIds) {
      const patClaims = await prisma.claim.findMany({ where: { PatNum: patNum } });
      const claimNums = patClaims.map(c => c.ClaimNum);
      if (claimNums.length > 0) {
        await prisma.claimtracking.deleteMany({ where: { ClaimNum: { in: claimNums } } });
        await prisma.claimproc.deleteMany({ where: { ClaimNum: { in: claimNums } } });
        await prisma.claim.deleteMany({ where: { PatNum: patNum } });
      }
      await prisma.paysplit.deleteMany({ where: { PatNum: patNum } });
      await prisma.payment.deleteMany({ where: { PatNum: patNum } });
      await prisma.adjustment.deleteMany({ where: { PatNum: patNum } });
      await prisma.procedurelog.deleteMany({ where: { PatNum: patNum } });
      await prisma.statement.deleteMany({ where: { PatNum: patNum } });
      await prisma.$executeRawUnsafe('DELETE FROM famaging WHERE "PatNum" = $1', patNum);
      await prisma.patplan.deleteMany({ where: { PatNum: patNum } });
      await prisma.inssub.deleteMany({ where: { Subscriber: patNum } });
      await deletePatientRecord(patNum);
    }
    cleanupPatientIds.length = 0;
    cleanupStatementNums.length = 0;
  });

  const buildCobFixture = async (tokenSeed: string) => {
    const token = uniqueToken(tokenSeed);
    const patient = await createPatientRecord(token);
    cleanupPatientIds.push(patient.PatNum);

    const statement = await createInvoiceStatement({ patientId: patient.PatNum, token });
    cleanupStatementNums.push(statement.StatementNum);
    await prisma.statement.update({
      where: { StatementNum: statement.StatementNum },
      data: { BalTotal: 950, InsEst: 950 },
    });

    const procNum = await getNextId('procedurelog', 'ProcNum');
    await prisma.procedurelog.create({
      data: {
        ProcNum: procNum,
        PatNum: patient.PatNum,
        StatementNum: statement.StatementNum,
        ProcDate: new Date(),
        ProcFee: 950,
        ProcStatus: 2, // Complete
        BillingNote: JSON.stringify({
          charge: 950,
          allowedFee: 950,
          insPortion: 475,
          primaryInsPortion: 475,
          secondaryInsPortion: 475,
          totalInsPortion: 950,
          ptPortion: 0,
          writeoff: 0,
          paidAmount: 0,
        }),
      },
    });

    const createClaim = async (type: 'Primary' | 'Secondary') => {
      const claimNum = await getNextId('claim', 'ClaimNum');
      await prisma.claim.create({
        data: {
          ClaimNum: claimNum,
          PatNum: patient.PatNum,
          ClaimStatus: 'S',
          ClaimType: type,
          ClaimFee: 950,
          InsPayEst: 475,
          InsPayAmt: 0,
          DedApplied: 0,
          DateSent: new Date(),
          ClaimNote: `Invoice #${statement.StatementNum}`,
          Narrative: JSON.stringify({
            invoiceId: statement.StatementNum.toString(),
            status: 'submitted',
            claimType: type.toLowerCase(),
            insuranceType: type.toLowerCase(),
            claimAmount: 950,
            submittedAmount: 475,
          }),
        },
      });
      const cpNum = await getNextId('claimproc', 'ClaimProcNum');
      await prisma.claimproc.create({
        data: {
          ClaimProcNum: cpNum,
          ProcNum: procNum,
          ClaimNum: claimNum,
          PatNum: patient.PatNum,
          Status: 0,
          FeeBilled: 950,
          InsPayEst: 475,
          InsPayAmt: 0,
          WriteOff: 0,
        },
      });
      return claimNum;
    };

    const primaryClaimNum = await createClaim('Primary');
    const secondaryClaimNum = await createClaim('Secondary');

    return { patient, statement, procNum, primaryClaimNum, secondaryClaimNum };
  };

  const readMeta = async (procNum: bigint) => {
    const proc = await prisma.procedurelog.findUnique({ where: { ProcNum: procNum } });
    return JSON.parse(proc?.BillingNote || '{}');
  };

  it('holds the primary shortfall until the secondary is applied, then releases the residual to the patient', async () => {
    const fx = await buildCobFixture('defersec');

    // ── Step 1: primary underpays $400 of $475, WITH deferral ──
    const primPay = await request(app)
      .post('/api/payments')
      .set(authHeader)
      .send({
        patientId: fx.patient.PatNum.toString(),
        invoiceId: fx.statement.StatementNum.toString(),
        amount: 400,
        paymentDate: new Date().toISOString(),
        paymentMethod: 'ach',
        paymentSource: 'insurance_company',
        deferUnderpaymentToSecondary: true,
        procedures: [
          {
            id: fx.procNum.toString(),
            allowed: 400,
            wo: 0,
            pay: 400,
            ded: 0,
            claimId: fx.primaryClaimNum.toString(),
          },
        ],
      });
    expect(primPay.status).toBe(201);

    const metaAfterPrim = await readMeta(fx.procNum);
    // The $75 shortfall is held: primary stays at its expected $475, patient
    // portion is untouched, and the marker records the deferred amount.
    expect(metaAfterPrim.primaryInsPortion).toBe(475);
    expect(metaAfterPrim.secondaryInsPortion).toBe(475);
    expect(metaAfterPrim.totalInsPortion).toBe(950);
    expect(metaAfterPrim.ptPortion).toBe(0);
    expect(metaAfterPrim.insurancePaidAmount).toBe(400);
    expect(metaAfterPrim.insuranceBalance).toBe(550);
    expect(metaAfterPrim.deferredInsShortfall).toBe(75);

    // No Income Transfer row yet — the patient is not billed for the shortfall.
    const adjAfterPrim = await prisma.adjustment.findMany({ where: { ProcNum: fx.procNum } });
    expect(adjAfterPrim.some(a => (a.AdjNote || '').includes('Income Transfer'))).toBe(false);

    // ── Step 2: secondary pays its $475 in full ──
    const secPay = await request(app)
      .post('/api/payments')
      .set(authHeader)
      .send({
        patientId: fx.patient.PatNum.toString(),
        invoiceId: fx.statement.StatementNum.toString(),
        amount: 475,
        paymentDate: new Date().toISOString(),
        paymentMethod: 'ach',
        paymentSource: 'insurance_company',
        procedures: [
          {
            id: fx.procNum.toString(),
            allowed: 475,
            wo: 0,
            pay: 475,
            ded: 0,
            claimId: fx.secondaryClaimNum.toString(),
          },
        ],
      });
    expect(secPay.status).toBe(201);

    const metaFinal = await readMeta(fx.procNum);
    // Deferred shortfall released to the patient: primary finalized at what it
    // actually paid ($400), secondary at $475, patient now owes the $75 gap.
    expect(metaFinal.primaryInsPortion).toBe(400);
    expect(metaFinal.secondaryInsPortion).toBe(475);
    expect(metaFinal.totalInsPortion).toBe(875);
    expect(metaFinal.insurancePaidAmount).toBe(875);
    expect(metaFinal.insuranceBalance).toBe(0);
    expect(metaFinal.ptPortion).toBe(75);
    expect(metaFinal.deferredInsShortfall).toBe(0);

    // The $75 income transfer row now exists.
    const adjFinal = await prisma.adjustment.findMany({ where: { ProcNum: fx.procNum } });
    const transfer = adjFinal.find(a => (a.AdjNote || '').includes('Income Transfer'));
    expect(transfer?.AdjNote).toContain('$75.00');
  });

  it('without the defer flag the primary shortfall moves to the patient immediately (unchanged behavior)', async () => {
    const fx = await buildCobFixture('nodefer');

    const primPay = await request(app)
      .post('/api/payments')
      .set(authHeader)
      .send({
        patientId: fx.patient.PatNum.toString(),
        invoiceId: fx.statement.StatementNum.toString(),
        amount: 400,
        paymentDate: new Date().toISOString(),
        paymentMethod: 'ach',
        paymentSource: 'insurance_company',
        procedures: [
          {
            id: fx.procNum.toString(),
            allowed: 400,
            wo: 0,
            pay: 400,
            ded: 0,
            claimId: fx.primaryClaimNum.toString(),
          },
        ],
      });
    expect(primPay.status).toBe(201);

    const meta = await readMeta(fx.procNum);
    expect(meta.primaryInsPortion).toBe(400);
    expect(meta.ptPortion).toBe(75);
    expect(meta.deferredInsShortfall).toBe(0);
  });
});
