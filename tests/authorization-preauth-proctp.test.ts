import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../src/config/db';
import { authorizationService } from '../src/services/authorization.service';
import { treatmentPlanService } from '../src/services/treatment-plan.service';
import { getNextId } from '../src/utils/opendental-ids.util';

describe('Phase 3: Pre-Auth Financials from proctp and Provider Resolution', () => {
  let patNum: bigint;
  let clinicNum: bigint;
  let treatingProvNum: bigint;
  let billingProvNum: bigint;
  let carrierNum: bigint;
  let planNum: bigint;
  let insSubNum: bigint;
  let patPlanNum: bigint;
  let treatPlanNum: bigint;
  const createdClaimNums: bigint[] = [];

  beforeAll(async () => {
    // 1. Billing Provider
    billingProvNum = await getNextId('provider', 'ProvNum');
    await prisma.provider.create({
      data: {
        ProvNum: billingProvNum,
        Abbr: 'BILLPROV',
        LName: 'BillingEntity',
        FName: 'Clinic',
        NationalProvID: '1234567893',
      },
    });

    // 2. Treating Provider
    treatingProvNum = await getNextId('provider', 'ProvNum');
    await prisma.provider.create({
      data: {
        ProvNum: treatingProvNum,
        Abbr: 'TREATPROV',
        LName: 'TreatingDentist',
        FName: 'Sarah',
        NationalProvID: '1234567893',
      },
    });

    // 3. Clinic with InsBillingProv configured
    clinicNum = await getNextId('clinic', 'ClinicNum');
    await prisma.clinic.create({
      data: {
        ClinicNum: clinicNum,
        Description: 'Specialty Dental Clinic',
        InsBillingProv: billingProvNum,
      },
    });

    // 4. Patient assigned to clinic
    patNum = await getNextId('patient', 'PatNum');
    await prisma.patient.create({
      data: {
        PatNum: patNum,
        FName: 'PreAuth',
        LName: 'Tester',
        Birthdate: new Date('1990-05-20'),
        ClinicNum: clinicNum,
      },
    });

    // 5. Carrier, InsPlan, InsSub, PatPlan (active)
    carrierNum = await getNextId('carrier', 'CarrierNum');
    const uniqueElect = `E${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 1000)}`;
    await prisma.carrier.create({
      data: {
        CarrierNum: carrierNum,
        CarrierName: 'Delta Dental PPO',
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
        SubscriberID: 'PRESUB987654',
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

    // 6. Treatment Plan with proctp relational items
    const tp = await treatmentPlanService.createTreatmentPlan({
      patientId: patNum.toString(),
      title: 'Restorative Treatment Plan',
      items: [
        {
          procedureCode: 'D2750',
          description: 'Crown - Porcelain Fused to High Noble Metal',
          tooth: '14',
          surface: 'MOD',
          fee: 1000.0,
          insuranceEstimate: 800.0,
          patientPortion: 200.0,
          providerId: treatingProvNum.toString(),
        },
        {
          procedureCode: 'D2950',
          description: 'Core Buildup, Including Any Pins',
          tooth: '14',
          fee: 300.0,
          insuranceEstimate: 240.0,
          patientPortion: 60.0,
          providerId: treatingProvNum.toString(),
        },
      ],
    });
    treatPlanNum = BigInt(tp._id || tp.id);
  });

  afterAll(async () => {
    if (createdClaimNums.length > 0) {
      await prisma.claimtracking.deleteMany({ where: { ClaimNum: { in: createdClaimNums } } });
      await prisma.claimproc.deleteMany({ where: { ClaimNum: { in: createdClaimNums } } });
      await prisma.claim.deleteMany({ where: { ClaimNum: { in: createdClaimNums } } });
    }
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

  it('creates pre-authorization with real numeric financials from proctp and resolves providers independently', async () => {
    const proctpRows = await prisma.proctp.findMany({
      where: { TreatPlanNum: treatPlanNum },
      orderBy: { ItemOrder: 'asc' },
    });
    expect(proctpRows).toHaveLength(2);

    // Create authorization passing procedures matching the proctp items
    const authResult = await authorizationService.createAuthorization({
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
      notes: 'Pre-auth requested for crown and core buildup',
    });

    expect(authResult.id).toBeDefined();
    const claimNum = BigInt(authResult.id);
    createdClaimNums.push(claimNum);

    // Fetch the claim from database to verify financials and non-billing status
    const claim = await prisma.claim.findUnique({
      where: { ClaimNum: claimNum },
    });

    expect(claim).not.toBeNull();
    // 1. Exact numeric totals from proctp
    expect(claim?.ClaimFee).toBe(1300.0); // 1000 + 300
    expect(claim?.InsPayEst).toBe(1040.0); // 800 + 240
    expect(claim?.DedApplied).toBe(260.0); // 200 + 60
    expect(claim?.InsPayAmt).toBe(0); // Non-billing, no payment

    // 2. Independent provider resolution:
    // Treating should be Sarah (treatingProvNum from proctp item)
    // Billing should be Clinic billing entity (billingProvNum from clinic.InsBillingProv)
    expect(claim?.ProvTreat).toBe(treatingProvNum);
    expect(claim?.ProvBill).toBe(billingProvNum);
    expect(claim?.ProvTreat).not.toBe(claim?.ProvBill);

    // 3. Strict Non-Billing isolation:
    expect(claim?.ClaimType).toBe('PreAuth');
    expect(claim?.PlanNum).toBe(planNum);
    expect(claim?.InsSubNum).toBe(insSubNum);

    // Zero billing claimproc rows created
    const claimprocs = await prisma.claimproc.findMany({
      where: { ClaimNum: claimNum },
    });
    expect(claimprocs).toHaveLength(0);

    // Zero payment ledger rows created
    const payments = await prisma.payment.findMany({
      where: { PatNum: patNum },
    });
    expect(payments).toHaveLength(0);
  });

  it('updates pre-authorization recalculating totals when procedures change', async () => {
    const proctpRows = await prisma.proctp.findMany({
      where: { TreatPlanNum: treatPlanNum },
      orderBy: { ItemOrder: 'asc' },
    });

    // Update with only the crown item (1000 fee, 800 insEst)
    const crownItem = proctpRows[0];
    const claimNum = createdClaimNums[0];

    const updated = await authorizationService.updateAuthorization(claimNum.toString(), {
      notes: 'Updated to single crown procedure',
      procedures: [
        {
          id: crownItem.ProcTPNum.toString(),
          code: crownItem.ProcCode,
          fee: crownItem.FeeAmt,
          priInsAmt: crownItem.PriInsAmt,
          patAmt: crownItem.PatAmt,
          providerId: crownItem.ProvNum?.toString(),
        },
      ],
    });

    expect(updated.id).toBe(claimNum.toString());

    const claim = await prisma.claim.findUnique({
      where: { ClaimNum: claimNum },
    });

    expect(claim?.ClaimFee).toBe(1000.0);
    expect(claim?.InsPayEst).toBe(800.0);
    expect(claim?.DedApplied).toBe(200.0);
    expect(claim?.ClaimType).toBe('PreAuth');
  });
});
