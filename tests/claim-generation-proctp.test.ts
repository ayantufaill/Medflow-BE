import { describe, it, expect } from 'vitest';
import { prisma } from '../src/config/db.js';
import { treatmentPlanService } from '../src/services/treatment-plan.service.js';
import { claimService } from '../src/services/claim.service.js';
import { getNextId } from '../src/utils/opendental-ids.util.js';
import { uniqueToken } from './helpers/unique.js';
import { createPatientRecord } from './helpers/fixtures.js';

describe('Phase 3: Claim Generation Reads from proctp and Creates claimproc Rows', () => {
  it('generates claim with exact totals from proctp and creates real claimproc rows', async () => {
    const token = uniqueToken('claim-gen');
    const alphanumeric = token.replace(/[^A-Za-z0-9]/g, '');
    const patient = await createPatientRecord(alphanumeric);

    // Create provider
    const provNum = await getNextId('provider', 'ProvNum');
    const provAbbr = `P${alphanumeric.slice(-6)}`;
    await prisma.provider.create({
      data: { ProvNum: provNum, Abbr: provAbbr, FName: 'Claim', LName: 'Doctor' },
    });

    // Create carrier, plan, sub, patplan
    const carrierNum = await getNextId('carrier', 'CarrierNum');
    await prisma.carrier.create({
      data: { CarrierNum: carrierNum, CarrierName: `Carrier-${alphanumeric}`, ElectID: `C${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 1000)}` },
    });

    const planNum = await getNextId('insplan', 'PlanNum');
    await prisma.insplan.create({ data: { PlanNum: planNum, CarrierNum: carrierNum } });

    const subNum = await getNextId('inssub', 'InsSubNum');
    await prisma.inssub.create({
      data: { InsSubNum: subNum, PlanNum: planNum, Subscriber: patient.PatNum, SubscriberID: `S-${alphanumeric}` },
    });

    const patPlanNum = await getNextId('patplan', 'PatPlanNum');
    await prisma.patplan.create({
      data: { PatPlanNum: patPlanNum, PatNum: patient.PatNum, InsSubNum: subNum, Ordinal: 1, Relationship: 0, IsPending: 0 },
    });

    // Create treatment plan with 2 procedures with specific fees
    const tp = await treatmentPlanService.createTreatmentPlan({
      patientId: patient.PatNum.toString(),
      title: 'Comprehensive Restorative Plan',
      status: 'P',
      items: [
        {
          procedureCode: 'D2750',
          description: 'Crown',
          tooth: '14',
          fee: 850,
          status: 'A',
          provider: provAbbr,
        },
        {
          procedureCode: 'D2391',
          description: 'Resin 1 surface',
          tooth: '15',
          fee: 150,
          status: 'A',
          provider: provAbbr,
        },
      ],
    });

    // Accepted items
    const accepted = tp.items.filter((i: any) => i.status === 'A');
    expect(accepted.length).toBe(2);

    // Generate claim
    const claim = await claimService.createClaimFromTreatmentPlan(
      tp._id,
      patient.PatNum.toString(),
      accepted,
      carrierNum.toString(),
      'Primary'
    );

    expect(claim).toBeDefined();
    expect(claim.id).toBeDefined();

    // Verify claim row in DB
    const claimRow = await prisma.claim.findUnique({
      where: { ClaimNum: BigInt(claim.id) },
    });
    expect(claimRow).not.toBeNull();
    // Sum of fees: 850 + 150 = 1000
    expect(claimRow?.ClaimFee).toBe(1000);
    expect(claimRow?.ProvTreat).toBe(provNum);
    expect(claimRow?.ProvBill).toBe(provNum);

    // Verify real claimproc rows created
    const claimprocs = await prisma.claimproc.findMany({
      where: { ClaimNum: BigInt(claim.id) },
      orderBy: { ClaimProcNum: 'asc' },
    });

    expect(claimprocs.length).toBe(2);
    expect(claimprocs[0].FeeBilled).toBe(850);
    expect(claimprocs[0].Status).toBe(0); // NotReceived (Estimate)
    expect(claimprocs[0].ProvNum).toBe(provNum);
    expect(claimprocs[0].ProcNum).not.toBeNull(); // Linked to real procedurelog!

    expect(claimprocs[1].FeeBilled).toBe(150);
    expect(claimprocs[1].ProvNum).toBe(provNum);
    expect(claimprocs[1].ProcNum).not.toBeNull();

    // Verify proctp has ProcNumOrig set
    const proctpRows = await prisma.proctp.findMany({
      where: { TreatPlanNum: BigInt(tp._id) },
      orderBy: { ItemOrder: 'asc' },
    });
    expect(proctpRows[0].ProcNumOrig).toBe(claimprocs[0].ProcNum);
    expect(proctpRows[1].ProcNumOrig).toBe(claimprocs[1].ProcNum);

    // Clean up
    await prisma.claimtracking.deleteMany({ where: { ClaimNum: BigInt(claim.id) } });
    await prisma.claimproc.deleteMany({ where: { ClaimNum: BigInt(claim.id) } });
    await prisma.claim.delete({ where: { ClaimNum: BigInt(claim.id) } });
    await treatmentPlanService.deleteTreatmentPlan(tp._id);
    await prisma.procedurelog.deleteMany({
      where: { ProcNum: { in: [claimprocs[0].ProcNum!, claimprocs[1].ProcNum!] } },
    });
    await prisma.patplan.delete({ where: { PatPlanNum: patPlanNum } });
    await prisma.inssub.delete({ where: { InsSubNum: subNum } });
    await prisma.insplan.delete({ where: { PlanNum: planNum } });
    await prisma.carrier.delete({ where: { CarrierNum: carrierNum } });
    await prisma.provider.delete({ where: { ProvNum: provNum } });
    await prisma.patient.delete({ where: { PatNum: patient.PatNum } });
  });

  it('rejects empty items with a clear validation error rather than generating a $0 claim', async () => {
    const token = uniqueToken('claim-empty');
    const alphanumeric = token.replace(/[^A-Za-z0-9]/g, '');
    const patient = await createPatientRecord(alphanumeric);

    const tp = await treatmentPlanService.createTreatmentPlan({
      patientId: patient.PatNum.toString(),
      title: 'Empty Planned Items',
      status: 'P',
      items: [],
    });

    await expect(
      claimService.createClaimFromTreatmentPlan(
        tp._id,
        patient.PatNum.toString(),
        [],
        '1',
        'Primary'
      )
    ).rejects.toThrow('No accepted procedures found to generate a claim');

    await treatmentPlanService.deleteTreatmentPlan(tp._id);
    await prisma.patient.delete({ where: { PatNum: patient.PatNum } });
  });
});
