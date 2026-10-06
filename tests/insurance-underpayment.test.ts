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
  const cleanupCarrierNums: bigint[] = [];

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
      // Income Transfer adjustments reference ProcNum (fk_adjustment_4_ProcNum),
      // so they have to go before procedurelog.
      await prisma.adjustment.deleteMany({ where: { PatNum: patNum } });
      await prisma.procedurelog.deleteMany({ where: { PatNum: patNum } });
      await prisma.statement.deleteMany({ where: { PatNum: patNum } });
      await prisma.$executeRawUnsafe('DELETE FROM famaging WHERE "PatNum" = $1', patNum);
      await prisma.patplan.deleteMany({ where: { PatNum: patNum } });
      await prisma.inssub.deleteMany({ where: { Subscriber: patNum } });
      await prisma.patient.deleteMany({ where: { PatNum: patNum } });
    }
    // insplan is referenced by claim.PlanNum (fk_claim_2_PlanNum), so it can only
    // be removed once the loop above has deleted this patient's claims. Doing it
    // inline at the end of a test instead hits that foreign key, because afterEach
    // has not run yet.
    if (cleanupCarrierNums.length > 0) {
      await prisma.insplan.deleteMany({ where: { CarrierNum: { in: cleanupCarrierNums } } });
      await prisma.carrier.deleteMany({ where: { CarrierNum: { in: cleanupCarrierNums } } });
    }
    cleanupPatientIds.length = 0;
    cleanupStatementNums.length = 0;
    cleanupCarrierNums.length = 0;
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

  it('Situation 3: Secondary Insurance flow -> ptPortion transfers to secondaryInsPortion (ptPortion=0), secondary claim takes secondaryInsPortion, and underpayment on either claim transfers to ptPortion', async () => {
    const token = uniqueToken('secundpay');
    const alphanumericToken = token.replace(/[^A-Za-z0-9]/g, '');
    const patient = await createPatientRecord(alphanumericToken);
    cleanupPatientIds.push(patient.PatNum);

    // Create Carrier 1 (Primary) and Carrier 2 (Secondary)
    const carrierNum1 = await getNextId('carrier', 'CarrierNum');
    await prisma.carrier.create({
      data: {
        CarrierNum: carrierNum1,
        CarrierName: `Carrier-Primary-${alphanumericToken}`,
        ElectID: `P1${alphanumericToken}`,
      },
    });

    const carrierNum2 = await getNextId('carrier', 'CarrierNum');
    await prisma.carrier.create({
      data: {
        CarrierNum: carrierNum2,
        CarrierName: `Carrier-Secondary-${alphanumericToken}`,
        ElectID: `S2${alphanumericToken}`,
      },
    });
    cleanupCarrierNums.push(carrierNum1, carrierNum2);

    // Add Primary Insurance (Ordinal 1)
    const res1 = await request(app)
      .post(`/api/patients/${patient.PatNum}/insurance`)
      .set(authHeader)
      .send({
        insuranceType: 'primary',
        insuranceCompanyId: carrierNum1.toString(),
        relationshipToPatient: 'self',
        effectiveDate: new Date().toISOString(),
        policyNumber: `POL1${alphanumericToken.substring(0, 8)}`,
        subscriberName: 'Primary Subscriber',
        subscriberDateOfBirth: new Date(1990, 0, 1).toISOString(),
      });
    expect(res1.status).toBe(201);

    // Add Secondary Insurance (Ordinal 2)
    const res2 = await request(app)
      .post(`/api/patients/${patient.PatNum}/insurance`)
      .set(authHeader)
      .send({
        insuranceType: 'secondary',
        insuranceCompanyId: carrierNum2.toString(),
        relationshipToPatient: 'self',
        effectiveDate: new Date().toISOString(),
        policyNumber: `POL2${alphanumericToken.substring(0, 8)}`,
        subscriberName: 'Secondary Subscriber',
        subscriberDateOfBirth: new Date(1990, 0, 1).toISOString(),
      });
    expect(res2.status).toBe(201);

    // Step 1: Create a Standalone Invoice with a procedure where primary covers $80, patient portion would be $20
    //
    // The code matters. createInvoice honours the client-supplied split only until
    // recalculateInvoice re-prices every line through calculateInsuranceEstimates,
    // which is the source of truth for anything not flagged isManuallyAdjusted.
    // With no coverage table on these bare test plans, that engine falls back to
    // the CDT category defaults: D-codes under 2000 are Diagnostic & Preventative
    // at 100%, 2000-4999 Restorative at 80% (see the fallback in
    // invoice.service.ts). D1110 (prophylaxis) is therefore covered at 100%,
    // leaving a $0 patient portion and nothing for the secondary carrier to take —
    // which is not the flow this test is about. D2140 lands in the 80% band, so
    // the engine independently produces the 80/20 split the client passes below,
    // and the secondary transfer under test is actually exercised.
    const invRes = await request(app)
      .post('/api/invoices')
      .set(authHeader)
      .send({
        patientId: patient.PatNum.toString(),
        items: [
          {
            code: 'D2140',
            description: 'Amalgam One Surface',
            charge: 100,
            writeoff: 0,
            insPortion: 80,
            ptPortion: 20, // Client passes preliminary ptPortion 20
          },
        ],
      });

    expect(invRes.status).toBe(201);
    // POST /api/invoices answers with `data: { invoice }` (invoice.controller.ts),
    // the same shape tests/invoices.test.ts reads.
    const invoice = invRes.body.data.invoice;
    const invoiceId = invoice._id || invoice.id;
    cleanupStatementNums.push(BigInt(invoiceId));

    // Verify: Because patient has secondary insurance:
    // - ptPortion is transferred into secondaryInsPortion = 20
    // - ptPortion is 0
    // - Statement InsEst is 100 (80 primary + 20 secondary)
    // - Patient portion is 0
    const invData = invoice;
    console.log('PROBE invoice:', JSON.stringify({ patientPortion: invData.patientPortion, secondaryInsPortion: invData.secondaryInsPortion, insurancePortion: invData.insurancePortion }));
    const probeProcs = await prisma.procedurelog.findMany({ where: { StatementNum: BigInt(invoiceId) } });
    console.log('PROBE procMeta:', probeProcs[0]?.BillingNote);
    expect(invData.patientPortion).toBe(0);
    expect(invData.secondaryInsPortion).toBe(20);
    expect(invData.insurancePortion).toBe(80);

    const procs = await prisma.procedurelog.findMany({ where: { StatementNum: BigInt(invoiceId) } });
    expect(procs.length).toBe(1);
    const procNum = procs[0].ProcNum;
    const procMeta = JSON.parse(procs[0].BillingNote || '{}');
    expect(procMeta.insPortion).toBe(80);
    expect(procMeta.secondaryInsPortion).toBe(20);
    expect(procMeta.ptPortion).toBe(0);

    // Aging: patient balance = 0, and insurance balance is still 0 here.
    //
    // insuranceBalance is derived from claim / claimproc rows
    // (finance-dashboard.service.ts), NOT from the invoice's insurance estimate —
    // it answers "what have we billed insurance and not been paid for", so it only
    // becomes non-zero once a claim exists. No claim has been created at this
    // point (Step 2 below is what creates the primary one, and this invoice was
    // not posted with addClaim), so 0 is correct. The $100 shows up in the aging
    // assertions further down, after the claims are in place.
    const agingInitial = await request(app)
      .get(`/api/finance-dashboard/aging/${patient.PatNum}`)
      .set(authHeader);
    expect(agingInitial.status).toBe(200);
    expect(agingInitial.body.data.familyOutstanding.total).toBe(0);
    expect(agingInitial.body.data.insuranceBalance.total).toBe(0);

    // The invoice itself does carry the full $100 estimate (80 primary + 20 secondary).
    const stmtInitial = await prisma.statement.findUnique({ where: { StatementNum: BigInt(invoiceId) } });
    expect(Number(stmtInitial?.InsEst)).toBe(100);

    // Step 2: Create Primary Claim for this invoice
    const primClaimRes = await request(app)
      .post(`/api/claims/from-invoice/${invoiceId}`)
      .set(authHeader)
      .send({
        insuranceCompanyId: carrierNum1.toString(),
        insuranceType: 'primary',
      });
    expect(primClaimRes.status).toBe(201);
    const primClaim = primClaimRes.body.data.claim;
    expect(primClaim.claimAmount).toBe(80);
    expect(primClaim.patientResponsibility).toBe(0);

    // Step 3: Primary Insurance pays $70 (underpays by $10)
    const primPayRes = await request(app)
      .post('/api/payments')
      .set(authHeader)
      .send({
        patientId: patient.PatNum.toString(),
        invoiceId,
        amount: 70,
        paymentDate: new Date().toISOString(),
        paymentMethod: 'ach',
        paymentSource: 'insurance_company',
        procedures: [
          {
            id: procNum.toString(),
            allowed: 70,
            wo: 0,
            pay: 70,
            claimId: primClaim.id.toString(),
          },
        ],
      });
    expect(primPayRes.status).toBe(201);
    expect(primPayRes.body.data.payment.suggestSecondaryClaim).toBe(true);

    // Mark primary claim as paid
    await request(app)
      .patch(`/api/claims/${primClaim.id}`)
      .set(authHeader)
      .send({ status: 'paid', paidAmount: 70 });

    // Verify:
    // - Procedure BillingNote: insPortion = 70, secondaryInsPortion = 20, ptPortion = 10 (underpayment shifted to patient)
    const procAfterPrim = await prisma.procedurelog.findUnique({ where: { ProcNum: procNum } });
    const procMetaAfterPrim = JSON.parse(procAfterPrim?.BillingNote || '{}');
    // primaryInsPortion is the unambiguous field: the primary carrier is finalized
    // at what it actually paid ($70), the $10 underpayment moves to the patient,
    // and the secondary estimate is untouched.
    expect(procMetaAfterPrim.primaryInsPortion).toBe(70);
    expect(procMetaAfterPrim.secondaryInsPortion).toBe(20);
    expect(procMetaAfterPrim.ptPortion).toBe(10);
    // `insPortion` carries the PRIMARY portion on both the invoice and the
    // payment path; the combined figure lives on totalInsPortion.
    expect(procMetaAfterPrim.insPortion).toBe(70);
    expect(procMetaAfterPrim.totalInsPortion).toBe(90);

    // Statement:
    const stmtAfterPrim = await prisma.statement.findUnique({ where: { StatementNum: BigInt(invoiceId) } });
    expect(Number(stmtAfterPrim?.BalTotal)).toBe(30); // 100 - 70 = 30
    expect(Number(stmtAfterPrim?.InsEst)).toBe(20); // 20 secondary remaining

    // Aging: patient owes $10 (primary underpayment). Insurance aging is still 0 —
    // the primary claim is settled and so excluded, and the $20 secondary estimate
    // is not an insurance receivable until the secondary claim is actually created
    // in Step 4 below. The invoice's own InsEst already shows that $20 (asserted
    // just above); aging answers the narrower "what is outstanding on a submitted
    // claim" question.
    const agingAfterPrim = await request(app)
      .get(`/api/finance-dashboard/aging/${patient.PatNum}`)
      .set(authHeader);
    expect(agingAfterPrim.body.data.familyOutstanding.total).toBe(10);
    expect(agingAfterPrim.body.data.insuranceBalance.total).toBe(0);

    // Step 4: Generate Secondary Claim from Primary Claim
    const secClaimRes = await request(app)
      .post(`/api/claims/${primClaim.id}/generate-secondary`)
      .set(authHeader);
    expect(secClaimRes.status).toBe(201);
    const secClaim = secClaimRes.body.data.claim;
    // Transferred variable value: secondary claim amount must be $20!
    expect(secClaim.claimAmount).toBe(20);
    expect(secClaim.submittedAmount).toBe(20);
    expect(secClaim.patientResponsibility).toBe(0);

    // Step 5: Secondary Insurance pays $15 (underpays by $5)
    const secPayRes = await request(app)
      .post('/api/payments')
      .set(authHeader)
      .send({
        patientId: patient.PatNum.toString(),
        invoiceId,
        amount: 15,
        paymentDate: new Date().toISOString(),
        paymentMethod: 'ach',
        paymentSource: 'insurance_company',
        procedures: [
          {
            id: procNum.toString(),
            allowed: 15,
            wo: 0,
            pay: 15,
            claimId: secClaim.id.toString(),
          },
        ],
      });
    expect(secPayRes.status).toBe(201);

    // Mark secondary claim as paid
    await request(app)
      .patch(`/api/claims/${secClaim.id}`)
      .set(authHeader)
      .send({ status: 'paid', paidAmount: 15 });

    // Verify Final State:
    // - Procedure BillingNote: insPortion = 70, secondaryInsPortion = 15, ptPortion = 15 ($10 primary underpayment + $5 secondary underpayment)
    const procFinal = await prisma.procedurelog.findUnique({ where: { ProcNum: procNum } });
    const procMetaFinal = JSON.parse(procFinal?.BillingNote || '{}');
    expect(procMetaFinal.insPortion).toBe(70);
    expect(procMetaFinal.secondaryInsPortion).toBe(15);
    expect(procMetaFinal.ptPortion).toBe(15);

    // Statement:
    const stmtFinal = await prisma.statement.findUnique({ where: { StatementNum: BigInt(invoiceId) } });
    expect(Number(stmtFinal?.InsEst)).toBe(0); // No insurance balance remains
    expect(Number(stmtFinal?.BalTotal)).toBe(15); // Remaining $15 due from patient

    // Aging: patient owes $15, insurance owes $0
    const agingFinal = await request(app)
      .get(`/api/finance-dashboard/aging/${patient.PatNum}`)
      .set(authHeader);
    expect(agingFinal.body.data.insuranceBalance.total).toBe(0);
    expect(agingFinal.body.data.familyOutstanding.total).toBe(15);
  });
});
