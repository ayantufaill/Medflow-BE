import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/db';
import { getAdminAuthHeader } from './helpers/auth';
import { uniqueToken } from './helpers/unique';
import { createPatientRecord, createInvoiceStatement } from './helpers/fixtures';
import { getNextId } from '../src/utils/opendental-ids.util';

describe('Insurance Underpayment Balance Transfer', () => {
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
      await prisma.procedurelog.deleteMany({ where: { PatNum: patNum } });
      await prisma.adjustment.deleteMany({ where: { PatNum: patNum } });
      await prisma.statement.deleteMany({ where: { PatNum: patNum } });
      await prisma.$executeRawUnsafe('DELETE FROM famaging WHERE "PatNum" = $1', patNum);
      await prisma.patplan.deleteMany({ where: { PatNum: patNum } });
      await prisma.inssub.deleteMany({ where: { Subscriber: patNum } });
      await prisma.patient.deleteMany({ where: { PatNum: patNum } });
    }
    cleanupPatientIds.length = 0;
    cleanupStatementNums.length = 0;
  });

  it('Situation 1: Insurance pays first and underpays ($216 instead of $244 on $305 total) -> underpayment shifts to Pt Balance and Ins Balance is zero', async () => {
    const token = uniqueToken('underpay1');
    const patient = await createPatientRecord(token);
    cleanupPatientIds.push(patient.PatNum);

    const statement = await createInvoiceStatement({
      patientId: patient.PatNum,
      token,
      totalAmount: 305,
      balanceDue: 305,
      patientPortion: 61,
      insurancePortion: 244,
    });
    cleanupStatementNums.push(statement.StatementNum);

    // Create a completed procedurelog row attached to this invoice
    const procNum = await getNextId('procedurelog', 'ProcNum');
    await prisma.procedurelog.create({
      data: {
        ProcNum: procNum,
        PatNum: patient.PatNum,
        StatementNum: statement.StatementNum,
        ProcDate: new Date(),
        ProcFee: 305,
        ProcStatus: 2, // Complete
        BillingNote: JSON.stringify({
          charge: 305,
          insPortion: 244,
          ptPortion: 61,
          writeoff: 0,
          paidAmount: 0,
        }),
      },
    });

    // Create a claim for this invoice
    const claimNum = await getNextId('claim', 'ClaimNum');
    await prisma.claim.create({
      data: {
        ClaimNum: claimNum,
        PatNum: patient.PatNum,
        ClaimStatus: 'S', // Sent
        ClaimFee: 305,
        InsPayEst: 244,
        InsPayAmt: 0,
        DedApplied: 0,
        DateSent: new Date(),
        ClaimNote: `Invoice #${statement.StatementNum}`,
        Narrative: JSON.stringify({
          invoiceId: statement.StatementNum.toString(),
          status: 'submitted',
          claimAmount: 305,
          submittedAmount: 244,
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
        Status: 0, // Pending
        FeeBilled: 305,
        InsPayEst: 244,
        InsPayAmt: 0,
        WriteOff: 0,
      },
    });

    // Post insurance payment of $216 (underpays by $28)
    const payRes = await request(app)
      .post('/api/payments')
      .set(authHeader)
      .send({
        patientId: patient.PatNum.toString(),
        invoiceId: statement.StatementNum.toString(),
        amount: 216,
        paymentDate: new Date().toISOString(),
        paymentMethod: 'ach',
        paymentSource: 'insurance_company',
        procedures: [
          {
            id: procNum.toString(),
            allowed: 216,
            wo: 0,
            pay: 216,
            ded: 0,
            claimId: claimNum.toString(),
          },
        ],
      });

    expect(payRes.status).toBe(201);

    // Mark claim as paid
    const claimRes = await request(app)
      .patch(`/api/claims/${claimNum}`)
      .set(authHeader)
      .send({
        status: 'paid',
        paidAmount: 216,
      });

    expect(claimRes.status).toBe(200);

    // 1. Verify Procedure BillingNote has updated portions
    const updatedProc = await prisma.procedurelog.findUnique({ where: { ProcNum: procNum } });
    const procMeta = JSON.parse(updatedProc?.BillingNote || '{}');
    expect(procMeta.insPortion).toBe(216);
    expect(procMeta.ptPortion).toBe(89); // $61 original + $28 underpaid
    expect(procMeta.paidAmount).toBe(216);

    // 2. Verify Statement in database has 0 InsEst and $89 BalTotal
    const updatedStmt = await prisma.statement.findUnique({ where: { StatementNum: statement.StatementNum } });
    expect(Number(updatedStmt?.InsEst)).toBe(0);
    expect(Number(updatedStmt?.BalTotal)).toBe(89);

    // 3. Verify Invoice API returns updated patientPortion and balanceDue
    const invRes = await request(app)
      .get(`/api/invoices/${statement.StatementNum}`)
      .set(authHeader);

    expect(invRes.status).toBe(200);
    const invData = invRes.body?.data?.invoice || invRes.body?.data;
    expect(invData.insurancePortion).toBe(216);
    expect(invData.patientPortion).toBe(89);
    expect(invData.balanceDue).toBe(89);

    // 4. Verify Aging Summary excludes paid claim from insuranceBalance and includes $89 in patient balance
    const agingRes = await request(app)
      .get(`/api/finance-dashboard/aging/${patient.PatNum}`)
      .set(authHeader);

    expect(agingRes.status).toBe(200);
    const agingData = agingRes.body?.data;
    expect(agingData.insuranceBalance.total).toBe(0);
    expect(agingData.familyOutstanding.total).toBe(89);
  });

  it('Situation 2: Patient pays initial portion first ($120 on $305 total), then insurance pays $150 instead of $185 -> underpaid $35 remains in Ins Balance', async () => {
    const token = uniqueToken('underpay2');
    const patient = await createPatientRecord(token);
    cleanupPatientIds.push(patient.PatNum);

    const statement = await createInvoiceStatement({
      patientId: patient.PatNum,
      token,
      totalAmount: 305,
      balanceDue: 305,
      patientPortion: 120,
      insurancePortion: 185,
    });
    cleanupStatementNums.push(statement.StatementNum);

    const procNum = await getNextId('procedurelog', 'ProcNum');
    await prisma.procedurelog.create({
      data: {
        ProcNum: procNum,
        PatNum: patient.PatNum,
        StatementNum: statement.StatementNum,
        ProcDate: new Date(),
        ProcFee: 305,
        ProcStatus: 2,
        BillingNote: JSON.stringify({
          charge: 305,
          insPortion: 185,
          ptPortion: 120,
          writeoff: 0,
          paidAmount: 0,
        }),
      },
    });

    // Step 1: Patient pays their $120 portion first
    const ptPayRes = await request(app)
      .post('/api/payments')
      .set(authHeader)
      .send({
        patientId: patient.PatNum.toString(),
        invoiceId: statement.StatementNum.toString(),
        amount: 120,
        paymentDate: new Date().toISOString(),
        paymentMethod: 'card',
        paymentSource: 'patient',
        procedures: [
          {
            id: procNum.toString(),
            pay: 120,
          },
        ],
      });

    expect(ptPayRes.status).toBe(201);

    // Verify invoice balance is now $185
    let stmtAfterPtPay = await prisma.statement.findUnique({ where: { StatementNum: statement.StatementNum } });
    expect(Number(stmtAfterPtPay?.BalTotal)).toBe(185);

    // Step 2: Biller creates claim for remaining insurance portion ($185)
    const claimNum = await getNextId('claim', 'ClaimNum');
    await prisma.claim.create({
      data: {
        ClaimNum: claimNum,
        PatNum: patient.PatNum,
        ClaimStatus: 'S',
        ClaimFee: 305,
        InsPayEst: 185,
        InsPayAmt: 0,
        DedApplied: 0,
        DateSent: new Date(),
        ClaimNote: `Invoice #${statement.StatementNum}`,
        Narrative: JSON.stringify({
          invoiceId: statement.StatementNum.toString(),
          status: 'submitted',
          claimAmount: 305,
          submittedAmount: 185,
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
        FeeBilled: 305,
        InsPayEst: 185,
        InsPayAmt: 0,
        WriteOff: 0,
      },
    });

    // Step 3: Insurance underpays with Partial Payment checked, paying $150 instead of $185
    const insPayRes = await request(app)
      .post('/api/payments')
      .set(authHeader)
      .send({
        patientId: patient.PatNum.toString(),
        invoiceId: statement.StatementNum.toString(),
        amount: 150,
        paymentDate: new Date().toISOString(),
        paymentMethod: 'ach',
        paymentSource: 'insurance_company',
        isPartialPayment: true,
        procedures: [
          {
            id: procNum.toString(),
            allowed: 150,
            wo: 0,
            pay: 150,
            ded: 0,
            claimId: claimNum.toString(),
          },
        ],
      });

    expect(insPayRes.status).toBe(201);

    // Mark claim as partial
    const claimRes = await request(app)
      .patch(`/api/claims/${claimNum}`)
      .set(authHeader)
      .send({
        status: 'partial',
        paidAmount: 150,
      });

    expect(claimRes.status).toBe(200);

    // 1. Verify Procedure BillingNote
    const updatedProc = await prisma.procedurelog.findUnique({ where: { ProcNum: procNum } });
    const procMeta = JSON.parse(updatedProc?.BillingNote || '{}');
    expect(procMeta.insPortion).toBe(185); // Preserves insurance portion
    expect(procMeta.ptPortion).toBe(120); // Patient originally had 120 and paid in full -> remains 120 (does NOT shift to pt)
    expect(procMeta.paidAmount).toBe(270); // 120 pt + 150 ins

    // 2. Verify Statement: InsEst is 35 (uncollected insurance), BalTotal is 35 (remaining balance due from insurance)
    const updatedStmt = await prisma.statement.findUnique({ where: { StatementNum: statement.StatementNum } });
    expect(Number(updatedStmt?.InsEst)).toBe(35);
    expect(Number(updatedStmt?.BalTotal)).toBe(35);

    // 3. Verify Aging Summary: patient balance is 0 because patient paid their portion in full
    const agingRes = await request(app)
      .get(`/api/finance-dashboard/aging/${patient.PatNum}`)
      .set(authHeader);

    expect(agingRes.status).toBe(200);
    const agingData = agingRes.body?.data;
    expect(agingData.familyOutstanding.total).toBe(0);
  });
});
