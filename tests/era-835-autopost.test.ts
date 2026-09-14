import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/config/db';
import { era835Service } from '../src/services/era835.service';
import { eraService } from '../src/services/era.service';
import { getNextId } from '../src/utils/opendental-ids.util';

describe('Phase 6: X12 835 ERA Parsing & Auto-Posting Engine', () => {
  let patNum: bigint;
  let provNum: bigint;
  let carrierNum: bigint;
  let planNum: bigint;
  let insSubNum: bigint;
  let patPlanNum: bigint;
  let procNum1: bigint;
  let procNum2: bigint;
  let claimNum1: bigint;
  let claimProcNum1: bigint;
  let claimProcNum2: bigint;
  const createdEtransNums: bigint[] = [];
  const createdClaimPaymentNums: bigint[] = [];

  beforeAll(async () => {
    // 1. Patient
    patNum = await getNextId('patient', 'PatNum');
    await prisma.patient.create({
      data: {
        PatNum: patNum,
        FName: 'John',
        LName: 'EraTester',
        Birthdate: new Date('1988-06-15'),
      },
    });

    // 2. Provider
    provNum = await getNextId('provider', 'ProvNum');
    await prisma.provider.create({
      data: {
        ProvNum: provNum,
        Abbr: 'ETEST',
        LName: 'EraDentist',
        FName: 'Arthur',
        NationalProvID: '1234567893',
      },
    });

    // 3. Carrier
    const uniqueElect = `E${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 1000)}`;
    carrierNum = await getNextId('carrier', 'CarrierNum');
    await prisma.carrier.create({
      data: {
        CarrierNum: carrierNum,
        CarrierName: 'Delta Dental Test',
        ElectID: uniqueElect,
      },
    });

    // 4. InsPlan & InsSub & PatPlan
    planNum = await getNextId('insplan', 'PlanNum');
    await prisma.insplan.create({
      data: {
        PlanNum: planNum,
        CarrierNum: carrierNum,
        PlanType: '',
      },
    });

    insSubNum = await getNextId('inssub', 'InsSubNum');
    await prisma.inssub.create({
      data: {
        InsSubNum: insSubNum,
        PlanNum: planNum,
        Subscriber: patNum,
        SubscriberID: 'SUB123456789',
      },
    });

    patPlanNum = await getNextId('patplan', 'PatPlanNum');
    await prisma.patplan.create({
      data: {
        PatPlanNum: patPlanNum,
        PatNum: patNum,
        InsSubNum: insSubNum,
        Ordinal: 1,
        IsPending: 0,
      },
    });

    // 5. ProcedureLog entries
    procNum1 = await getNextId('procedurelog', 'ProcNum');
    await prisma.procedurelog.create({
      data: {
        ProcNum: procNum1,
        PatNum: patNum,
        ProvNum: provNum,
        ProcDate: new Date('2026-03-01'),
        ProcFee: 200.0,
        ProcStatus: 2,
        OldCode: 'D0120',
      },
    });

    procNum2 = await getNextId('procedurelog', 'ProcNum');
    await prisma.procedurelog.create({
      data: {
        ProcNum: procNum2,
        PatNum: patNum,
        ProvNum: provNum,
        ProcDate: new Date('2026-03-01'),
        ProcFee: 800.0,
        ProcStatus: 2,
        OldCode: 'D2750',
      },
    });

    // 6. Claim
    claimNum1 = await getNextId('claim', 'ClaimNum');
    await prisma.claim.create({
      data: {
        ClaimNum: claimNum1,
        PatNum: patNum,
        PlanNum: planNum,
        InsSubNum: insSubNum,
        ProvTreat: provNum,
        ProvBill: provNum,
        ClaimFee: 1000.0,
        InsPayEst: 800.0,
        InsPayAmt: 0,
        ClaimStatus: 'W', // Waiting
        ClaimType: 'P',
        DateService: new Date('2026-03-01'),
        ClaimIdentifier: `CLM-${claimNum1}`,
      },
    });

    // 7. ClaimProcs
    claimProcNum1 = await getNextId('claimproc', 'ClaimProcNum');
    await prisma.claimproc.create({
      data: {
        ClaimProcNum: claimProcNum1,
        ProcNum: procNum1,
        ClaimNum: claimNum1,
        PatNum: patNum,
        ProvNum: provNum,
        PlanNum: planNum,
        InsSubNum: insSubNum,
        FeeBilled: 200.0,
        InsPayEst: 160.0,
        Status: 0, // Not received
        CodeSent: 'D0120',
      },
    });

    claimProcNum2 = await getNextId('claimproc', 'ClaimProcNum');
    await prisma.claimproc.create({
      data: {
        ClaimProcNum: claimProcNum2,
        ProcNum: procNum2,
        ClaimNum: claimNum1,
        PatNum: patNum,
        ProvNum: provNum,
        PlanNum: planNum,
        InsSubNum: insSubNum,
        FeeBilled: 800.0,
        InsPayEst: 640.0,
        Status: 0, // Not received
        CodeSent: 'D2750',
      },
    });
  });

  afterAll(async () => {
    // Cleanup in strict reverse FK dependency order
    await prisma.payment.deleteMany({ where: { PatNum: patNum } });
    await prisma.claimtracking.deleteMany({ where: { ClaimNum: claimNum1 } });
    await prisma.claimproc.deleteMany({ where: { ClaimNum: claimNum1 } });
    await prisma.claim.deleteMany({ where: { ClaimNum: claimNum1 } });
    await prisma.procedurelog.deleteMany({ where: { ProcNum: { in: [procNum1, procNum2] } } });
    await prisma.patplan.deleteMany({ where: { PatPlanNum: patPlanNum } });
    await prisma.inssub.deleteMany({ where: { InsSubNum: insSubNum } });
    await prisma.insplan.deleteMany({ where: { PlanNum: planNum } });
    await prisma.carrier.deleteMany({ where: { CarrierNum: carrierNum } });
    await prisma.provider.deleteMany({ where: { ProvNum: provNum } });
    await prisma.$executeRawUnsafe('DELETE FROM famaging WHERE "PatNum" = $1', patNum);
    await prisma.patient.deleteMany({ where: { PatNum: patNum } });

    if (createdEtransNums.length > 0) {
      await prisma.etrans.deleteMany({ where: { EtransNum: { in: createdEtransNums } } });
    }
    if (createdClaimPaymentNums.length > 0) {
      await prisma.claimpayment.deleteMany({ where: { ClaimPaymentNum: { in: createdClaimPaymentNums } } });
    }
  });

  it('should accurately parse an X12 835 ERA string', () => {
    const raw835 = [
      'ISA*00*          *00*          *ZZ*DELTA          *ZZ*MEDFLOW        *260314*1430*U*00501*000000001*0*P*:~',
      'GS*HP*DELTA*MEDFLOW*20260314*1430*1*X*005010X221A1~',
      'ST*835*0001~',
      'BPR*I*750.00*C*ACH*CTX*01*123456789*DA*987654321*1234567890**01*999999999*DA*111111111*20260314~',
      'TRN*1*CHK12345678*1234567890~',
      'N1*PR*Delta Dental Insurance*XV*00123~',
      `CLP*${claimNum1}*1*1000.00*750.00*50.00*MC*ICN99887766*11~`,
      'NM1*QC*1*EraTester*John****MI*SUB123456789~',
      'SVC*AD:D0120*200.00*150.00****1~',
      'DTM*472*20260301~',
      'CAS*CO*45*30.00*1~',
      'CAS*PR*1*20.00*1~',
      'SVC*AD:D2750*800.00*600.00****1~',
      'DTM*472*20260301~',
      'CAS*CO*45*170.00*1~',
      'CAS*PR*1*30.00*1~',
      'CLP*UNMATCHED-9999*4*500.00*0.00*0.00*MC*ICN00000000*11~',
      'NM1*QC*1*Ghost*Casper****MI*GHOST123~',
      'CAS*CO*96*500.00*1~',
      'SE*19*0001~',
      'GE*1*1~',
      'IEA*1*000000001~',
    ].join('\n');

    const parsed = era835Service.parse835Content(raw835);

    expect(parsed.totalPaymentAmount).toBe(750.0);
    expect(parsed.paymentMethod).toBe('ACH');
    expect(parsed.traceNumber).toBe('CHK12345678');
    expect(parsed.payerName).toBe('Delta Dental Insurance');
    expect(parsed.payerId).toBe('00123');
    expect(parsed.checkDate).toBe('2026-03-14');

    expect(parsed.claims).toHaveLength(2);

    // Claim 1
    const c1 = parsed.claims[0];
    expect(c1.claimIdentifier).toBe(claimNum1.toString());
    expect(c1.totalChargeAmount).toBe(1000.0);
    expect(c1.totalPaymentAmount).toBe(750.0);
    expect(c1.patientResponsibility).toBe(50.0);
    expect(c1.payerControlNumber).toBe('ICN99887766');
    expect(c1.patientLastName).toBe('EraTester');
    expect(c1.patientFirstName).toBe('John');
    expect(c1.serviceLines).toHaveLength(2);

    // Service line 1 (D0120)
    expect(c1.serviceLines[0].procedureCode).toBe('D0120');
    expect(c1.serviceLines[0].billedAmount).toBe(200.0);
    expect(c1.serviceLines[0].paidAmount).toBe(150.0);
    expect(c1.serviceLines[0].writeOff).toBe(30.0); // CO-45
    expect(c1.serviceLines[0].deductible).toBe(20.0); // PR-1

    // Service line 2 (D2750)
    expect(c1.serviceLines[1].procedureCode).toBe('D2750');
    expect(c1.serviceLines[1].billedAmount).toBe(800.0);
    expect(c1.serviceLines[1].paidAmount).toBe(600.0);
    expect(c1.serviceLines[1].writeOff).toBe(170.0); // CO-45
    expect(c1.serviceLines[1].deductible).toBe(30.0); // PR-1

    // Claim 2 (Denied / Unmatched)
    const c2 = parsed.claims[1];
    expect(c2.claimIdentifier).toBe('UNMATCHED-9999');
    expect(c2.claimStatusCode).toBe('4');
    expect(c2.totalPaymentAmount).toBe(0);
    expect(c2.writeOff).toBe(0);
    expect(c2.adjustments).toEqual([{ groupCode: 'CO', reasonCode: '96', amount: 500.0 }]);
  });

  it('should match claims against database and identify unmatched claims', async () => {
    const raw835 = [
      'ISA*00*          *00*          *ZZ*DELTA          *ZZ*MEDFLOW        *260314*1430*U*00501*000000001*0*P*:~',
      'GS*HP*DELTA*MEDFLOW*20260314*1430*1*X*005010X221A1~',
      'ST*835*0001~',
      'BPR*I*750.00*C*ACH*CTX*01*123456789*DA*987654321*1234567890**01*999999999*DA*111111111*20260314~',
      'TRN*1*CHK12345678*1234567890~',
      'N1*PR*Delta Dental Insurance*XV*00123~',
      `CLP*${claimNum1}*1*1000.00*750.00*50.00*MC*ICN99887766*11~`,
      'NM1*QC*1*EraTester*John****MI*SUB123456789~',
      'SVC*AD:D0120*200.00*150.00****1~',
      'SVC*AD:D2750*800.00*600.00****1~',
      'CLP*UNMATCHED-9999*4*500.00*0.00*0.00*MC*ICN00000000*11~',
      'NM1*QC*1*Ghost*Casper****MI*GHOST123~',
      'SE*13*0001~',
      'GE*1*1~',
      'IEA*1*000000001~',
    ].join('\n');

    const parsed = era835Service.parse835Content(raw835);
    const matched = await era835Service.matchClaims(parsed);

    expect(matched.claims[0].status).toBe('matched');
    expect(matched.claims[0].matchedClaimId).toBe(claimNum1.toString());

    expect(matched.claims[1].status).toBe('unmatched');
    expect(matched.claims[1].unmatchedReason).toContain('not found in database');
  });

  it('should auto-post payments into claimproc, claim, claimpayment, and patient ledger', async () => {
    const raw835 = [
      'ISA*00*          *00*          *ZZ*DELTA          *ZZ*MEDFLOW        *260314*1430*U*00501*000000001*0*P*:~',
      'GS*HP*DELTA*MEDFLOW*20260314*1430*1*X*005010X221A1~',
      'ST*835*0001~',
      'BPR*I*750.00*C*ACH*CTX*01*123456789*DA*987654321*1234567890**01*999999999*DA*111111111*20260314~',
      'TRN*1*CHK-POST-01*1234567890~',
      'N1*PR*Delta Dental AutoPost*XV*00123~',
      `CLP*${claimNum1}*1*1000.00*750.00*50.00*MC*ICN-POST-01*11~`,
      'NM1*QC*1*EraTester*John****MI*SUB123456789~',
      'SVC*AD:D0120*200.00*150.00****1~',
      'DTM*472*20260301~',
      'CAS*CO*45*30.00*1~',
      'CAS*PR*1*20.00*1~',
      'SVC*AD:D2750*800.00*600.00****1~',
      'DTM*472*20260301~',
      'CAS*CO*45*170.00*1~',
      'CAS*PR*1*30.00*1~',
      'CLP*UNMATCHED-9999*4*500.00*0.00*0.00*MC*ICN00000000*11~',
      'SE*17*0001~',
      'GE*1*1~',
      'IEA*1*000000001~',
    ].join('\n');

    const parsed = era835Service.parse835Content(raw835);
    const matched = await era835Service.matchClaims(parsed);

    const postResult = await era835Service.autoPostClaimPayments(matched);
    expect(postResult.postedCount).toBe(1);
    expect(postResult.unmatchedCount).toBe(1);

    // 1. Verify ClaimProcs updated
    const updatedCps = await prisma.claimproc.findMany({
      where: { ClaimNum: claimNum1 },
      orderBy: { FeeBilled: 'asc' },
    });

    expect(updatedCps).toHaveLength(2);

    // D0120 line
    const cp1 = updatedCps[0];
    expect(cp1.Status).toBe(1); // Received
    expect(cp1.InsPayAmt).toBe(150.0);
    expect(cp1.WriteOff).toBe(30.0);
    expect(cp1.DedApplied).toBe(20.0);
    expect(cp1.Remarks).toContain('CO-45: $30; PR-1: $20');
    expect(cp1.ClaimAdjReasonCodes).toBe('CO-45: $30; PR-1: $20');
    expect(cp1.ClaimPaymentNum).not.toBeNull();
    if (cp1.ClaimPaymentNum) createdClaimPaymentNums.push(cp1.ClaimPaymentNum);

    // D2750 line
    const cp2 = updatedCps[1];
    expect(cp2.Status).toBe(1); // Received
    expect(cp2.InsPayAmt).toBe(600.0);
    expect(cp2.WriteOff).toBe(170.0);
    expect(cp2.DedApplied).toBe(30.0);
    expect(cp2.Remarks).toContain('CO-45: $170; PR-1: $30');
    expect(cp2.ClaimAdjReasonCodes).toBe('CO-45: $170; PR-1: $30');

    // 2. Verify Claim updated
    const updatedClaim = await prisma.claim.findUnique({
      where: { ClaimNum: claimNum1 },
    });
    expect(updatedClaim?.ClaimStatus).toBe('R');
    expect(updatedClaim?.InsPayAmt).toBe(750.0);
    expect(updatedClaim?.WriteOff).toBe(200.0);
    expect(updatedClaim?.DedApplied).toBe(50.0);
    expect(updatedClaim?.DateReceived).not.toBeNull();

    // 3. Verify ClaimPayment batch record
    const claimPayment = await prisma.claimpayment.findUnique({
      where: { ClaimPaymentNum: cp1.ClaimPaymentNum! },
    });
    expect(claimPayment).not.toBeNull();
    expect(claimPayment?.CheckAmt).toBe(750.0);
    expect(claimPayment?.CheckNum).toBe('CHK-POST-01');
    expect(claimPayment?.CarrierName).toBe('Delta Dental AutoPost');

    // 4. Verify Patient Payment record
    const patPayment = await prisma.payment.findFirst({
      where: { PatNum: patNum },
    });
    expect(patPayment).not.toBeNull();
    expect(patPayment?.PayAmt).toBe(750.0);
    const payNote = JSON.parse(patPayment?.PayNote || '{}');
    expect(payNote.claimId).toBe(claimNum1.toString());
    expect(payNote.checkNum).toBe('CHK-POST-01');
  });

  it('should support full file upload flow and auto-posting via EraService', async () => {
    const raw835 = [
      'ISA*00*          *00*          *ZZ*DELTA          *ZZ*MEDFLOW        *260314*1430*U*00501*000000001*0*P*:~',
      'GS*HP*DELTA*MEDFLOW*20260314*1430*1*X*005010X221A1~',
      'ST*835*0001~',
      'BPR*I*750.00*C*ACH*CTX*01*123456789*DA*987654321*1234567890**01*999999999*DA*111111111*20260314~',
      'TRN*1*CHK-FILE-99*1234567890~',
      'N1*PR*Delta File Import*XV*99881~',
      `CLP*${claimNum1}*1*1000.00*750.00*50.00*MC*ICN-FILE-01*11~`,
      'NM1*QC*1*EraTester*John****MI*SUB123456789~',
      'SVC*AD:D0120*200.00*150.00****1~',
      'SVC*AD:D2750*800.00*600.00****1~',
      'SE*11*0001~',
      'GE*1*1~',
      'IEA*1*000000001~',
    ].join('\n');

    const fakeMulterFile = {
      buffer: Buffer.from(raw835, 'utf8'),
      originalname: 'test_era_delta.835',
      mimetype: 'application/octet-stream',
    } as Express.Multer.File;

    const importResult = await eraService.importERAFile(fakeMulterFile);
    expect(importResult.eraId).toBeDefined();
    createdEtransNums.push(BigInt(importResult.eraId));

    expect(importResult.totalRecords).toBe(1);
    expect(importResult.matchedCount).toBe(1);
    expect(importResult.unmatchedCount).toBe(0);
    expect(importResult.totalAmount).toBe(750.0);

    // Now auto-post payments via eraService
    const postResult = await eraService.autoPostPayments(importResult.eraId);
    expect(postResult.postedCount).toBe(1);
    expect(postResult.message).toContain('Successfully posted 1 payment(s)');

    // Verify ERA record status updated to processed
    const eraRecord = await eraService.getERAById(importResult.eraId);
    expect(eraRecord.status).toBe('processed');
    expect(eraRecord.postedCount).toBe(1);
  });
});
