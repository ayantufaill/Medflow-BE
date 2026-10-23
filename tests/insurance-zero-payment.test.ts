import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/db';
import { getAdminAuthHeader } from './helpers/auth';
import { uniqueToken } from './helpers/unique';
import { createPatientRecord, createInvoiceStatement } from './helpers/fixtures';
import { getNextId } from '../src/utils/opendental-ids.util';

describe('Insurance $0 payment (denial) keeps the write-off out of the patient portion', () => {
  let authHeader: { Authorization: string };
  const cleanupPatientIds: bigint[] = [];

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
      await prisma.patient.deleteMany({ where: { PatNum: patNum } });
    }
    cleanupPatientIds.length = 0;
  });

  /**
   * $100 fee, $20 contractual write-off, $80 estimated insurance, $0 patient
   * portion. The carrier denies the claim and pays $0.
   *
   * The claimproc row claim.service writes when it builds a claim from an
   * invoice carries no WriteOff/WriteOffEst, so the payment dialog used to read
   * the WO column back as 0.00 and post `wo: 0`. The priced write-off must stay
   * a write-off; only the $80 insurance estimate may move to the patient.
   */
  const buildFixture = async (tokenSuffix: string) => {
    const token = uniqueToken(tokenSuffix);
    const patient = await createPatientRecord(token);
    cleanupPatientIds.push(patient.PatNum);

    const statement = await createInvoiceStatement({ patientId: patient.PatNum, token });

    const procNum = await getNextId('procedurelog', 'ProcNum');
    await prisma.procedurelog.create({
      data: {
        ProcNum: procNum,
        PatNum: patient.PatNum,
        StatementNum: statement.StatementNum,
        ProcDate: new Date(),
        ProcFee: 100,
        ProcStatus: 2,
        BillingNote: JSON.stringify({
          charge: 100,
          insPortion: 80,
          primaryInsPortion: 80,
          ptPortion: 0,
          writeoff: 20,
          allowedFee: 80,
          allowedFeeSource: 'plan',
          paidAmount: 0,
        }),
      },
    });

    const claimNum = await getNextId('claim', 'ClaimNum');
    await prisma.claim.create({
      data: {
        ClaimNum: claimNum,
        PatNum: patient.PatNum,
        ClaimStatus: 'S',
        ClaimFee: 100,
        InsPayEst: 80,
        InsPayAmt: 0,
        DedApplied: 0,
        DateSent: new Date(),
        ClaimNote: `Invoice #${statement.StatementNum}`,
        Narrative: JSON.stringify({
          invoiceId: statement.StatementNum.toString(),
          status: 'submitted',
          claimAmount: 100,
          submittedAmount: 80,
        }),
      },
    });

    // claim.service creates claimprocs with WriteOff/WriteOffEst unset — this
    // mirrors that gap, which is what hid the write-off from the dialog.
    const cpNum = await getNextId('claimproc', 'ClaimProcNum');
    await prisma.claimproc.create({
      data: {
        ClaimProcNum: cpNum,
        ProcNum: procNum,
        ClaimNum: claimNum,
        PatNum: patient.PatNum,
        Status: 0,
        FeeBilled: 100,
        InsPayEst: 80,
        InsPayAmt: 0,
        WriteOff: 0,
      },
    });

    return { patient, statement, procNum, claimNum };
  };

  const postZeroPayment = async (fixture: Awaited<ReturnType<typeof buildFixture>>, postedWo: number) => {
    const payRes = await request(app)
      .post('/api/payments')
      .set(authHeader)
      .send({
        patientId: fixture.patient.PatNum.toString(),
        invoiceId: fixture.statement.StatementNum.toString(),
        amount: 0,
        paymentDate: new Date().toISOString(),
        paymentMethod: 'ach',
        paymentSource: 'insurance_company',
        procedures: [
          {
            id: fixture.procNum.toString(),
            allowed: 80,
            wo: postedWo,
            pay: 0,
            ded: 0,
            claimId: fixture.claimNum.toString(),
          },
        ],
      });
    expect(payRes.status).toBe(201);

    const updatedProc = await prisma.procedurelog.findUnique({ where: { ProcNum: fixture.procNum } });
    const procMeta = JSON.parse(updatedProc?.BillingNote || '{}');
    const updatedStmt = await prisma.statement.findUnique({ where: { StatementNum: fixture.statement.StatementNum } });
    const cp = await prisma.claimproc.findFirst({ where: { ProcNum: fixture.procNum } });

    const invRes = await request(app)
      .get(`/api/invoices/${fixture.statement.StatementNum}`)
      .set(authHeader);
    const invData = invRes.body?.data?.invoice || invRes.body?.data;

    return { procMeta, updatedStmt, cp, invData };
  };

  it('keeps the $20 write-off as a write-off when the dialog posts wo: 0 with a $0 payment', async () => {
    const fixture = await buildFixture('zeropay0');
    const { procMeta, updatedStmt, cp, invData } = await postZeroPayment(fixture, 0);

    // The denial moves only the $80 insurance estimate to the patient — never
    // the $20 contractual write-off.
    expect(procMeta.writeoff).toBe(20);
    expect(procMeta.ptPortion).toBe(80);
    expect(procMeta.insPortion).toBe(0);

    // claimproc picks up the priced write-off too.
    expect(Number(cp?.WriteOff)).toBe(20);

    expect(Number(updatedStmt?.InsEst)).toBe(0);
    expect(invData.patientPortion).toBe(80);
    expect(invData.insurancePortion).toBe(0);
    expect(invData.writeoffAmount).toBe(20);
  });

  it('keeps the write-off as a write-off when the dialog posts the $20 WO with a $0 payment', async () => {
    const fixture = await buildFixture('zeropay20');
    const { procMeta, updatedStmt, cp, invData } = await postZeroPayment(fixture, 20);

    expect(procMeta.writeoff).toBe(20);
    expect(procMeta.ptPortion).toBe(80);
    expect(procMeta.insPortion).toBe(0);
    expect(Number(cp?.WriteOff)).toBe(20);

    expect(Number(updatedStmt?.InsEst)).toBe(0);
    expect(invData.patientPortion).toBe(80);
    expect(invData.writeoffAmount).toBe(20);
  });

  it('honors an explicitly raised write-off posted with a $0 payment', async () => {
    const fixture = await buildFixture('zeropay30');
    const { procMeta, cp, invData } = await postZeroPayment(fixture, 30);

    // 100 fee = 30 write-off + 0 paid + 70 patient.
    expect(procMeta.writeoff).toBe(30);
    expect(procMeta.ptPortion).toBe(70);
    expect(procMeta.insPortion).toBe(0);
    expect(Number(cp?.WriteOff)).toBe(30);
    expect(invData.patientPortion).toBe(70);
    expect(invData.writeoffAmount).toBe(30);
  });

  it('exposes the priced write-off on claim procedures so the dialog posts it instead of 0', async () => {
    const fixture = await buildFixture('claimswo');

    const claimRes = await request(app)
      .get(`/api/claims/${fixture.claimNum}`)
      .set(authHeader);
    expect(claimRes.status).toBe(200);

    const claim = claimRes.body?.data?.claim || claimRes.body?.data;
    const procs = claim?.procedures || claim?.selectedItems || [];
    expect(procs.length).toBeGreaterThan(0);
    const line = procs.find((p: any) => String(p.id) === String(fixture.procNum));
    expect(line).toBeTruthy();
    expect(Number(line.writeOffEst)).toBe(20);
    expect(Number(line.writeoff)).toBe(20);
    expect(Number(line.writeOff)).toBe(20);
  });
});