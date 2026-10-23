import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '../src/config/db';
import { financeDashboardService } from '../src/services/finance-dashboard.service';

vi.mock('../src/config/db', async () => {
  const actual = await vi.importActual('../src/config/db');
  return {
    ...actual,
    default: vi.fn().mockResolvedValue(undefined),
  };
});

describe('Finance Dashboard Aging Breakdown Service Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    { name: 'legacy combined balance', balance: 500, insurance: 100, payment: 100, meta: undefined, expected: 300 },
    { name: 'patient balance with outstanding secondary insurance', balance: 10, insurance: 20, payment: 0,
      meta: { balanceBasis: 'patient', patientPortion: 10, totalAmount: 100 }, expected: 10 },
    { name: 'paid patient share with outstanding insurance', balance: 0, insurance: 35, payment: 120,
      meta: { balanceBasis: 'patient', patientPortion: 120, totalAmount: 305 }, expected: 0 },
  ])('ages $name without subtracting insurance or allocated payments twice', async ({ balance, insurance, payment, meta, expected }) => {
    const patNum = 101n;

    vi.spyOn(prisma.patient, 'findUnique').mockResolvedValue({
      PatNum: patNum,
      Guarantor: patNum,
    } as any);

    vi.spyOn(prisma.patient, 'findMany').mockResolvedValue([
      { PatNum: patNum }
    ] as any);

    vi.spyOn(prisma.claim, 'findMany').mockResolvedValue([
      {
        ClaimNum: 1n,
        PatNum: patNum,
        DateSent: new Date(),
        InsPayEst: 200.0,
        InsPayAmt: 50.0,
      }
    ] as any);

    vi.spyOn(prisma.claimproc, 'findMany').mockResolvedValue([]);

    vi.spyOn(prisma.statement, 'findMany').mockResolvedValue([
      {
        StatementNum: 10n,
        PatNum: patNum,
        DateSent: new Date(),
        BalTotal: balance,
        InsEst: insurance,
        NoteBold: meta ? JSON.stringify(meta) : null,
      }
    ] as any);

    vi.spyOn(prisma.payment, 'aggregate').mockResolvedValue({
      _sum: { PayAmt: payment }
    } as any);

    vi.spyOn(prisma.adjustment, 'aggregate').mockResolvedValue({
      _sum: { AdjAmt: 0 }
    } as any);

    vi.spyOn(prisma.procedurelog, 'findMany').mockResolvedValue([
      {
        ProcNum: 50n,
        PatNum: patNum,
        ProcFee: 120.0,
        ProcStatus: 2,
        StatementNum: null,
      }
    ] as any);

    vi.spyOn(prisma.paysplit, 'findMany').mockResolvedValue([
      {
        SplitNum: 1n,
        PatNum: patNum,
        SplitAmt: 200.0,
        UnearnedType: 1n,
      },
      {
        SplitNum: 2n,
        PatNum: patNum,
        SplitAmt: 50.0,
        UnearnedType: 2n,
      }
    ] as any);

    const result = await financeDashboardService.getAgingByPatient(patNum.toString());

    expect(result).toHaveProperty('familyOutstanding');
    expect(result).toHaveProperty('familyBalance');
    expect(result).toHaveProperty('insuranceBalance');
    expect(result).toHaveProperty('patientAccountCredit');
    expect(result).toHaveProperty('insuranceAccountCredit');

    expect(result.insuranceBalance['0_30']).toBe(150.0);
    expect(result.insuranceBalance.total).toBe(150.0);

    expect(result.familyOutstanding['0_30']).toBe(expected);
    expect(result.familyOutstanding.total).toBe(expected);

    expect(result.familyBalance['0_30']).toBe(expected + 120);
    expect(result.familyBalance.total).toBe(expected + 120);

    expect(result.patientAccountCredit).toBe(200.0);
    expect(result.insuranceAccountCredit).toBe(50.0);
  });
});
