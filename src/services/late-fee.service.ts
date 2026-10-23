import { prisma } from '../config/db';

/**
 * Late-fee tiering.
 *
 * Product rules this module encodes:
 *  - The clock starts at the statement's DateSent (the date the patient was
 *    actually billed), NOT the date of service. `statement.DateSent` surfaces
 *    to the frontend as `invoice.invoiceDate`.
 *  - Tiers are exclusive. An invoice 100 days old is only ever eligible for the
 *    90 tier; it never appears under 30 or 60. That keeps one invoice from
 *    accumulating several fees in a single action.
 *  - One fee per invoice per tier. Re-charging the same tier is rejected
 *    rather than silently duplicating.
 */

export const LATE_FEE_TIERS = [30, 60, 90] as const;
export type LateFeeTier = (typeof LATE_FEE_TIERS)[number];

/**
 * Flat late-fee amount per tier, in dollars.
 *
 * These are the amounts the UI shows and the server charges by default. They
 * live here, on the backend, because the server is the only place the charge is
 * actually decided — putting them in the dialog would let the two disagree.
 */
export const LATE_FEE_DEFAULT_RATES: Record<LateFeeTier, number> = {
  30: 50,
  60: 100,
  90: 150,
};

/** Flat rate for a tier. Null tier (un-tiered adjustments) has no default. */
export const defaultRateFor = (tier: LateFeeTier | null): number | null =>
  tier === null ? null : LATE_FEE_DEFAULT_RATES[tier];

/** Which side of the balance the fee is calculated against. */
export type LateFeeBasis = 'patient' | 'total';

export type LateFeeMode = 'flat' | 'percentage';

/** The invoice fields the tiering logic depends on. */
export interface LateFeeCandidateInvoice {
  id: string;
  patientRemaining?: number | null;
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  patientPortion?: number | null;
  balanceDue?: number | null;
  totalAmount?: number | null;
  /** Ledger-style split; see outstandingSplit. */
  insuranceWriteOff?: number | null;
  insuranceBalance?: number | null;
}

/** A late fee already on the account, recovered from BillingNote provenance. */
export interface ChargedLateFee {
  sourceStatement: string;
  tier: LateFeeTier;
  baseAmount: number;
  feeAmount: number;
}

export const isLateFeeTier = (value: unknown): value is LateFeeTier =>
  typeof value === 'number' &&
  (LATE_FEE_TIERS as readonly number[]).includes(value);

export const roundCurrency = (value: number): number =>
  Math.round((Number(value) || 0) * 100) / 100;

/**
 * Exclusive bucket for an age in days.
 *
 * 29 -> null (not yet late), 30..59 -> 30, 60..89 -> 60, 90+ -> 90.
 */
export const bucketFor = (days: number): LateFeeTier | null => {
  const d = Math.floor(Number(days));
  if (!Number.isFinite(d) || d < 0) return null;
  // Descending, so the HIGHEST tier the age has reached wins. Iterating
  // ascending would return the lowest one and put a 90-day invoice in the
  // 30-day band.
  for (let i = LATE_FEE_TIERS.length - 1; i >= 0; i--) {
    if (d >= LATE_FEE_TIERS[i]) return LATE_FEE_TIERS[i];
  }
  return null;
};

/**
 * Days between the invoice being sent and now.
 *
 * Returns null when the invoice has never been sent — an unsent invoice has no
 * clock running, so it must not age into a late fee.
 */
export const daysOutstanding = (
  invoiceDate: string | Date | null | undefined,
  now: Date = new Date(),
): number | null => {
  if (!invoiceDate) return null;
  const sent = invoiceDate instanceof Date ? invoiceDate : new Date(invoiceDate);
  if (Number.isNaN(sent.getTime())) return null;
  // DateSent is a @db.Date column, so it lands at midnight UTC. Measuring from
  // midnight rather than the current clock time stops an invoice from reading
  // as a day late on the morning it reaches the boundary.
  const sentUtc = Date.UTC(sent.getUTCFullYear(), sent.getUTCMonth(), sent.getUTCDate());
  const nowUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.floor((nowUtc - sentUtc) / 86_400_000);
};

/**
 * The balance a fee is computed from, honouring the dialog's
 * Total/Patient Outstanding selection.
 *
 * "Patient" uses the patient portion only. "Total" uses the invoice balance
 * including any outstanding insurance estimate.
 */
export const basisAmount = (
  invoice: LateFeeCandidateInvoice,
  basis: LateFeeBasis,
): number => {
  const patient = roundCurrency(invoice.patientPortion ?? 0);
  if (basis === 'patient') return patient;
  const balance = roundCurrency(invoice.balanceDue ?? 0);
  return balance > 0 ? balance : patient;
};

/**
 * Fee for one invoice. A percentage is taken against that invoice's own basis
 * amount, so a fee is proportional to the size of the debt it penalises.
 */
export const feeAmountFor = (
  basisAmountValue: number,
  mode: LateFeeMode,
  rate: number,
): number => {
  const parsedRate = Number(rate);
  if (!Number.isFinite(parsedRate) || parsedRate <= 0) return 0;
  if (mode === 'percentage') {
    return roundCurrency((Number(basisAmountValue) || 0) * (parsedRate / 100));
  }
  return roundCurrency(parsedRate);
};

/**
 * Recover every late fee already charged to a patient.
 *
 * Provenance is stored on the penalty procedure's `BillingNote` as
 * `lateFeeSourceStatement` / `lateFeeTier` / `lateFeeBaseAmount` (written by
 * createStandaloneInvoice). There is no column for it, so this matches on the
 * JSON text — the same pattern the codebase already uses to link payments and
 * adjustments to invoices (see payment.service.ts and adjustment.service.ts).
 * Scoped to PatNum, and voided procedures are excluded so a deleted fee no
 * longer blocks a legitimate re-charge.
 */
export const findChargedLateFees = async (
  patNum: bigint | number,
): Promise<ChargedLateFee[]> => {
  const rows = await prisma.procedurelog.findMany({
    where: {
      PatNum: BigInt(patNum),
      ProcStatus: { not: 6 },
      BillingNote: { contains: '"lateFeeTier"' },
    },
    select: { BillingNote: true },
  });

  const charged: ChargedLateFee[] = [];
  for (const row of rows) {
    let meta: any;
    try {
      meta = JSON.parse(row.BillingNote || '{}');
    } catch {
      continue;
    }
    if (meta?.lateFeeSourceStatement == null || !isLateFeeTier(meta?.lateFeeTier)) {
      continue;
    }
    charged.push({
      sourceStatement: String(meta.lateFeeSourceStatement),
      tier: meta.lateFeeTier,
      baseAmount: roundCurrency(meta.lateFeeBaseAmount ?? 0),
      feeAmount: roundCurrency(meta.charge ?? meta.unitPrice ?? 0),
    });
  }
  return charged;
};

/**
 * `${sourceStatement}:${tier}` — the identity of a single chargeable fee.
 * A null tier is the "any overdue invoice" case used by the flat-rate and
 * percentage adjustments, which carry no 30/60/90 tier of their own.
 */
export const chargeKey = (sourceStatement: string, tier: LateFeeTier | null): string =>
  `${sourceStatement}:${tier ?? 'any'}`;

/**
 * A requested tier, or null meaning "any invoice at least 30 days overdue".
 *
 * null is what the flat-rate and percentage adjustments use: they aren't tiered,
 * so they apply to every overdue invoice rather than to one band.
 */
export const resolveTier = (value: unknown): LateFeeTier | null | undefined => {
  if (value === undefined || value === null || value === '' || value === 'any') return null;
  if (isLateFeeTier(value)) return value;
  return undefined;
};

export interface EligibleInvoice extends LateFeeCandidateInvoice {
  daysOutstanding: number;
  tier: LateFeeTier;
  basisPatient: number;
  basisTotal: number;
  /** Populated when the invoice is blocked because it already owes this fee. */
  alreadyCharged: boolean;
}

/**
 * Invoices eligible for `tier`, with their age and both balance bases resolved.
 *
 * Excluded: never sent (no clock), no outstanding balance, and any invoice that
 * already carries a fee for this tier.
 */
export const eligibleInvoices = (
  invoices: LateFeeCandidateInvoice[],
  tier: LateFeeTier | null,
  charged: ChargedLateFee[],
  now: Date = new Date(),
): EligibleInvoice[] => {
  const chargedKeys = new Set(charged.map((c) => chargeKey(c.sourceStatement, c.tier)));
  const out: EligibleInvoice[] = [];

  for (const invoice of invoices) {
    const days = daysOutstanding(invoice.invoiceDate, now);
    if (days === null) continue;
    const bucket = bucketFor(days);
    if (bucket === null) continue;
    // A null tier accepts any overdue invoice; a real tier accepts only its own
    // exclusive band.
    if (tier !== null && bucket !== tier) continue;

    const basisTotal = roundCurrency(invoice.balanceDue ?? 0);
    // Prefer the split's patient remainder when the caller supplied one, so the
    // fee is charged against the same figure the dialog displays.
    const basisPatient = invoice.patientRemaining != null
      ? roundCurrency(invoice.patientRemaining)
      : roundCurrency(invoice.patientPortion ?? 0);
    // An invoice with no patient responsibility can't produce a meaningful fee,
    // even on the total basis, unless something is genuinely still owed.
    if (basisTotal <= 0 && basisPatient <= 0) continue;

    out.push({
      ...invoice,
      daysOutstanding: days,
      tier: bucket,
      basisPatient,
      basisTotal,
      alreadyCharged: chargedKeys.has(chargeKey(String(invoice.id), tier)),
    });
  }

  return out;
};

export interface OutstandingSplit {
  /** Insurance write-off recorded against the invoice. */
  insuranceWriteOff: number;
  /** What the patient still owes. */
  patientRemaining: number;
  /** What the insurer is still expected to pay. */
  insuranceRemaining: number;
  /** The invoice balance, i.e. patient + insurance still owing. */
  totalOwing: number;
}

/**
 * Split an invoice balance into the four columns the ledger shows.
 *
 * Deliberately built from the values `recalculateInvoice` has already
 * persisted — `statement.BalTotal` for the balance and `statement.InsEst` for
 * the outstanding insurance estimate — rather than re-deriving them here. The
 * ledger's own display splits patient and insurance further using claim status
 * (approved / pending / partial adjudication / voided) and overpayments; doing
 * that again for the dialog would be a second implementation of that logic and
 * would drift from it. Patient is the remainder, so the two always add back up
 * to the total.
 */
export const outstandingSplit = (args: {
  balTotal?: number | null;
  insEst?: number | null;
  writeoffAmount?: number | null;
}): OutstandingSplit => {
  const totalOwing = roundCurrency(args.balTotal ?? 0);
  const insuranceRemaining = Math.min(roundCurrency(args.insEst ?? 0), totalOwing);
  return {
    insuranceWriteOff: roundCurrency(args.writeoffAmount ?? 0),
    patientRemaining: roundCurrency(Math.max(0, totalOwing - insuranceRemaining)),
    insuranceRemaining,
    totalOwing,
  };
};

export const lateFeeService = {
  LATE_FEE_TIERS,
  isLateFeeTier,
  bucketFor,
  daysOutstanding,
  basisAmount,
  feeAmountFor,
  findChargedLateFees,
  chargeKey,
  resolveTier,
  defaultRateFor,
  LATE_FEE_DEFAULT_RATES,
  outstandingSplit,
  eligibleInvoices,
};

/** Alias so call sites can `import { lateFee }` and read cleanly. */
export const lateFee = lateFeeService;

export default lateFeeService;