import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/config/db';
import { authorizationService } from '../src/services/authorization.service';
import { edi837Service } from '../src/services/edi837.service';
import { treatmentPlanService } from '../src/services/treatment-plan.service';
import { getNextId } from '../src/utils/opendental-ids.util';

describe('Phase 4: 837D Dental Predetermination Generator & Golden Comparison', () => {
  let patNum: bigint;
  let clinicNum: bigint;
  let treatingProvNum: bigint;
  let billingProvNum: bigint;
  let carrierNum: bigint;
  let planNum: bigint;
  let insSubNum: bigint;
  let patPlanNum: bigint;
  let treatPlanNum: bigint;
  let preAuthClaimNum: bigint;
  let billingClaimNum: bigint;
  let procNum1: bigint;
  const createdEtransNums: bigint[] = [];

  beforeAll(async () => {
    // 1. Billing Provider
    billingProvNum = await getNextId('provider', 'ProvNum');
    await prisma.provider.create({
      data: {
        ProvNum: billingProvNum,
        Abbr: 'BILLPRE',
        LName: 'PreAuthBilling',
        FName: 'Entity',
        NationalProvID: '1234567893',
      },
    });

    // 2. Treating Provider
    treatingProvNum = await getNextId('provider', 'ProvNum');
    await prisma.provider.create({
      data: {
        ProvNum: treatingProvNum,
        Abbr: 'TREATPRE',
        LName: 'PreAuthTreating',
        FName: 'Doctor',
        NationalProvID: '1234567893',
      },
    });

    // 3. Clinic
    clinicNum = await getNextId('clinic', 'ClinicNum');
    await prisma.clinic.create({
      data: {
        ClinicNum: clinicNum,
        Description: 'Predetermination Dental Center',
        InsBillingProv: billingProvNum,
      },
    });

    // 4. Patient
    patNum = await getNextId('patient', 'PatNum');
    await prisma.patient.create({
      data: {
        PatNum: patNum,
        FName: 'Edward',
        LName: 'PredetTester',
        Birthdate: new Date('1985-04-12'),
        ClinicNum: clinicNum,
      },
    });

    // 5. Carrier, InsPlan, InsSub, PatPlan
    carrierNum = await getNextId('carrier', 'CarrierNum');
    const uniqueElect = `E${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 1000)}`;
    await prisma.carrier.create({
      data: {
        CarrierNum: carrierNum,
        CarrierName: 'Aetna Dental PPO',
        ElectID: uniqueElect,
      },
    });

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
        SubscriberID: 'PREDET123456',
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

    // 6. Treatment Plan with proctp items
    const tp = await treatmentPlanService.createTreatmentPlan({
      patientId: patNum.toString(),
      title: 'Predetermination Test Plan',
      items: [
        {
          procedureCode: 'D2750',
          description: 'Crown',
          tooth: '14',
          surface: 'MOD',
          fee: 950.0,
          insuranceEstimate: 760.0,
          patientPortion: 190.0,
          providerId: treatingProvNum.toString(),
        },
      ],
    });
    treatPlanNum = BigInt(tp._id || tp.id);

    // 7. Create PreAuth Claim via authorizationService
    const proctpRows = await prisma.proctp.findMany({
      where: { TreatPlanNum: treatPlanNum },
    });

    const auth = await authorizationService.createAuthorization({
      patientId: patNum.toString(),
      insuranceCompanyId: carrierNum.toString(),
      status: 'requested',
      order: 'Primary',
      procedures: proctpRows.map((r) => ({
        id: r.ProcTPNum.toString(),
        code: r.ProcCode,
        fee: r.FeeAmt,
        priInsAmt: r.PriInsAmt,
        patAmt: r.PatAmt,
        providerId: r.ProvNum?.toString(),
      })),
      notes: 'Please predetermine benefits for D2750',
    });
    preAuthClaimNum = BigInt(auth.id);

    // 8. Create a standard billing claim with real completed procedurelog and claimproc for comparison
    procNum1 = await getNextId('procedurelog', 'ProcNum');
    await prisma.procedurelog.create({
      data: {
        ProcNum: procNum1,
        PatNum: patNum,
        ProvNum: treatingProvNum,
        ProcDate: new Date('2026-03-01'),
        ProcFee: 950.0,
        ProcStatus: 2,
        OldCode: 'D2750',
      },
    });

    billingClaimNum = await getNextId('claim', 'ClaimNum');
    await prisma.claim.create({
      data: {
        ClaimNum: billingClaimNum,
        PatNum: patNum,
        PlanNum: planNum,
        InsSubNum: insSubNum,
        ProvTreat: treatingProvNum,
        ProvBill: billingProvNum,
        ClaimFee: 950.0,
        InsPayEst: 760.0,
        ClaimStatus: 'W',
        ClaimType: 'P', // Standard Primary Billing Claim
        DateService: new Date('2026-03-01'),
        ClaimIdentifier: `BILLING-${billingClaimNum}`,
      },
    });

    const cpNum = await getNextId('claimproc', 'ClaimProcNum');
    await prisma.claimproc.create({
      data: {
        ClaimProcNum: cpNum,
        ClaimNum: billingClaimNum,
        ProcNum: procNum1,
        PatNum: patNum,
        ProvNum: treatingProvNum,
        PlanNum: planNum,
        InsSubNum: insSubNum,
        FeeBilled: 950.0,
        InsPayEst: 760.0,
        Status: 0,
        CodeSent: 'D2750',
      },
    });
  });

  afterAll(async () => {
    if (createdEtransNums.length > 0) {
      await prisma.etrans.deleteMany({ where: { EtransNum: { in: createdEtransNums } } });
    }
    await prisma.claimproc.deleteMany({ where: { ClaimNum: billingClaimNum } });
    await prisma.claimtracking.deleteMany({ where: { ClaimNum: { in: [preAuthClaimNum, billingClaimNum] } } });
    await prisma.claim.deleteMany({ where: { ClaimNum: { in: [preAuthClaimNum, billingClaimNum] } } });
    await prisma.procedurelog.deleteMany({ where: { ProcNum: procNum1 } });
    await prisma.proctp.deleteMany({ where: { TreatPlanNum: treatPlanNum } });
    await prisma.treatplan.deleteMany({ where: { TreatPlanNum: treatPlanNum } });
    await prisma.patplan.deleteMany({ where: { PatPlanNum: patPlanNum } });
    await prisma.inssub.deleteMany({ where: { InsSubNum: insSubNum } });
    await prisma.insplan.deleteMany({ where: { PlanNum: planNum } });
    await prisma.carrier.deleteMany({ where: { CarrierNum: carrierNum } });
    await prisma.patient.deleteMany({ where: { PatNum: patNum } });
    await prisma.clinic.deleteMany({ where: { ClinicNum: clinicNum } });
    await prisma.provider.deleteMany({ where: { ProvNum: { in: [treatingProvNum, billingProvNum] } } });
  });

  it('generates 837D predetermination EDI with correct semantics and Etype 2', async () => {
    const result = await edi837Service.generate837D(preAuthClaimNum);
    expect(result.etransNum).toBeDefined();
    createdEtransNums.push(BigInt(result.etransNum));

    const x12Text = result.x12Text;

    // 1. Verify BHT segment contains predetermination transaction type 'TH'
    expect(x12Text).toContain('BHT*0019*00*');
    expect(x12Text).toMatch(/BHT\*0019\*00\*[^*]+\*[^*]+\*[^*]+\*TH~/);

    // 2. Verify CLM segment contains Claim Frequency Code '5' (Predetermination) and exact fee
    expect(x12Text).toMatch(/CLM\*[^*]+\*950\.00\*\*\*11:B:5\*Y\*A\*Y\*Y~/);

    // 3. Verify SV3 line item generated from proctp (without any billing claimproc rows)
    expect(x12Text).toContain('SV3*AD:D2750*950.00*11***1~');

    // 4. Verify etrans record stored with Etype 2 (Claim_PreAuth)
    const etrans = await prisma.etrans.findUnique({
      where: { EtransNum: BigInt(result.etransNum) },
    });
    expect(etrans?.Etype).toBe(2);
    expect(etrans?.Note).toContain('Predetermination');

    // 5. Verify claim status was NOT set to 'S' (sent billing claim)
    const claim = await prisma.claim.findUnique({
      where: { ClaimNum: preAuthClaimNum },
    });
    expect(claim?.ClaimStatus).not.toBe('S');
    expect(claim?.ClaimType).toBe('PreAuth');

    // 6. Verify text retrievable via get837DText
    const retrievedText = await edi837Service.get837DText(preAuthClaimNum);
    expect(retrievedText).toBe(x12Text);
  });

  it('golden comparison: predetermination 837D differs correctly from standard billing 837D', async () => {
    // Generate billing claim 837D with markAsSent = true
    const billingResult = await edi837Service.generate837D(billingClaimNum, undefined, true);
    expect(billingResult.etransNum).toBeDefined();
    createdEtransNums.push(BigInt(billingResult.etransNum));

    const billingText = billingResult.x12Text;

    // 1. Billing claim has BHT with 'CH' (Chargeable), PreAuth has 'TH' (Predetermination)
    expect(billingText).toMatch(/BHT\*0019\*00\*[^*]+\*[^*]+\*[^*]+\*CH~/);

    // 2. Billing claim has CLM with '11:B:1' (Original Claim), PreAuth has '11:B:5' (Predetermination)
    expect(billingText).toMatch(/CLM\*[^*]+\*950\.00\*\*\*11:B:1\*Y\*A\*Y\*Y~/);

    // 3. Billing claim etrans has Etype 1 (ClaimSent), PreAuth has Etype 2 (Claim_PreAuth)
    const billingEtrans = await prisma.etrans.findUnique({
      where: { EtransNum: BigInt(billingResult.etransNum) },
    });
    expect(billingEtrans?.Etype).toBe(1);

    // 4. Billing claim status transitioned to 'S' (Sent)
    const updatedBillingClaim = await prisma.claim.findUnique({
      where: { ClaimNum: billingClaimNum },
    });
    expect(updatedBillingClaim?.ClaimStatus).toBe('S');
  });
});
