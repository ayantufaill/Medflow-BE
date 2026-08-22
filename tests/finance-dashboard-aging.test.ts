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

  it('returns correctly structured aging breakdown with 3 categories', async () => {
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
        BalTotal: 500.0,
        InsEst: 100.0,
      }
    ] as any);

    vi.spyOn(prisma.payment, 'aggregate').mockResolvedValue({
      _sum: { PayAmt: 100.0 }
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

    expect(result.familyOutstanding['0_30']).toBe(300.0);
    expect(result.familyOutstanding.total).toBe(300.0);

    expect(result.familyBalance['0_30']).toBe(420.0);
    expect(result.familyBalance.total).toBe(420.0);

    expect(result.patientAccountCredit).toBe(200.0);
    expect(result.insuranceAccountCredit).toBe(50.0);
  });
});
