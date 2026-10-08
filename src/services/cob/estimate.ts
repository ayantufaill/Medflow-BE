/**
 * Secondary payment ESTIMATE.
 *
 * FOR DISPLAY ONLY. Every function here produces a number to show a patient
 * at the front desk, never a number to post. The actual secondary payment
 * comes from the secondary payer's remittance and nothing else — these four
 * methods are how plans SAY they coordinate, and plans routinely apply their
 * own wrinkles (their own allowable, their own deductible, bundling rules).
 *
 * The four methods, in the terms a biller would use:
 *
 *   STANDARD           Pay up to what this plan would have paid as primary,
 *                      less what the primary already paid. The classic
 *                      "fill the gap up to our own benefit" method.
 *   NON_DUPLICATION    Pay only the excess of our benefit over the primary's
 *                      payment — and nothing at all if the primary paid as
 *                      much as we would have. This is the method that
 *                      surprises patients: a good primary can leave the
 *                      secondary paying zero on a balance the patient then
 *                      owes.
 *   CARVE_OUT          Work out our benefit on the allowed amount, then
 *                      subtract the primary's payment from that. Similar to
 *                      standard but computed off the allowable, so it pays
 *                      less where the plans' allowables differ.
 *   REMAINING_BALANCE  Pay whatever the primary left of the allowed amount,
 *                      capped at our own benefit. The most generous.
 *
 * UNKNOWN is not a fifth method, it is an admission. `estimateRange` returns
 * the min and max across the four, because showing a single confident number
 * derived from a method nobody has confirmed is how a practice ends up
 * collecting the wrong amount at check-out.
 */

import type { CobPaymentMethod } from './types';

export interface SecondaryEstimateInput {
  /** What the provider billed. */
  billedAmount: number;
  /** The secondary's allowed/contracted amount for the service. */
  allowedAmount: number;
  /** What the primary actually paid (from its remittance). */
  primaryPaid: number;
  /** Patient responsibility the primary left (deductible + coinsurance + copay). */
  primaryPatientResponsibility: number;
  /** The secondary's own benefit percentage, 0-100. */
  secondaryCoveragePercent: number;
  /** Secondary deductible still to be met, if any. */
  secondaryDeductibleRemaining?: number;
}

export interface SecondaryEstimate {
  method: CobPaymentMethod;
  estimatedPayment: number;
  /** What the patient would owe after both payers, on this method. */
  estimatedPatientResponsibility: number;
  explanation: string;
}

export interface SecondaryEstimateRange {
  method: 'UNKNOWN';
  /** Lowest payment across the four methods. */
  minPayment: number;
  /** Highest payment across the four methods. */
  maxPayment: number;
  minPatientResponsibility: number;
  maxPatientResponsibility: number;
  perMethod: SecondaryEstimate[];
  explanation: string;
}

const round = (value: number): number => Math.round((Number(value) || 0) * 100) / 100;
const clampNonNegative = (value: number): number => (value > 0 ? round(value) : 0);
const money = (value: number): string => `$${round(value).toFixed(2)}`;

/** The four real methods. UNKNOWN is handled by `estimateRange`. */
export const COB_PAYMENT_METHODS: Exclude<CobPaymentMethod, 'UNKNOWN'>[] = [
  'STANDARD',
  'NON_DUPLICATION',
  'CARVE_OUT',
  'REMAINING_BALANCE',
];

/**
 * What this plan would have paid had it been primary, after its own
 * deductible. The basis for three of the four methods.
 */
const ownBenefit = (input: SecondaryEstimateInput): number => {
  const basis = input.allowedAmount > 0 ? input.allowedAmount : input.billedAmount;
  const afterDeductible = clampNonNegative(basis - (input.secondaryDeductibleRemaining || 0));
  return round(afterDeductible * (Number(input.secondaryCoveragePercent) || 0) / 100);
};

export const estimateForMethod = (
  method: Exclude<CobPaymentMethod, 'UNKNOWN'>,
  input: SecondaryEstimateInput
): SecondaryEstimate => {
  const benefit = ownBenefit(input);
  const primaryPaid = round(input.primaryPaid);
  const patientResp = round(input.primaryPatientResponsibility);
  // A secondary never pays more than the patient was actually left owing.
  // Paying beyond it would be paying the provider twice for the same money.
  const cap = patientResp;

  let payment = 0;
  let explanation = '';

  switch (method) {
    case 'STANDARD': {
      payment = Math.min(clampNonNegative(benefit - primaryPaid), cap);
      explanation =
        `Standard coordination: this plan would have paid ${money(benefit)} as ` +
        `primary, the primary paid ${money(primaryPaid)}, so it covers the ` +
        `${money(clampNonNegative(benefit - primaryPaid))} difference` +
        `${payment < clampNonNegative(benefit - primaryPaid) ? `, capped at the ${money(cap)} the patient was left owing` : ''}.`;
      break;
    }
    case 'NON_DUPLICATION': {
      const excess = clampNonNegative(benefit - primaryPaid);
      payment = Math.min(excess, cap);
      explanation =
        excess === 0
          ? `Non-duplication: the primary paid ${money(primaryPaid)}, which is at ` +
            `least the ${money(benefit)} this plan would have paid on its own, so it ` +
            `pays nothing and the patient is left with the ${money(cap)} balance.`
          : `Non-duplication: this plan pays only the excess of its own ` +
            `${money(benefit)} benefit over the primary's ${money(primaryPaid)} ` +
            `payment, so ${money(payment)}.`;
      break;
    }
    case 'CARVE_OUT': {
      const basis = input.allowedAmount > 0 ? input.allowedAmount : input.billedAmount;
      const carved = round(basis * (Number(input.secondaryCoveragePercent) || 0) / 100);
      payment = Math.min(clampNonNegative(carved - primaryPaid), cap);
      explanation =
        `Carve-out: this plan's benefit is calculated on the ${money(basis)} allowed ` +
        `amount (${input.secondaryCoveragePercent}% = ${money(carved)}), then the ` +
        `primary's ${money(primaryPaid)} payment is subtracted, leaving ` +
        `${money(payment)}.`;
      break;
    }
    case 'REMAINING_BALANCE': {
      const basis = input.allowedAmount > 0 ? input.allowedAmount : input.billedAmount;
      const leftOfAllowed = clampNonNegative(basis - primaryPaid);
      payment = Math.min(Math.min(leftOfAllowed, benefit), cap);
      explanation =
        `Remaining balance: the primary left ${money(leftOfAllowed)} of the ` +
        `${money(basis)} allowed amount, and this plan pays that up to its own ` +
        `${money(benefit)} benefit, so ${money(payment)}.`;
      break;
    }
  }

  payment = clampNonNegative(payment);
  return {
    method,
    estimatedPayment: payment,
    estimatedPatientResponsibility: clampNonNegative(patientResp - payment),
    explanation,
  };
};

/**
 * The UNKNOWN answer: a range, not a number.
 *
 * Deliberately returns the full per-method breakdown too. A biller who can
 * see that the spread is "$0 under non-duplication, $180 under remaining
 * balance" knows the one question worth asking the payer, which is how this
 * field stops being UNKNOWN.
 */
export const estimateRange = (input: SecondaryEstimateInput): SecondaryEstimateRange => {
  const perMethod = COB_PAYMENT_METHODS.map((method) => estimateForMethod(method, input));
  const payments = perMethod.map((e) => e.estimatedPayment);
  const responsibilities = perMethod.map((e) => e.estimatedPatientResponsibility);
  const minPayment = round(Math.min(...payments));
  const maxPayment = round(Math.max(...payments));

  return {
    method: 'UNKNOWN',
    minPayment,
    maxPayment,
    minPatientResponsibility: round(Math.min(...responsibilities)),
    maxPatientResponsibility: round(Math.max(...responsibilities)),
    perMethod,
    explanation:
      `This plan's coordination method is not confirmed, so the secondary payment ` +
      `can only be given as a range: between ${money(minPayment)} and ` +
      `${money(maxPayment)} depending on which method the plan actually uses. ` +
      `Confirm the method with the payer to narrow this. The amount posted will ` +
      `come from the remittance either way.`,
  };
};

/**
 * The single entry point. Returns an estimate when the method is known and a
 * range when it is not, so a caller cannot accidentally display a point
 * estimate for an unconfirmed plan.
 */
export const estimateSecondaryPayment = (
  method: CobPaymentMethod,
  input: SecondaryEstimateInput
): SecondaryEstimate | SecondaryEstimateRange =>
  method === 'UNKNOWN' ? estimateRange(input) : estimateForMethod(method, input);

export const isEstimateRange = (
  value: SecondaryEstimate | SecondaryEstimateRange
): value is SecondaryEstimateRange => value.method === 'UNKNOWN';
