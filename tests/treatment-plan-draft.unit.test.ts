import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(), estimate: vi.fn(), nextId: vi.fn(), invoice: vi.fn(),
}));
vi.mock('../src/config/db', () => ({ prisma: {}, withTenantTransaction: mocks.transaction }));
vi.mock('../src/services/invoice.service', () => ({ invoiceService: {
  calculateInsuranceEstimates: mocks.estimate, createInvoiceFromCompletedProcedures: mocks.invoice,
} }));
vi.mock('../src/services/claim.service', () => ({ claimService: {} }));
vi.mock('../src/services/patient-insurance.service', () => ({ PatientInsuranceService: class {} }));
vi.mock('../src/services/aging.service', () => ({ agingService: {} }));
vi.mock('../src/utils/opendental-ids.util', () => ({ getNextId: mocks.nextId }));

import { treatmentPlanService } from '../src/services/treatment-plan.service';

describe('treatment plan draft persistence', () => {
  let tx: any;
  const row = { ProcTPNum: 5n, TreatPlanNum: 72n, PatNum: 2n, ProcCode: 'D1110', FeeAmt: 100, PriInsAmt: 0, PatAmt: 100, Prognosis: 'P' };
  beforeEach(() => {
    vi.clearAllMocks();
    const plan = { TreatPlanNum: 72n, PatNum: 2n, Note: '{}', Heading: 'Draft', DateTP: new Date() };
    tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      treatplan: {
        findUnique: vi.fn().mockResolvedValue(plan), findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockImplementation(async ({ data }) => data),
        update: vi.fn().mockImplementation(async ({ data }) => ({ ...plan, ...data })),
      },
      proctp: { findMany: vi.fn().mockResolvedValue([row]), update: vi.fn(), create: vi.fn().mockImplementation(async ({ data }) => data), deleteMany: vi.fn() },
      patient: { findUnique: vi.fn().mockResolvedValue({ PriProv: 1n }) },
    };
    mocks.transaction.mockImplementation(work => work(tx));
    mocks.nextId.mockResolvedValue(73n);
    mocks.estimate.mockImplementation(async (_, items) => items.map(item => ({ ...item, insPortion: 0, ptPortion: 100 })));
  });

  it('passes the locking transaction to insurance calculation and updates existing rows', async () => {
    const result = await treatmentPlanService.updateTreatmentPlan('72', {
      items: [{ id: '5', procedureCode: 'D1110', charge: 100, status: 'P' }],
    });
    expect(mocks.estimate).toHaveBeenCalledWith(2n, expect.any(Array), { db: tx });
    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    expect(tx.proctp.update).toHaveBeenCalledOnce();
    expect(result._id).toBe('72');
    expect(mocks.invoice).not.toHaveBeenCalled();
  });

  it('aborts the update when insurance calculation fails', async () => {
    mocks.estimate.mockRejectedValue(new Error('pool timeout'));
    await expect(treatmentPlanService.updateTreatmentPlan('72', {
      items: [{ id: '5', charge: 100, status: 'P' }],
    })).rejects.toThrow('pool timeout');
    expect(tx.treatplan.update).not.toHaveBeenCalled();
    expect(tx.proctp.update).not.toHaveBeenCalled();
  });

  it('returns the committed draft for a retried creation request', async () => {
    const creationRequestId = '75eb90ac-2d96-48bc-bb66-a8a3e180ee7b';
    tx.treatplan.findMany.mockResolvedValue([{ TreatPlanNum: 72n, Note: JSON.stringify({ creationRequestId }) }]);
    const result = await treatmentPlanService.createTreatmentPlan({ patientId: '2', title: 'Draft', creationRequestId });
    expect(result._id).toBe('72');
    expect(tx.treatplan.create).not.toHaveBeenCalled();
    expect(tx.proctp.create).not.toHaveBeenCalled();
    expect(mocks.nextId).not.toHaveBeenCalled();
    expect(tx.$queryRaw).toHaveBeenCalledOnce();
  });

  it('creates the plan and copied items using the same transaction and persists the retry key', async () => {
    const creationRequestId = '75eb90ac-2d96-48bc-bb66-a8a3e180ee7b';
    await treatmentPlanService.createTreatmentPlan({ patientId: '2', title: 'Draft', creationRequestId, items: [{ charge: 100, status: 'P' }] });
    expect(mocks.nextId).toHaveBeenCalledWith('treatplan', 'TreatPlanNum', tx);
    expect(mocks.nextId).toHaveBeenCalledWith('proctp', 'ProcTPNum', tx);
    expect(mocks.estimate).toHaveBeenCalledWith(2n, expect.any(Array), { db: tx });
    expect(JSON.parse(tx.treatplan.create.mock.calls[0][0].data.Note).creationRequestId).toBe(creationRequestId);
    expect(tx.proctp.create).toHaveBeenCalledOnce();
  });
});
