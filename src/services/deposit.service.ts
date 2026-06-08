import { prisma } from '../config/db';
import { NotFoundError, BadRequestError } from '../utils/error.util';
import { logActivity } from '../utils/activity-logger.util';
import { getNextId } from '../utils/opendental-ids.util';
import { mapPatientToApi } from '../utils/opendental-mappers.util';

const buildJson = (value: Record<string, unknown>) => JSON.stringify(value);
const parseJson = <T>(value?: string | null): T => {
  if (!value) return {} as T;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? (parsed as T) : ({} as T);
  } catch {
    return {} as T;
  }
};

export class DepositService {
  private mapDepositToApi(split: any) {
    const payment = split.payment;
    const meta = payment ? parseJson<any>(payment.PayNote) : {};
    return {
      _id: split.SplitNum.toString(),
      paymentId: split.PayNum?.toString() ?? null,
      patientId: split.PatNum?.toString() ?? null,
      amount: Number(split.SplitAmt) || 0,
      date: split.DatePay ?? null,
      depositType: meta.depositType ?? 'patient',
      paymentMethod: meta.paymentMethod ?? null,
      notes: meta.notes ?? null,
      unearnedType: split.UnearnedType?.toString() ?? null,
    };
  }

  private async enrichDeposit(deposit: any) {
    const patient = deposit.patientId
      ? await prisma.patient.findUnique({ where: { PatNum: BigInt(deposit.patientId) } })
      : null;
    return {
      ...deposit,
      patient: patient ? mapPatientToApi(patient) : null,
    };
  }

  async getAllDeposits(
    page = 1,
    limit = 10,
    filters: {
      patientId?: string;
    } = {}
  ) {
    const skip = (page - 1) * limit;
    
    // In OpenDental schema, unallocated deposits are paysplits with UnearnedType > 0
    const where: any = {
      UnearnedType: { gt: 0 },
    };

    if (filters.patientId) where.PatNum = BigInt(filters.patientId);

    const [rows, total] = await Promise.all([
      prisma.paysplit.findMany({
        where,
        include: { payment: true },
        orderBy: { DatePay: 'desc' },
        skip,
        take: limit,
      }),
      prisma.paysplit.count({ where }),
    ]);

    const deposits = await Promise.all(
      rows.map((row) => this.enrichDeposit(this.mapDepositToApi(row)))
    );

    return {
      deposits,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getDepositById(depositId: string) {
    const split = await prisma.paysplit.findUnique({
      where: { SplitNum: BigInt(depositId) },
      include: { payment: true },
    });
    if (!split || !split.UnearnedType) {
      throw new NotFoundError('Deposit not found');
    }

    return this.enrichDeposit(this.mapDepositToApi(split));
  }

  async createDeposit(
    data: {
      patientId: string;
      amount: number;
      paymentMethod: string;
      depositType: string;
      date?: Date;
      notes?: string;
    },
    userId: string
  ) {
    if (!data.amount || data.amount <= 0) {
      throw new BadRequestError('Deposit amount must be greater than zero');
    }

    const resolvedDate = data.date ?? new Date();

    const payNum = await getNextId('payment', 'PayNum');
    const splitNum = await getNextId('paysplit', 'SplitNum');
    
    const unearnedTypeDefNum = data.depositType === 'insurance' ? 2 : 1; // Arbitrary defnums for prepayments

    // Transaction to ensure both payment and paysplit are created
    const [payment, split] = await prisma.$transaction([
      prisma.payment.create({
        data: {
          PayNum: payNum,
          PatNum: BigInt(data.patientId),
          PayAmt: data.amount,
          PayDate: resolvedDate,
          PayNote: buildJson({
            paymentMethod: data.paymentMethod,
            depositType: data.depositType,
            notes: data.notes ?? null,
            isDeposit: true
          }),
          SecUserNumEntry: BigInt(userId),
        },
      }),
      prisma.paysplit.create({
        data: {
          SplitNum: splitNum,
          SplitAmt: data.amount,
          PatNum: BigInt(data.patientId),
          DatePay: resolvedDate,
          PayNum: payNum,
          UnearnedType: BigInt(unearnedTypeDefNum),
          DateEntry: new Date(),
          SecUserNumEntry: BigInt(userId),
        },
      })
    ]);

    await logActivity(userId, 'created', 'deposits', split.SplitNum.toString(), undefined, { payment, split });

    return this.getDepositById(split.SplitNum.toString());
  }

  async getDepositsByPatient(patientId: string, page = 1, limit = 10) {
    return this.getAllDeposits(page, limit, { patientId });
  }

  async getAllDepositSlips(page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      prisma.deposit.findMany({
        orderBy: { DateDeposit: 'desc' },
        skip,
        take: limit,
      }),
      prisma.deposit.count(),
    ]);

    const slips = rows.map((row) => ({
      _id: row.DepositNum.toString(),
      date: row.DateDeposit ?? null,
      bankAccountInfo: row.BankAccountInfo ?? null,
      amount: row.Amount ?? 0,
      memo: row.Memo ?? null,
      batch: row.Batch ?? null,
    }));

    return {
      slips,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getUnDepositedPayments() {
    const [patientPayments, insurancePayments] = await Promise.all([
      prisma.payment.findMany({
        where: {
          OR: [
            { DepositNum: null },
            { DepositNum: 0 },
          ],
        },
        include: {
          patient: true,
          definition: true,
        },
      }),
      prisma.claimpayment.findMany({
        where: {
          OR: [
            { DepositNum: null },
            { DepositNum: 0 },
          ],
        },
        include: {
          definition_claimpayment_PayTypeTodefinition: true,
        },
      }),
    ]);

    const mappedPatientPayments = patientPayments.map((p) => ({
      id: p.PayNum.toString(),
      type: 'patient',
      date: p.PayDate ?? null,
      amount: p.PayAmt ?? 0,
      method: p.definition?.ItemName ?? 'Check',
      checkNum: p.CheckNum ?? '',
      patientName: p.patient ? `${p.patient.FName ?? ''} ${p.patient.LName ?? ''}`.trim() : 'Unknown Patient',
    }));

    const mappedInsurancePayments = insurancePayments.map((cp) => ({
      id: cp.ClaimPaymentNum.toString(),
      type: 'insurance',
      date: cp.CheckDate ?? null,
      amount: cp.CheckAmt ?? 0,
      method: cp.definition_claimpayment_PayTypeTodefinition?.ItemName ?? 'Check',
      checkNum: cp.CheckNum ?? '',
      carrierName: cp.CarrierName ?? 'Unknown Carrier',
    }));

    return {
      patientPayments: mappedPatientPayments,
      insurancePayments: mappedInsurancePayments,
    };
  }

  async createDepositSlip(
    data: {
      bankAccountInfo?: string;
      memo?: string;
      date?: Date;
      patientPaymentIds?: string[];
      insurancePaymentIds?: string[];
    },
    userId: string
  ) {
    const resolvedDate = data.date ?? new Date();
    const memoText = data.memo || '';
    const bankInfo = data.bankAccountInfo || '';

    const patientIds = (data.patientPaymentIds || []).map(BigInt);
    const insuranceIds = (data.insurancePaymentIds || []).map(BigInt);

    // Fetch payments to calculate amount
    const [pPayments, cpPayments] = await Promise.all([
      prisma.payment.findMany({
        where: { PayNum: { in: patientIds } },
      }),
      prisma.claimpayment.findMany({
        where: { ClaimPaymentNum: { in: insuranceIds } },
      }),
    ]);

    const totalAmt =
      pPayments.reduce((sum, p) => sum + (p.PayAmt || 0), 0) +
      cpPayments.reduce((sum, cp) => sum + (cp.CheckAmt || 0), 0);

    const depositNum = await getNextId('deposit', 'DepositNum');

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create deposit slip
      const slip = await tx.deposit.create({
        data: {
          DepositNum: depositNum,
          DateDeposit: resolvedDate,
          BankAccountInfo: bankInfo,
          Amount: totalAmt,
          Memo: memoText,
        },
      });

      // 2. Update patient payments
      if (patientIds.length > 0) {
        await tx.payment.updateMany({
          where: { PayNum: { in: patientIds } },
          data: { DepositNum: depositNum },
        });
      }

      // 3. Update claimpayments
      if (insuranceIds.length > 0) {
        await tx.claimpayment.updateMany({
          where: { ClaimPaymentNum: { in: insuranceIds } },
          data: { DepositNum: depositNum },
        });
      }

      return slip;
    });

    await logActivity(userId, 'created', 'deposits', depositNum.toString(), undefined, {
      depositNum: depositNum.toString(),
      totalAmount: totalAmt,
      patientPaymentCount: patientIds.length,
      insurancePaymentCount: insuranceIds.length,
    });

    return {
      _id: result.DepositNum.toString(),
      date: result.DateDeposit ?? null,
      bankAccountInfo: result.BankAccountInfo ?? null,
      amount: result.Amount ?? 0,
      memo: result.Memo ?? null,
      patientPaymentCount: patientIds.length,
      insurancePaymentCount: insuranceIds.length,
    };
  }
}

export const depositService = new DepositService();

