import { prisma } from '../config/db';
import { LateFeeGuardrails, LateFeePolicyConfig, LateFeeSkipReason, InvoiceForLateFee } from './late-fee-guardrails.service';
import { notificationService } from './notification.service';
import { writeAudit } from './audit.service';
import { roundCurrency } from './late-fee.service';

export interface LateFeeJobResult {
  runDate: string;
  clinicsProcessed: number;
  totalFeesApplied: number;
  totalFeesSkipped: number;
  errors: string[];
}

export interface ClinicLateFeeResult {
  clinicId: bigint;
  clinicName: string;
  feesApplied: number;
  feesSkipped: number;
  skippedReasons: Record<LateFeeSkipReason, number>;
  appliedFees: Array<{ invoiceId: bigint; feeAmount: number }>;
  errors: string[];
}

export class LateFeeSchedulerService {
  async runDailyJob(runDate: Date = new Date()): Promise<LateFeeJobResult> {
    const clinics = await prisma.clinic.findMany({
      where: { features: { path: ['lateFee', 'enabled'], equals: true } },
      select: { ClinicNum: true, Description: true, features: true },
    });

    let totalFeesApplied = 0;
    let totalFeesSkipped = 0;
    const allErrors: string[] = [];

    for (const clinic of clinics) {
      try {
        const result = await this.processClinic(clinic.ClinicNum, runDate);
        totalFeesApplied += result.feesApplied;
        totalFeesSkipped += result.feesSkipped;
        allErrors.push(...result.errors);
      } catch (error) {
        allErrors.push(`Clinic ${clinic.ClinicNum}: ${(error as Error).message}`);
      }
    }

    return {
      runDate: runDate.toISOString().split('T')[0],
      clinicsProcessed: clinics.length,
      totalFeesApplied,
      totalFeesSkipped,
      errors: allErrors,
    };
  }

  async processClinic(clinicId: bigint, runDate: Date): Promise<ClinicLateFeeResult> {
    const policy = await LateFeeGuardrails.getActivePolicy(clinicId);
    if (!policy) {
      return {
        clinicId,
        clinicName: '',
        feesApplied: 0,
        feesSkipped: 0,
        skippedReasons: this.emptySkippedReasons(),
        appliedFees: [],
        errors: ['No active late fee policy'],
      };
    }

    const clinic = await prisma.clinic.findUnique({ where: { ClinicNum: clinicId }, select: { Description: true } });

    const overdueInvoices = await this.getOverdueInvoices(clinicId, policy, runDate);

    const skippedReasons = this.emptySkippedReasons();
    const appliedFees: Array<{ invoiceId: bigint; feeAmount: number }> = [];
    const errors: string[] = [];

    for (const invoice of overdueInvoices) {
      try {
        const eligibility = await LateFeeGuardrails.checkEligibility(invoice, policy, runDate);
        if (!eligibility.eligible) {
          skippedReasons[eligibility.skipReason!]++;
          await this.recordApplication(invoice, policy, eligibility.skipReason!, eligibility.details, runDate);
          continue;
        }

        const isCorporate = await this.isCorporateClient(invoice.patientId);
        const feeCalc = await LateFeeGuardrails.calculateFee(invoice, policy, isCorporate);
        if (feeCalc.feeAmount <= 0) {
          skippedReasons.NOT_ELIGIBLE++;
          await this.recordApplication(invoice, policy, 'NOT_ELIGIBLE', 'Calculated fee is zero', runDate);
          continue;
        }

        const capExceeded = await LateFeeGuardrails.wouldExceedCap(
          invoice.id,
          feeCalc.feeAmount,
          policy.capPct,
          invoice.totalAmount
        );
        if (capExceeded) {
          skippedReasons.CAP_REACHED++;
          await this.recordApplication(invoice, policy, 'CAP_REACHED', `Cap of ${policy.capPct}% reached`, runDate);
          continue;
        }

        const currentFees = await LateFeeGuardrails.getCumulativeFees(invoice.id);
        await this.applyFee(invoice, policy, feeCalc, currentFees, runDate);
        appliedFees.push({ invoiceId: invoice.id, feeAmount: feeCalc.feeAmount });
      } catch (error) {
        errors.push(`Invoice ${invoice.id}: ${(error as Error).message}`);
      }
    }

    return {
      clinicId,
      clinicName: clinic?.Description ?? '',
      feesApplied: appliedFees.length,
      feesSkipped: Object.values(skippedReasons).reduce((a, b) => a + b, 0),
      skippedReasons,
      appliedFees,
      errors,
    };
  }

  private async getOverdueInvoices(clinicId: bigint, policy: LateFeePolicyConfig, runDate: Date): Promise<InvoiceForLateFee[]> {
    const periodStart = new Date(runDate.getFullYear(), runDate.getMonth(), 1);
    const periodEnd = new Date(runDate.getFullYear(), runDate.getMonth() + 1, 0, 23, 59, 59);

    const statements = await prisma.statement.findMany({
      where: {
        IsInvoice: 1,
        clinic: { ClinicNum: clinicId },
        DateSent: { not: null, lt: runDate },
        PatNum: { not: null },
      },
      select: {
        StatementNum: true,
        ShortGUID: true,
        DateSent: true,
        PatNum: true,
        BalTotal: true,
        InsEst: true,
        NoteBold: true,
        lateFeePolicyVersionId: true,
        patientLiabilityFinalizedAt: true,
      },
    });

    const invoices: InvoiceForLateFee[] = [];
    for (const stmt of statements) {
      const meta = JSON.parse(stmt.NoteBold || '{}');
      const split = this.calculateSplit(stmt.BalTotal, stmt.InsEst, meta.writeoffAmount);

      invoices.push({
        id: stmt.StatementNum,
        invoiceNumber: stmt.ShortGUID,
        invoiceDate: stmt.DateSent ? new Date(stmt.DateSent) : null,
        patientPortion: split.patientRemaining,
        balanceDue: split.totalOwing,
        totalAmount: Number(stmt.BalTotal ?? 0),
        patientLiabilityFinalizedAt: stmt.patientLiabilityFinalizedAt ? new Date(stmt.patientLiabilityFinalizedAt) : null,
        lateFeePolicyVersionId: stmt.lateFeePolicyVersionId ? BigInt(stmt.lateFeePolicyVersionId) : null,
        patientId: stmt.PatNum!,
        clinicId,
      });
    }

    return invoices.filter(inv => inv.patientPortion > 0 || inv.balanceDue > 0);
  }

  private calculateSplit(balTotal: number | null, insEst: number | null, writeoffAmount: number | null) {
    const totalOwing = roundCurrency(balTotal ?? 0);
    const insuranceRemaining = Math.min(roundCurrency(insEst ?? 0), totalOwing);
    return {
      insuranceWriteOff: roundCurrency(writeoffAmount ?? 0),
      patientRemaining: roundCurrency(Math.max(0, totalOwing - insuranceRemaining)),
      insuranceRemaining,
      totalOwing,
    };
  }

  private async isCorporateClient(patientId: bigint): Promise<boolean> {
    const patient = await prisma.patient.findUnique({
      where: { PatNum: patientId },
      select: { CreditType: true, Guarantor: true },
    });
    return patient?.CreditType === 'C' || (patient?.Guarantor && patient.Guarantor !== patientId);
  }

  private async recordApplication(
    invoice: InvoiceForLateFee,
    policy: LateFeePolicyConfig,
    status: LateFeeSkipReason | 'applied',
    details: string | undefined,
    runDate: Date
  ): Promise<void> {
    const periodStart = new Date(runDate.getFullYear(), runDate.getMonth(), 1);
    const periodEnd = new Date(runDate.getFullYear(), runDate.getMonth() + 1, 0, 23, 59, 59);

    await prisma.lateFeeApplication.create({
      data: {
        invoiceId: invoice.id,
        policyId: policy.id,
        patientId: invoice.patientId,
        clinicId: invoice.clinicId,
        feeAmount: 0,
        baseAmount: 0,
        feeType: policy.feeType,
        appliedAt: runDate,
        appliedBy: 'system_job',
        status: status === 'applied' ? 'applied' : 'skipped',
        skipReason: status === 'applied' ? null : status,
        periodStart,
        periodEnd,
        originalInvoiceAmount: invoice.totalAmount,
        cumulativeFees: await LateFeeGuardrails.getCumulativeFees(invoice.id),
      },
    });

    await writeAudit({
      userNum: 0n,
      permType: 999,
      patNum: invoice.patientId,
      clinicNum: invoice.clinicId,
      text: `Late fee ${status}: ${details ?? ''} (invoice ${invoice.invoiceNumber})`,
      source: 1,
    });
  }

  private async applyFee(
    invoice: InvoiceForLateFee,
    policy: LateFeePolicyConfig,
    feeCalc: { feeAmount: number; baseAmount: number; feeType: 'flat' | 'percentage'; details: string },
    cumulativeFees: number,
    runDate: Date
  ): Promise<void> {
    const periodStart = new Date(runDate.getFullYear(), runDate.getMonth(), 1);
    const periodEnd = new Date(runDate.getFullYear(), runDate.getMonth() + 1, 0, 23, 59, 59);

    const application = await prisma.lateFeeApplication.create({
      data: {
        invoiceId: invoice.id,
        policyId: policy.id,
        patientId: invoice.patientId,
        clinicId: invoice.clinicId,
        feeAmount: feeCalc.feeAmount,
        baseAmount: feeCalc.baseAmount,
        feeType: feeCalc.feeType,
        appliedAt: runDate,
        appliedBy: 'system_job',
        status: 'applied',
        periodStart,
        periodEnd,
        originalInvoiceAmount: invoice.totalAmount,
        cumulativeFees: roundCurrency(cumulativeFees + feeCalc.feeAmount),
      },
    });

    await this.createFeeInvoice(invoice, policy, feeCalc, application.id, runDate);

    await writeAudit({
      userNum: 0n,
      permType: 999,
      patNum: invoice.patientId,
      clinicNum: invoice.clinicId,
      text: `Late fee applied: $${(feeCalc.feeAmount / 100).toFixed(2)} on invoice ${invoice.invoiceNumber} (${feeCalc.details})`,
      source: 1,
    });

    await this.notifyPayer(invoice, policy, feeCalc);
  }

  private async createFeeInvoice(
    invoice: InvoiceForLateFee,
    policy: LateFeePolicyConfig,
    feeCalc: { feeAmount: number; baseAmount: number; feeType: 'flat' | 'percentage'; details: string },
    applicationId: bigint,
    runDate: Date
  ): Promise<void> {
    const invoiceNumber = await this.generateInvoiceNumber(invoice.clinicId);

    await prisma.statement.create({
      data: {
        StatementNum: await this.getNextStatementNum(),
        PatNum: invoice.patientId,
        DateSent: runDate,
        DateRangeFrom: runDate,
        DateRangeTo: runDate,
        Note: `Late Fee - ${policy.termsText.substring(0, 100)}`,
        NoteBold: JSON.stringify({
          status: 'final',
          isLateFee: true,
          lateFeeApplicationId: applicationId.toString(),
          originalInvoiceId: invoice.id.toString(),
          lateFeePolicyVersion: policy.version,
        }),
        IsInvoice: 1,
        StatementType: 'late_fee',
        ShortGUID: invoiceNumber,
        InsEst: 0,
        BalTotal: feeCalc.feeAmount / 100,
        ClinicNum: invoice.clinicId,
      },
    });

    await prisma.procedurelog.create({
      data: {
        ProcNum: await this.getNextProcNum(),
        PatNum: invoice.patientId,
        ProcDate: runDate,
        ProcFee: feeCalc.feeAmount / 100,
        ProcStatus: 2,
        StatementNum: applicationId,
        BillingNote: JSON.stringify({
          isPatientPenalty: true,
          lateFeeApplicationId: applicationId.toString(),
          lateFeePolicyVersion: policy.version,
          originalInvoiceId: invoice.id.toString(),
          feeAmount: feeCalc.feeAmount / 100,
          baseAmount: feeCalc.baseAmount / 100,
          feeType: feeCalc.feeType,
        }),
        ClinicNum: invoice.clinicId,
        ProvNum: 1,
      },
    });
  }

  private async notifyPayer(
    invoice: InvoiceForLateFee,
    policy: LateFeePolicyConfig,
    feeCalc: { feeAmount: number; baseAmount: number; feeType: 'flat' | 'percentage'; details: string }
  ): Promise<void> {
    const patient = await prisma.patient.findUnique({
      where: { PatNum: invoice.patientId },
      select: { Email: true, WirelessPhone: true, FName: true, LName: true, Preferred: true },
    });

    if (!patient) return;

    const feeDollars = (feeCalc.feeAmount / 100).toFixed(2);
    const message = `A late fee of $${feeDollars} has been applied to invoice ${invoice.invoiceNumber}. ${feeCalc.details}. Please contact the clinic with questions or to make a payment.`;

    try {
      if (patient.Email) {
        await notificationService.sendEmail({
          to: patient.Email,
          subject: `Late Fee Applied - Invoice ${invoice.invoiceNumber}`,
          body: message,
        });
      }
      if (patient.WirelessPhone) {
        await notificationService.sendSms(patient.WirelessPhone, message);
      }
    } catch (error) {
      console.error('Failed to send late fee notification:', error);
    }
  }

  private emptySkippedReasons(): Record<LateFeeSkipReason, number> {
    return {
      POLICY_NOT_ACCEPTED: 0,
      INSURANCE_PENDING: 0,
      GRACE_PERIOD: 0,
      CAP_REACHED: 0,
      ALREADY_APPLIED: 0,
      NOT_ELIGIBLE: 0,
      FEES_DISABLED: 0,
    };
  }

  private async getNextStatementNum(): Promise<bigint> {
    return (await prisma.$queryRaw`SELECT nextval('statement_StatementNum_seq')`)[0].nextval as bigint;
  }

  private async getNextProcNum(): Promise<bigint> {
    return (await prisma.$queryRaw`SELECT nextval('procedurelog_ProcNum_seq')`)[0].nextval as bigint;
  }

  private async generateInvoiceNumber(clinicId: bigint): Promise<string> {
    const recent = await prisma.statement.findMany({
      where: { ClinicNum: clinicId, ShortGUID: { startsWith: 'INV' } },
      orderBy: { StatementNum: 'desc' },
      take: 50,
    });
    let max = 0;
    for (const stmt of recent) {
      const match = String(stmt.ShortGUID || '').match(/\d+$/);
      if (match) max = Math.max(max, parseInt(match[0], 10));
    }
    return `INV${String(max + 1).padStart(6, '0')}`;
  }
}

export const lateFeeScheduler = new LateFeeSchedulerService();
export default lateFeeScheduler;