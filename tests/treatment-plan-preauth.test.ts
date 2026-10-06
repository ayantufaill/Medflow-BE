/**
 * Per-item pre-auth persistence INTEGRATION test.
 *
 * `preAuthByItemId` is stored in the plan's Note JSON rather than on the
 * proctp row, keyed by ProcTPNum. This drives the real service so it catches
 * the reconciliation rules in `updateTreatmentPlan`, which are the easy part to
 * get wrong: a bare preAuthId must not erase a stored status, clearing both
 * must remove the entry, and an item deleted from the plan must not leave its
 * authorisation behind for a recycled ProcTPNum to inherit.
 *
 * It also pins the create path, which is where a plan's pre-auth has to be
 * captured before the proctp rows exist.
 */
import { describe, it, expect } from 'vitest';
import { prisma } from '../src/config/db.js';
import { treatmentPlanService } from '../src/services/treatment-plan.service.js';
import { uniqueToken } from './helpers/unique.js';
import { createPatientRecord } from './helpers/fixtures.js';

const readMeta = async (planId: string) => {
  const row = await prisma.treatplan.findUnique({ where: { TreatPlanNum: BigInt(planId) } });
  return JSON.parse(row?.Note || '{}');
};

describe('Treatment plan per-item pre-auth', () => {
  it('captures pre-auth supplied at creation and round-trips it', async () => {
    const patient = await createPatientRecord(uniqueToken('tp-preauth-create').replace(/[^A-Za-z0-9]/g, ''));

    const created = await treatmentPlanService.createTreatmentPlan({
      patientId: patient.PatNum.toString(),
      title: 'Pre-auth at creation',
      status: 'P',
      items: [
        { procedureCode: 'D2750', description: 'Crown', tooth: '14', fee: 850, status: 'A', preAuth: 'Approved', preAuthId: 'PA-1001' },
        { procedureCode: 'D0120', description: 'Exam', fee: 65, status: 'P', preAuthId: 'PA-1002' },
        { procedureCode: 'D1110', description: 'Prophy', fee: 120, status: 'P' },
      ],
    });

    // Items come back with their pre-auth applied.
    expect(created.items[0].preAuth).toBe('Approved');
    expect(created.items[0].preAuthId).toBe('PA-1001');
    // preAuthId with no status defaults to 'Requested'.
    expect(created.items[1].preAuth).toBe('Requested');
    expect(created.items[1].preAuthId).toBe('PA-1002');
    // An item with neither reads as '-' / null, never a stale value.
    expect(created.items[2].preAuth).toBe('-');
    expect(created.items[2].preAuthId).toBeNull();

    // It is in the Note JSON, keyed by ProcTPNum...
    const meta = await readMeta(created._id);
    const id0 = created.items[0].id;
    const id1 = created.items[1].id;
    expect(meta.preAuthByItemId[id0]).toEqual({ status: 'Approved', preAuthId: 'PA-1001' });
    expect(meta.preAuthByItemId[id1]).toEqual({ status: 'Requested', preAuthId: 'PA-1002' });
    // The item with no pre-auth must not get an entry at all.
    expect(meta.preAuthByItemId[created.items[2].id]).toBeUndefined();

    // ...and survives a fresh read of the plan.
    const reread = await treatmentPlanService.getTreatmentPlanById(created._id);
    expect(reread.items[0].preAuth).toBe('Approved');
    expect(reread.items[0].preAuthId).toBe('PA-1001');

    await treatmentPlanService.deleteTreatmentPlan(created._id);
    await prisma.patient.delete({ where: { PatNum: patient.PatNum } });
  });

  it('keeps the stored status when only preAuthId is sent on update', async () => {
    const patient = await createPatientRecord(uniqueToken('tp-preauth-keep').replace(/[^A-Za-z0-9]/g, ''));
    const created = await treatmentPlanService.createTreatmentPlan({
      patientId: patient.PatNum.toString(),
      title: 'Keep status',
      status: 'P',
      items: [{ procedureCode: 'D2750', fee: 850, status: 'A', preAuth: 'Approved', preAuthId: 'PA-2001' }],
    });
    const itemId = created.items[0].id;

    const updated = await treatmentPlanService.updateTreatmentPlan(created._id, {
      items: [{ id: itemId, procedureCode: 'D2750', fee: 850, status: 'A', preAuthId: 'PA-2002' }],
    });

    // The new id wins, but the status must survive — dropping it would lose an
    // approval the payer already issued.
    expect(updated.items[0].preAuthId).toBe('PA-2002');
    expect(updated.items[0].preAuth).toBe('Approved');

    await treatmentPlanService.deleteTreatmentPlan(created._id);
    await prisma.patient.delete({ where: { PatNum: patient.PatNum } });
  });

  it('keeps the stored id when only a status is sent on update', async () => {
    const patient = await createPatientRecord(uniqueToken('tp-preauth-id').replace(/[^A-Za-z0-9]/g, ''));
    const created = await treatmentPlanService.createTreatmentPlan({
      patientId: patient.PatNum.toString(),
      title: 'Keep id',
      status: 'P',
      items: [{ procedureCode: 'D2750', fee: 850, status: 'A', preAuth: 'Pending', preAuthId: 'PA-3001' }],
    });
    const itemId = created.items[0].id;

    const updated = await treatmentPlanService.updateTreatmentPlan(created._id, {
      items: [{ id: itemId, procedureCode: 'D2750', fee: 850, status: 'A', preAuth: 'Approved' }],
    });

    expect(updated.items[0].preAuth).toBe('Approved');
    expect(updated.items[0].preAuthId).toBe('PA-3001');

    await treatmentPlanService.deleteTreatmentPlan(created._id);
    await prisma.patient.delete({ where: { PatNum: patient.PatNum } });
  });

  it('drops the entry when both status and id are cleared', async () => {
    const patient = await createPatientRecord(uniqueToken('tp-preauth-clear').replace(/[^A-Za-z0-9]/g, ''));
    const created = await treatmentPlanService.createTreatmentPlan({
      patientId: patient.PatNum.toString(),
      title: 'Clear pre-auth',
      status: 'P',
      items: [{ procedureCode: 'D2750', fee: 850, status: 'A', preAuth: 'Denied', preAuthId: 'PA-4001' }],
    });
    const itemId = created.items[0].id;

    const updated = await treatmentPlanService.updateTreatmentPlan(created._id, {
      // '-' is what the API returns for "no status", so it must read as a clear.
      items: [{ id: itemId, procedureCode: 'D2750', fee: 850, status: 'A', preAuth: '-', preAuthId: null }],
    });

    expect(updated.items[0].preAuth).toBe('-');
    expect(updated.items[0].preAuthId).toBeNull();
    const meta = await readMeta(created._id);
    expect(meta.preAuthByItemId[itemId]).toBeUndefined();

    await treatmentPlanService.deleteTreatmentPlan(created._id);
    await prisma.patient.delete({ where: { PatNum: patient.PatNum } });
  });

  it('does not inherit pre-auth when an item is removed from the plan', async () => {
    const patient = await createPatientRecord(uniqueToken('tp-preauth-del').replace(/[^A-Za-z0-9]/g, ''));
    const created = await treatmentPlanService.createTreatmentPlan({
      patientId: patient.PatNum.toString(),
      title: 'Remove item',
      status: 'P',
      items: [
        { procedureCode: 'D2750', fee: 850, status: 'A', preAuth: 'Approved', preAuthId: 'PA-5001' },
        { procedureCode: 'D0120', fee: 65, status: 'P' },
      ],
    });
    const droppedId = created.items[1].id;

    // Drop the second item entirely.
    const updated = await treatmentPlanService.updateTreatmentPlan(created._id, {
      items: [{ id: created.items[0].id, procedureCode: 'D2750', fee: 850, status: 'A', preAuth: 'Approved', preAuthId: 'PA-5001' }],
    });

    expect(updated.items).toHaveLength(1);
    const meta = await readMeta(created._id);
    // A stale entry here would resurface if ProcTPNum were ever reused.
    expect(meta.preAuthByItemId[droppedId]).toBeUndefined();
    expect(Object.keys(meta.preAuthByItemId)).toHaveLength(1);

    await treatmentPlanService.deleteTreatmentPlan(created._id);
    await prisma.patient.delete({ where: { PatNum: patient.PatNum } });
  });

  it('captures pre-auth for an item added by update', async () => {
    const patient = await createPatientRecord(uniqueToken('tp-preauth-add').replace(/[^A-Za-z0-9]/g, ''));
    const created = await treatmentPlanService.createTreatmentPlan({
      patientId: patient.PatNum.toString(),
      title: 'Add item',
      status: 'P',
      items: [{ procedureCode: 'D0120', fee: 65, status: 'P' }],
    });

    const updated = await treatmentPlanService.updateTreatmentPlan(created._id, {
      items: [
        { id: created.items[0].id, procedureCode: 'D0120', fee: 65, status: 'P' },
        { procedureCode: 'D2750', fee: 850, status: 'A', preAuth: 'Requested', preAuthId: 'PA-6001' },
      ],
    });

    expect(updated.items).toHaveLength(2);
    expect(updated.items[1].preAuth).toBe('Requested');
    expect(updated.items[1].preAuthId).toBe('PA-6001');

    const reread = await treatmentPlanService.getTreatmentPlanById(created._id);
    expect(reread.items[1].preAuthId).toBe('PA-6001');

    await treatmentPlanService.deleteTreatmentPlan(created._id);
    await prisma.patient.delete({ where: { PatNum: patient.PatNum } });
  });
});