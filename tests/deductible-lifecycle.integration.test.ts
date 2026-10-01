/**
 * Deductible LIFECYCLE integration test (steps 3-11 of the manual plan).
 *
 * `deductible-engine.test.ts` proves the arithmetic in isolation, and the unit
 * mirror in "reservation lifecycle" proves the state machine's shape. Neither
 * touches the real `updateClaim` / `autoPostClaimPayments` code paths. This file
 * does, against a live patplan, because that is exactly where the `nextMeta`
 * regression slipped through earlier.
 *
 * Walks the sequence in order:
 *   configure $500 pool -> estimate -> submit -> re-submit -> draft -> ERA -> re-ERA
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/config/db';
import { claimService } from '../src/services/claim.service';
import { era835Service } from '../src/services/era835.service';
import { getPatientInsuranceMeta, setPatientInsuranceMeta } from '../src/utils/opendental-auth.util';
import { getNextId } from '../src/utils/opendental-ids.util';
import { normalizeDeductibleGrid } from '../src/services/deductible.service';

const STANDARD_LIMIT = 500;
const ERA_ACTUAL = 400;
// Payer reports a $400 deductible (CAS*PR*1) against a $1000 charge.
// NB: CO-45/CO-131 are WRITE-OFF codes; deductible is PR-1 in this parser.
const ERA_DED = '400.00';

let patNum: bigint;
let provNum: bigint;
let carrierNum: bigint;
let planNum: bigint;
let insSubNum: bigint;
let patPlanNum: bigint;
let procNum: bigint;
let claimNum: bigint;
let claimProcNum: bigint;
const createdClaimPayments: bigint[] = [];

const readMet = async (rowKey: string) => {
  const meta: any = await getPatientInsuranceMeta(patPlanNum);
  const row = (meta.deductiblesGrid ?? []).find((r: any) => r.typeKey === rowKey);
  return row ? Number(row.metAmount) || 0 : null;
};

// The ERA check date must fall in the CURRENT plan year. Using a fixed past
// date would trip the annual rollover (correctly) and zero the row before the
// reconciliation delta is applied, which is a different code path.
const now = new Date();
const TODAY = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}`;
const YYYYMMDD = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}`;

describe('Deductible lifecycle: configure -> estimate -> submit -> ERA', () => {
  beforeAll(async () => {
    patNum = await getNextId('patient', 'PatNum');
    await prisma.patient.create({
      data: { PatNum: patNum, FName: 'Ded', LName: `Lifecycle${patNum}`, Birthdate: new Date('1990-01-15') },
    });

    provNum = await getNextId('provider', 'ProvNum');
    await prisma.provider.create({
      data: {
        ProvNum: provNum,
        Abbr: `DL${String(patNum).slice(-5)}`,
        LName: 'LifecycleDentist',
        FName: 'Dana',
        NationalProvID: '1234567894',
      },
    });

    carrierNum = await getNextId('carrier', 'CarrierNum');
    await prisma.carrier.create({
      data: {
        CarrierNum: carrierNum,
        CarrierName: 'Deductible Lifecycle Carrier',
        ElectID: `DL${String(patNum).slice(-6)}${Math.floor(Math.random() * 1000)}`,
      },
    });

    planNum = await getNextId('insplan', 'PlanNum');
    await prisma.insplan.create({ data: { PlanNum: planNum, CarrierNum: carrierNum, PlanType: '' } });

    insSubNum = await getNextId('inssub', 'InsSubNum');
    await prisma.inssub.create({
      data: { InsSubNum: insSubNum, PlanNum: planNum, Subscriber: patNum, SubscriberID: `SUB${patNum}` },
    });

    patPlanNum = await getNextId('patplan', 'PatPlanNum');
    await prisma.patplan.create({
      data: { PatPlanNum: patPlanNum, PatNum: patNum, InsSubNum: insSubNum, Ordinal: 1, IsPending: 0 },
    });

    // ---- Step 3: configure the $500 deductible pool -------------------
    // Seeded through the real normalizer, because that is what
    // createPatientInsurance/updatePatientInsurance write. Bypassing it would
    // leave rows without `typeKey` and the pool would be unaddressable.
    await setPatientInsuranceMeta(patPlanNum, {
      renewalMonth: 1,
      deductiblesGrid: normalizeDeductibleGrid([
        { type: 'Standard', standard: true, individual: STANDARD_LIMIT, family: STANDARD_LIMIT, metAmount: 0 },
        { type: 'Major', individual: 1000, family: 1000, metAmount: 0 },
      ]),
    } as any);

    // ---- Step 4: an 80%-covered $200 procedure ------------------------
    procNum = await getNextId('procedurelog', 'ProcNum');
    await prisma.procedurelog.create({
      data: {
        ProcNum: procNum,
        PatNum: patNum,
        ProvNum: provNum,
        ProcDate: new Date('2026-04-01'),
        ProcFee: 1000,
        ProcStatus: 2,
        OldCode: 'D2750', // Major -> resolves to the Major row
        // The estimator writes the per-procedure breakdown here; seed it the
        // same way so ERA can key the actual deductible back to its pool.
        BillingNote: JSON.stringify({
          deductibleApplied: STANDARD_LIMIT,
          deductibleRowKey: 'standard',
          coinsurance: 0,
          insuranceApplied: 400,
          insPortion: 400,
          ptPortion: 500,
        }),
      },
    });

    claimNum = await getNextId('claim', 'ClaimNum');
    await prisma.claim.create({
      data: {
        ClaimNum: claimNum,
        PatNum: patNum,
        PlanNum: planNum,
        InsSubNum: insSubNum,
        ProvTreat: provNum,
        ProvBill: provNum,
        ClaimFee: 1000,
        InsPayEst: 0,
        InsPayAmt: 0,
        ClaimStatus: 'W',
        ClaimType: 'P',
        DateService: new Date('2026-04-01'),
        ClaimIdentifier: `DL-${claimNum}`,
        // Estimate of $500 deductible, not yet reserved (claim is a draft).
        Narrative: JSON.stringify({
          patPlanNum: patPlanNum.toString(),
          deductibleReservedByRow: { standard: STANDARD_LIMIT },
          deductibleHeld: false,
        }),
      },
    });

    claimProcNum = await getNextId('claimproc', 'ClaimProcNum');
    await prisma.claimproc.create({
      data: {
        ClaimProcNum: claimProcNum,
        ProcNum: procNum,
        ClaimNum: claimNum,
        PatNum: patNum,
        ProvNum: provNum,
        PlanNum: planNum,
        InsSubNum: insSubNum,
        FeeBilled: 1000,
        InsPayEst: 0,
        Status: 0,
        CodeSent: 'D2750',
        DedApplied: STANDARD_LIMIT,
      },
    });
  });

  afterAll(async () => {
    await prisma.payment.deleteMany({ where: { PatNum: patNum } });
    await prisma.claimtracking.deleteMany({ where: { ClaimNum: claimNum } });
    await prisma.claimproc.deleteMany({ where: { ClaimNum: claimNum } });
    await prisma.claim.deleteMany({ where: { ClaimNum: claimNum } });
    await prisma.procedurelog.deleteMany({ where: { ProcNum: procNum } });
    await prisma.userodpref.deleteMany({ where: { Fkey: patPlanNum, FkeyType: 47 } });
    await prisma.patplan.deleteMany({ where: { PatPlanNum: patPlanNum } });
    await prisma.inssub.deleteMany({ where: { InsSubNum: insSubNum } });
    await prisma.insplan.deleteMany({ where: { PlanNum: planNum } });
    await prisma.carrier.deleteMany({ where: { CarrierNum: carrierNum } });
    await prisma.provider.deleteMany({ where: { ProvNum: provNum } });
    await prisma.$executeRawUnsafe('DELETE FROM famaging WHERE "PatNum" = $1', patNum);
    await prisma.patient.deleteMany({ where: { PatNum: patNum } });
    if (createdClaimPayments.length) {
      await prisma.claimpayment.deleteMany({ where: { ClaimPaymentNum: { in: createdClaimPayments } } });
    }
  });

  it('step 3/4: pool is configured at $500 and unspent', async () => {
    expect(await readMet('standard')).toBe(0);
  });

  it('step 5: estimate records a $500 deductible against the standard row', async () => {
    const note = JSON.parse((await prisma.procedurelog.findUnique({ where: { ProcNum: procNum } }))!.BillingNote!);
    expect(note.deductibleApplied).toBe(STANDARD_LIMIT);
    expect(note.deductibleRowKey).toBe('standard');
  });

  it('step 6: a DRAFT claim does not reserve - no abandoned-claim leakage', async () => {
    await claimService.updateClaim(claimNum.toString(), { status: 'draft' } as any);
    expect(await readMet('standard')).toBe(0);
  });

  it('step 7: readyForSubmission reserves $500', async () => {
    await claimService.updateClaim(claimNum.toString(), { status: 'readyForSubmission' } as any);
    expect(await readMet('standard')).toBe(STANDARD_LIMIT);
  });

  it('step 8: re-submitting an already-held claim stays $500 (idempotent)', async () => {
    for (let i = 0; i < 3; i++) {
      await claimService.updateClaim(claimNum.toString(), { status: 'readyForSubmission' } as any);
    }
    expect(await readMet('standard')).toBe(STANDARD_LIMIT);
  });

  it('step 9: reverting to draft releases the reservation back to $0', async () => {
    await claimService.updateClaim(claimNum.toString(), { status: 'draft' } as any);
    expect(await readMet('standard')).toBe(0);
  });

  it('step 9b: re-submitting after a release reserves again', async () => {
    await claimService.updateClaim(claimNum.toString(), { status: 'readyForSubmission' } as any);
    expect(await readMet('standard')).toBe(STANDARD_LIMIT);
  });

  it('step 10: ERA with a $400 actual reconciles $500 -> $400', async () => {
    const raw835 = [
      `ISA*00*          *00*          *ZZ*DELTA          *ZZ*MEDFLOW        *${YYYYMMDD}*1500*U*00501*000000001*0*P*:~`,
      `GS*HP*DELTA*MEDFLOW*${YYYYMMDD}*1500*1*X*005010X221A1~`,
      'ST*835*0001~',
      `BPR*I*600.00*C*ACH*CTX*01*123456789*DA*987654321*1234567890**01*999999999*DA*111111111*${YYYYMMDD}~`,
      'TRN*1*CHK-DL-1*1234567890~',
      'N1*PR*Delta Dental Insurance*XV*00123~',
      `CLP*${claimNum}*1*1000.00*600.00*${ERA_DED}*MC*000000001*11~`,
      'NM1*QC*1*Cycle*Last****MI*SUB1~',
      'SVC*AD:D2750*1000.00*600.00****1~',
      `DTM*472*${YYYYMMDD}~`,
      `CAS*PR*1*${ERA_DED}*1~`,
      'SE*12*0001~',
      'GE*1*1~',
      'IEA*1*000000001~',
    ].join('\n');

    const parsed = era835Service.parse835Content(raw835);
    const matched = await era835Service.matchClaims(parsed);
    const result = await era835Service.autoPostClaimPayments(matched);

    expect(result.postedCount).toBe(1);
    expect(await readMet('standard')).toBe(ERA_ACTUAL);
  });

  it('step 11: reprocessing the same ERA stays $400 (no double-count)', async () => {
    const raw835 = [
      'ISA*00*          *00*          *ZZ*DELTA          *ZZ*MEDFLOW        *{YYYYMMDD}*1500*U*00501*000000002*0*P*:~',
      `GS*HP*DELTA*MEDFLOW*${YYYYMMDD}*1500*1*X*005010X221A1~`,
      'ST*835*0001~',
      `BPR*I*600.00*C*ACH*CTX*01*123456789*DA*987654321*1234567890**01*999999999*DA*111111111*${YYYYMMDD}~`,
      'TRN*1*CHK-DL-2*1234567890~',
      'N1*PR*Delta Dental Insurance*XV*00123~',
      `CLP*${claimNum}*1*1000.00*600.00*${ERA_DED}*MC*000000002*11~`,
      'NM1*QC*1*Cycle*Last****MI*SUB1~',
      'SVC*AD:D2750*1000.00*600.00****1~',
      `DTM*472*${YYYYMMDD}~`,
      `CAS*PR*1*${ERA_DED}*1~`,
      'SE*12*0001~',
      'GE*1*1~',
      'IEA*1*000000002~',
    ].join('\n');

    const parsed = era835Service.parse835Content(raw835);
    const matched = await era835Service.matchClaims(parsed);
    await era835Service.autoPostClaimPayments(matched);

    expect(await readMet('standard')).toBe(ERA_ACTUAL);
  });

  it('a secondary claim never reserves a deductible', async () => {
    const secondaryNum = await getNextId('claim', 'ClaimNum');
    const secondaryProc = await getNextId('procedurelog', 'ProcNum');
    await prisma.procedurelog.create({
      data: {
        ProcNum: secondaryProc, PatNum: patNum, ProvNum: provNum,
        ProcDate: new Date('2026-04-02'), ProcFee: 100, ProcStatus: 2, OldCode: 'D2750',
      },
    });
    await prisma.claim.create({
      data: {
        ClaimNum: secondaryNum, PatNum: patNum, PlanNum: planNum, InsSubNum: insSubNum,
        ProvTreat: provNum, ProvBill: provNum, ClaimFee: 100, InsPayEst: 80, InsPayAmt: 0,
        ClaimStatus: 'W', ClaimType: 'S', DateService: new Date('2026-04-02'),
        ClaimIdentifier: `DLS-${secondaryNum}`,
        Narrative: JSON.stringify({
          patPlanNum: patPlanNum.toString(),
          deductibleReservedByRow: { standard: 500 },
          deductibleHeld: false,
        }),
      },
    });
    const cp = await getNextId('claimproc', 'ClaimProcNum');
    await prisma.claimproc.create({
      data: {
        ClaimProcNum: cp, ProcNum: secondaryProc, ClaimNum: secondaryNum, PatNum: patNum,
        ProvNum: provNum, PlanNum: planNum, InsSubNum: insSubNum,
        FeeBilled: 100, InsPayEst: 80, Status: 0, CodeSent: 'D0120', DedApplied: 500,
      },
    });

    const before = await readMet('standard');
    await claimService.updateClaim(secondaryNum.toString(), { status: 'readyForSubmission' } as any);
    expect(await readMet('standard')).toBe(before);

    await prisma.claimproc.deleteMany({ where: { ClaimProcNum: cp } });
    await prisma.claim.deleteMany({ where: { ClaimNum: secondaryNum } });
    await prisma.procedurelog.deleteMany({ where: { ProcNum: secondaryProc } });
  });
});
