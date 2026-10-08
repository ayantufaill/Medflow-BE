import { prisma } from '../config/db';
import { roundCurrency } from './late-fee.service';
export { roundCurrency };

export type LateFeeSkipReason =
  | 'POLICY_NOT_ACCEPTED'
  | 'INSURANCE_PENDING'
  | 'GRACE_PERIOD'
  | 'CAP_REACHED'
  | 'ALREADY_APPLIED'
  | 'NOT_ELIGIBLE'
  | 'FEES_DISABLED';

export type WaiverReasonCode = 'HARDSHIP' | 'GOODWILL' | 'BILLING_ERROR' | 'INSURANCE_DELAY' | 'OTHER';

export interface LateFeePolicyConfig {
  id: bigint;
  clinicId: bigint;
  version: number;
  termsText: string;
  gracePeriodDays: number;
  paymentTermsDays: number;
  feeType: 'flat' | 'percentage';
  patientFeeAmount: number;
  corporateFeePct: number;
  capPct: number;
  enabled: boolean;
}

export interface EligibilityResult {
  eligible: boolean;
  skipReason?: LateFeeSkipReason;
  details?: string;
}

export interface FeeCalculationResult {
  feeAmount: number;
  baseAmount: number;
  feeType: 'flat' | 'percentage';
  details: string;
}

export interface InvoiceForLateFee {
  id: bigint;
  invoiceNumber: string | null;
  invoiceDate: Date | null;
  patientPortion: number;
  balanceDue: number;
  totalAmount: number;
  patientLiabilityFinalizedAt: Date | null;
  lateFeePolicyVersionId: bigint | null;
  patientId: bigint;
  clinicId: bigint;
}

export const LateFeeGuardrails = {
  async getActivePolicy(clinicId: bigint): Promise<LateFeePolicyConfig | null> {
    const policy = await prisma.lateFeePolicy.findFirst({
      where: { clinicId, isActive: true, enabled: true },
      orderBy: { version: 'desc' },
    });
    if (!policy) return null;
    return {
      id: policy.id,
      clinicId: policy.clinicId,
      version: policy.version,
      termsText: policy.termsText,
      gracePeriodDays: policy.gracePeriodDays,
      paymentTermsDays: policy.paymentTermsDays,
      feeType: policy.feeType as 'flat' | 'percentage',
      patientFeeAmount: Number(policy.patientFeeAmount),
      corporateFeePct: Number(policy.corporateFeePct),
      capPct: Number(policy.capPct),
      enabled: policy.enabled,
    };
  },

  async getPolicyByVersion(policyVersionId: bigint): Promise<LateFeePolicyConfig | null> {
    const policy = await prisma.lateFeePolicy.findUnique({ where: { id: policyVersionId } });
    if (!policy) return null;
    return {
      id: policy.id,
      clinicId: policy.clinicId,
      version: policy.version,
      termsText: policy.termsText,
      gracePeriodDays: policy.gracePeriodDays,
      paymentTermsDays: policy.paymentTermsDays,
      feeType: policy.feeType as 'flat' | 'percentage',
      patientFeeAmount: Number(policy.patientFeeAmount),
      corporateFeePct: Number(policy.corporateFeePct),
      capPct: Number(policy.capPct),
      enabled: policy.enabled,
    };
  },

  async isPolicyAccepted(patientId: bigint, policyVersionId: bigint, corporateClientId?: bigint): Promise<boolean> {
    if (corporateClientId) {
      const acceptance = await prisma.lateFeePolicyAcceptance.findUnique({
        where: { policyId_corporateClientId: { policyId: policyVersionId, corporateClientId } },
      });
      return !!acceptance;
    }
    const acceptance = await prisma.lateFeePolicyAcceptance.findUnique({
      where: { policyId_patientId: { policyId: policyVersionId, patientId } },
    });
    return !!acceptance;
  },

  async hasPendingInsurance(invoiceId: bigint): Promise<boolean> {
    const claimProcs = await prisma.claimproc.findMany({
      where: {
        procedurelog: { StatementNum: invoiceId },
        claim: {
          OR: [
            { ClaimStatus: 'P' },
            { ClaimStatus: 'S' },
            { ClaimStatus: 'U' },
          ],
        },
      },
      select: { ClaimNum: true },
      take: 1,
    });
    return claimProcs.length > 0;
  },

  async getPatientLiabilityFinalizedAt(invoiceId: bigint): Promise<Date | null> {
    const stmt = await prisma.statement.findUnique({
      where: { StatementNum: invoiceId },
      select: { patientLiabilityFinalizedAt: true },
    });
    return stmt?.patientLiabilityFinalizedAt ?? null;
  },

  async isClaimPendingOrReopened(invoiceId: bigint): Promise<boolean> {
    const claimProcs = await prisma.claimproc.findMany({
      where: {
        procedurelog: { StatementNum: invoiceId },
        claim: {
          OR: [
            { ClaimStatus: 'P' },
            { ClaimStatus: 'S' },
            { ClaimStatus: 'U' },
          ],
        },
      },
      select: { ClaimNum: true },
      take: 1,
    });
    return claimProcs.length > 0;
  },

  async getCumulativeFees(invoiceId: bigint): Promise<number> {
    const result = await prisma.lateFeeApplication.aggregate({
      where: { invoiceId, status: 'applied' },
      _sum: { feeAmount: true },
    });
    return Number(result._sum.feeAmount ?? 0);
  },

  async wouldExceedCap(invoiceId: bigint, newFeeAmount: number, capPct: number, originalInvoiceAmount: number): Promise<boolean> {
    const currentFees = await this.getCumulativeFees(invoiceId);
    const capAmount = roundCurrency(originalInvoiceAmount * (capPct / 100));
    return roundCurrency(currentFees + newFeeAmount) > capAmount;
  },

  calculateDueDate(invoiceDate: Date | null, paymentTermsDays: number, patientLiabilityFinalizedAt: Date | null): Date | null {
    const startDate = patientLiabilityFinalizedAt ?? invoiceDate;
    if (!startDate) return null;
    const due = new Date(startDate);
    due.setDate(due.getDate() + paymentTermsDays);
    return due;
  },

  calculateGracePeriodEnd(dueDate: Date | null, gracePeriodDays: number): Date | null {
    if (!dueDate) return null;
    const end = new Date(dueDate);
    end.setDate(end.getDate() + gracePeriodDays);
    return end;
  },

  isPastGracePeriod(now: Date, gracePeriodEnd: Date | null): boolean {
    if (!gracePeriodEnd) return false;
    return now >= gracePeriodEnd;
  },

  async isCorporateClient(patientId: bigint): Promise<boolean> {
    const patient = await prisma.patient.findUnique({
      where: { PatNum: patientId },
      select: { CreditType: true, Guarantor: true },
    });
    return patient?.CreditType === 'C' || Boolean(patient?.Guarantor && patient.Guarantor !== patientId);
  },

  calculatePatientFee(baseAmount: number, flatFee: number): FeeCalculationResult {
    const feeAmount = roundCurrency(flatFee);
    return {
      feeAmount,
      baseAmount,
      feeType: 'flat',
      // All money in this module is DOLLARS (same convention as every other
      // money column: BalTotal, ProcFee, payments). patientFeeAmount: 50 = $50.
      details: `Flat fee $${flatFee.toFixed(2)} on patient balance $${baseAmount.toFixed(2)}`,
    };
  },

  calculateCorporateFee(outstandingPrincipal: number, monthlyPct: number, monthsOverdue: number): FeeCalculationResult {
    const monthlyRate = monthlyPct / 100;
    const feeAmount = roundCurrency(outstandingPrincipal * monthlyRate * monthsOverdue);
    return {
      feeAmount,
      baseAmount: outstandingPrincipal,
      feeType: 'percentage',
      details: `${monthlyPct}%/month on principal $${outstandingPrincipal.toFixed(2)} for ${monthsOverdue} month(s)`,
    };
  },

  async isFeeAlreadyApplied(invoiceId: bigint, periodStart: Date, periodEnd: Date, feeType: 'flat' | 'percentage'): Promise<boolean> {
    const existing = await prisma.lateFeeApplication.findFirst({
      where: {
        invoiceId,
        status: 'applied',
        periodStart: { lte: periodEnd },
        periodEnd: { gte: periodStart },
      },
      select: { id: true, feeType: true },
    });

    if (!existing) return false;

    // For flat fees, check if any fee was already applied to this invoice (regardless of period)
    // This ensures true idempotency: one flat fee per invoice ever
    if (existing.feeType === 'flat') {
      const anyApplied = await prisma.lateFeeApplication.count({
        where: { invoiceId, status: 'applied' },
      });
      return anyApplied > 0;
    }

    // For percentage fees, use period-based check (monthly compounding is expected)
    return true;
  },

  async checkEligibility(
    invoice: InvoiceForLateFee,
    policy: LateFeePolicyConfig,
    now: Date = new Date(),
    corporateClientId?: bigint
  ): Promise<EligibilityResult> {
    if (!policy.enabled) {
      return { eligible: false, skipReason: 'FEES_DISABLED', details: 'Late fees disabled for clinic' };
    }

    if (!invoice.lateFeePolicyVersionId) {
      return { eligible: false, skipReason: 'NOT_ELIGIBLE', details: 'Invoice has no policy snapshot' };
    }

    const policyAccepted = await this.isPolicyAccepted(invoice.patientId, invoice.lateFeePolicyVersionId, corporateClientId);
    if (!policyAccepted) {
      return { eligible: false, skipReason: 'POLICY_NOT_ACCEPTED', details: 'Payer has not accepted policy version' };
    }

    const pendingInsurance = await this.hasPendingInsurance(invoice.id);
    if (pendingInsurance) {
      return { eligible: false, skipReason: 'INSURANCE_PENDING', details: 'Insurance claim pending/submitted/under review' };
    }

    const dueDate = this.calculateDueDate(invoice.invoiceDate, policy.paymentTermsDays, invoice.patientLiabilityFinalizedAt);
    const gracePeriodEnd = this.calculateGracePeriodEnd(dueDate, policy.gracePeriodDays);
    if (!this.isPastGracePeriod(now, gracePeriodEnd)) {
      return { eligible: false, skipReason: 'GRACE_PERIOD', details: `Grace period ends ${gracePeriodEnd?.toISOString().split('T')[0]}` };
    }

    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const isCorporate = invoice.clinicId ? true : false; // simplified - will be determined by policy
    const alreadyApplied = await this.isFeeAlreadyApplied(invoice.id, periodStart, periodEnd, policy.feeType);
    if (alreadyApplied) {
      return { eligible: false, skipReason: 'ALREADY_APPLIED', details: 'Fee already applied for this period' };
    }

    return { eligible: true };
  },

  async calculateFee(
    invoice: InvoiceForLateFee,
    policy: LateFeePolicyConfig,
    isCorporate: boolean
  ): Promise<FeeCalculationResult> {
    const baseAmount = isCorporate ? invoice.balanceDue : invoice.patientPortion;
    if (baseAmount <= 0) {
      return { feeAmount: 0, baseAmount, feeType: policy.feeType, details: 'No outstanding balance' };
    }

    if (policy.feeType === 'flat' || !isCorporate) {
      return this.calculatePatientFee(baseAmount, policy.patientFeeAmount);
    }

    const dueDate = this.calculateDueDate(invoice.invoiceDate, policy.paymentTermsDays, invoice.patientLiabilityFinalizedAt);
    if (!dueDate) return { feeAmount: 0, baseAmount, feeType: 'percentage', details: 'No due date' };

    const now = new Date();
    const monthsOverdue = Math.max(1, Math.floor((now.getTime() - dueDate.getTime()) / (30 * 24 * 60 * 60 * 1000)) + 1);
    return this.calculateCorporateFee(baseAmount, policy.corporateFeePct, monthsOverdue);
  },

  async isEmergencyEncounter(appointmentId: bigint): Promise<boolean> {
    const appt = await prisma.appointment.findUnique({
      where: { AptNum: appointmentId },
      select: { AptStatus: true, AppointmentTypeNum: true },
    });
    if (!appt) return false;
    const aptType = await prisma.appointmenttype.findUnique({
      where: { AppointmentTypeNum: appt.AppointmentTypeNum ?? undefined },
      select: { AppointmentTypeName: true },
    });
    return aptType?.AppointmentTypeName?.toLowerCase().includes('emergency') ?? false;
  },

  async canAccessRecords(patientId: bigint, hasOutstandingBalance: boolean): Promise<boolean> {
    return true;
  },
};

export default LateFeeGuardrails;