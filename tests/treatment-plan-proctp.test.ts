import { describe, it, expect } from 'vitest';
import { prisma } from '../src/config/db.js';
import { treatmentPlanService } from '../src/services/treatment-plan.service.js';
import { uniqueToken } from './helpers/unique.js';
import { createPatientRecord } from './helpers/fixtures.js';
import { getNextId } from '../src/utils/opendental-ids.util.js';

describe('Phase 2: Relational proctp Treatment Plan Items', () => {
  it('creates treatment plans with real proctp rows and does not store items in Note', async () => {
    const token = uniqueToken('tp-proctp');
    const alphanumericToken = token.replace(/[^A-Za-z0-9]/g, '');
    const patient = await createPatientRecord(alphanumericToken);

    const created = await treatmentPlanService.createTreatmentPlan({
      patientId: patient.PatNum.toString(),
      title: 'Restorative Crown Plan',
      status: 'P',
      items: [
        {
          procedureCode: 'D2750',
          description: 'Crown - porcelain fused to metal',
          tooth: '14',
          site: '#14',
          fee: 850,
          status: 'A',
        },
        {
          procedureCode: 'D0120',
          description: 'Periodic oral evaluation',
          tooth: '',
          fee: 65,
          status: 'P',
        },
      ],
    });

    expect(created._id).toBeDefined();
    expect(created.items.length).toBe(2);
    expect(created.items[0].procedureCode).toBe('D2750');
    expect(created.items[0].tooth).toBe('14');
    expect(created.items[0].fee).toBe('$850.00');

    // Verify in database: treatplan.Note must NOT have items serialized
    const treatPlanRow = await prisma.treatplan.findUnique({
      where: { TreatPlanNum: BigInt(created._id) },
    });
    const parsedNote = JSON.parse(treatPlanRow?.Note || '{}');
    expect(parsedNote.items).toBeUndefined();

    // Verify in database: proctp rows exist relationally
    const proctpRows = await prisma.proctp.findMany({
      where: { TreatPlanNum: BigInt(created._id) },
      orderBy: { ItemOrder: 'asc' },
    });
    expect(proctpRows.length).toBe(2);
    expect(proctpRows[0].ProcCode).toBe('D2750');
    expect(proctpRows[0].FeeAmt).toBe(850);
    expect(proctpRows[0].ItemOrder).toBe(1);
    expect(proctpRows[1].ProcCode).toBe('D0120');
    expect(proctpRows[1].ItemOrder).toBe(2);

    // Clean up
    await treatmentPlanService.deleteTreatmentPlan(created._id);
    await prisma.patient.delete({ where: { PatNum: patient.PatNum } });
  });

  it('restores the dropped link: completing an item creates procedurelog and sets ProcNumOrig', async () => {
    const token = uniqueToken('tp-link');
    const alphanumericToken = token.replace(/[^A-Za-z0-9]/g, '');
    const patient = await createPatientRecord(alphanumericToken);

    // Create provider
    const provNum = await getNextId('provider', 'ProvNum');
    await prisma.provider.create({
      data: {
        ProvNum: provNum,
        Abbr: `DR${alphanumericToken.substring(0, 3)}`,
        FName: 'Test',
        LName: 'Doctor',
      },
    });

    // Create treatment plan with 1 item
    const created = await treatmentPlanService.createTreatmentPlan({
      patientId: patient.PatNum.toString(),
      title: 'Tooth Extraction Plan',
      status: 'P',
      items: [
        {
          procedureCode: 'D7140',
          description: 'Extraction, erupted tooth',
          tooth: '30',
          fee: 250,
          status: 'A',
          provider: `DR${alphanumericToken.substring(0, 3)}`,
        },
      ],
    });

    const initialItem = created.items[0];
    expect(initialItem.procNumOrig).toBeNull();

    // Update the item to Completed ('C')
    const updated = await treatmentPlanService.updateTreatmentPlan(created._id, {
      items: [
        {
          ...initialItem,
          status: 'C',
        },
      ],
    });

    expect(updated.items[0].status).toBe('C');
    expect(updated.items[0].procNumOrig).toBeTruthy();

    const linkedProcNum = BigInt(updated.items[0].procNumOrig);

    // Verify procedurelog was created with this ProcNum
    const procLog = await prisma.procedurelog.findUnique({
      where: { ProcNum: linkedProcNum },
    });
    expect(procLog).not.toBeNull();
    expect(procLog?.PatNum).toBe(patient.PatNum);
    expect(procLog?.OldCode).toBe('D7140');
    expect(procLog?.ProcFee).toBe(250);
    expect(procLog?.ProcStatus).toBe(2); // Complete

    // Verify proctp row has ProcNumOrig saved!
    const proctp = await prisma.proctp.findFirst({
      where: { TreatPlanNum: BigInt(created._id) },
    });
    expect(proctp?.ProcNumOrig).toBe(linkedProcNum);

    // Clean up
    await treatmentPlanService.deleteTreatmentPlan(created._id);
    await prisma.procedurelog.delete({ where: { ProcNum: linkedProcNum } });
    await prisma.provider.delete({ where: { ProvNum: provNum } });
    await prisma.patient.delete({ where: { PatNum: patient.PatNum } });
  });

  it('provides backwards compatibility: reads legacy plans from Note JSON when proctp has no rows', async () => {
    const token = uniqueToken('tp-legacy');
    const alphanumericToken = token.replace(/[^A-Za-z0-9]/g, '');
    const patient = await createPatientRecord(alphanumericToken);

    const planNum = await getNextId('treatplan', 'TreatPlanNum');
    const legacyNote = JSON.stringify({
      status: 'A',
      totalAmount: 300,
      insurancePortion: 240,
      patientPortion: 60,
      items: [
        {
          id: 'legacy-item-1',
          procedureCode: 'D0210',
          description: 'Intraoral complete series',
          fee: '$150.00',
          status: 'A',
        },
        {
          id: 'legacy-item-2',
          procedureCode: 'D1110',
          description: 'Prophylaxis - adult',
          fee: '$150.00',
          status: 'A',
        },
      ],
    });

    await prisma.treatplan.create({
      data: {
        TreatPlanNum: planNum,
        PatNum: patient.PatNum,
        Heading: 'Legacy Unmigrated Plan',
        Note: legacyNote,
        DateTP: new Date(),
        TPStatus: 0,
      },
    });

    // Ensure zero proctp rows exist
    const proctpCount = await prisma.proctp.count({
      where: { TreatPlanNum: planNum },
    });
    expect(proctpCount).toBe(0);

    // Read plan via getTreatmentPlanById
    const fetched = await treatmentPlanService.getTreatmentPlanById(planNum.toString());
    expect(fetched.items.length).toBe(2);
    expect(fetched.items[0].procedureCode).toBe('D0210');
    expect(fetched.items[1].procedureCode).toBe('D1110');

    // Clean up
    await prisma.treatplan.delete({ where: { TreatPlanNum: planNum } });
    await prisma.patient.delete({ where: { PatNum: patient.PatNum } });
  });
});
