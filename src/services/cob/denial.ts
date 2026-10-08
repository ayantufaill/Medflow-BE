/**
 * COB-related denial detection.
 *
 * When a payer denies a claim because it believes another payer should have
 * paid first, that is the insurer overruling our suggested order. It is the
 * single most informative COB signal we ever get, and it arrives buried in
 * the adjustment codes on an 835.
 *
 * Pure, so the CARC list is testable without constructing a remittance.
 */

export interface AdjustmentCode {
  /** CO, PR, OA, PI, CR */
  groupCode: string;
  /** CARC — 22, 23, 109, ... */
  reasonCode: string;
  amount: number;
}

/**
 * Claim Adjustment Reason Codes that mean "bill the other payer".
 *
 *   22   "This care may be covered by another payer per coordination of
 *        benefits." The canonical COB denial.
 *   23   "The impact of prior payer(s) adjudication including payments
 *        and/or adjustments." Appears on correctly coordinated secondary
 *        claims too, so it is NOT treated as a denial on its own — see below.
 *   16   Missing information, when paired with the COB remark codes.
 *   109  "Claim/service not covered by this payer/contractor. Send to
 *        correct payer." Not strictly COB, but the same action: our order is
 *        wrong.
 *   199  Revenue code and procedure code do not match. Not COB.
 *
 * Only 22 and 109 are unambiguous COB order disputes, so only those two set
 * DISPUTED. Code 23 on a secondary claim is routine and flagging it would
 * raise a COB_DENIAL on every properly coordinated claim we ever file, which
 * would train staff to dismiss the flag.
 */
export const COB_DENIAL_CARCS = ['22', '109'] as const;

/** Codes that are COB-related but routine, and must not raise a flag. */
export const COB_INFORMATIONAL_CARCS = ['23'] as const;

const CARC_TEXT: Record<string, string> = {
  '22': 'This care may be covered by another payer per coordination of benefits',
  '109': 'Claim/service not covered by this payer/contractor — send to the correct payer',
};

export interface CobDenialDetection {
  isCobDenial: boolean;
  /** The codes that triggered it, with the payer's own wording. */
  matched: Array<{ groupCode: string; reasonCode: string; amount: number; text: string }>;
  /** What to tell the biller, and what to do next. */
  explanation: string | null;
}

/**
 * Looks for a COB order dispute in a remittance's adjustment codes.
 *
 * Also accepts free text, because a surprising share of denials reach us as
 * an EOB note typed in by a biller rather than as a parsed 835 — and the
 * phrase payers use is consistent enough to match on.
 */
export const detectCobDenial = (
  adjustments: AdjustmentCode[] = [],
  freeText?: string | null
): CobDenialDetection => {
  const matched: CobDenialDetection['matched'] = [];

  for (const adj of adjustments) {
    const code = String(adj.reasonCode || '').trim();
    if ((COB_DENIAL_CARCS as readonly string[]).includes(code)) {
      matched.push({
        groupCode: String(adj.groupCode || '').trim(),
        reasonCode: code,
        amount: Number(adj.amount) || 0,
        text: CARC_TEXT[code] || 'Coordination-of-benefits denial',
      });
    }
  }

  if (matched.length === 0 && freeText) {
    const text = String(freeText).toLowerCase();
    const phrases = [
      'coordination of benefits',
      'covered by another payer',
      'other insurance is primary',
      'send to correct payer',
      'primary payer information required',
    ];
    const hit = phrases.find((phrase) => text.includes(phrase));
    if (hit) {
      matched.push({
        groupCode: '',
        reasonCode: '',
        amount: 0,
        text: `Remittance text mentions "${hit}"`,
      });
    }
  }

  if (matched.length === 0) {
    return { isCobDenial: false, matched: [], explanation: null };
  }

  const codes = matched
    .filter((m) => m.reasonCode)
    .map((m) => `${m.groupCode ? `${m.groupCode}-` : ''}${m.reasonCode}`)
    .join(', ');

  return {
    isCobDenial: true,
    matched,
    explanation:
      `The payer denied this claim as a coordination-of-benefits issue` +
      `${codes ? ` (${codes})` : ''}: "${matched[0].text}". The payer's records put ` +
      `another plan ahead of this one, which contradicts the order we billed in. ` +
      `Re-verify eligibility with this payer to find out which plan they believe ` +
      `is primary, then either correct the coverage order or call the payer to ` +
      `have their records updated. Do not simply resubmit — it will deny again.`,
  };
};
