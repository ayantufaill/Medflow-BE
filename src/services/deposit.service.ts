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
}

export const depositService = new DepositService();
