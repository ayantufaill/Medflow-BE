/**
 * Open Dental's single-character claim status codes, in one place.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * `claim.ClaimStatus` is a one-char code and the mapping lives in
 * claim.service.ts's `claimStatusToCode`. Several places outside that file
 * have to reason about the SAME vocabulary — "has a remittance come back?",
 * "is this claim still open?" — and each one that spells the letters out
 * inline is a copy that silently drifts the day a status is added.
 *
 * The groupings below are the questions actually asked of the code, named so
 * the caller states intent rather than a letter.
 */

export const CLAIM_STATUS_CODE = {
  /** Ready for submission, not sent. */
  READY: 'W',
  /** Sent to the payer. */
  SENT: 'S',
  /** Pending at the payer. */
  PENDING: 'P',
  /** Received — the payer adjudicated and paid. */
  RECEIVED: 'R',
  /** Partially paid. */
  PARTIAL: 'T',
  /** Denied by the payer. */
  DENIED: 'D',
  /** Rejected (clearinghouse or payer-level error). */
  REJECTED: 'X',
  /** Cancelled by the practice. */
  CANCELLED: 'C',
  /** On hold. */
  HOLD: 'H',
} as const;

export type ClaimStatusCode = (typeof CLAIM_STATUS_CODE)[keyof typeof CLAIM_STATUS_CODE];

/**
 * The payer has come back with a decision — paid, partly paid, or denied.
 *
 * A DENIAL COUNTS. The payer adjudicated and said no, which is a remittance:
 * a secondary claim is entitled to see that adjudication, and the population
 * whose primary denied is exactly the one that needs the secondary billed.
 * Treating only paid claims as adjudicated would strand them.
 */
export const ADJUDICATED_CLAIM_STATUS_CODES: readonly ClaimStatusCode[] = [
  CLAIM_STATUS_CODE.RECEIVED,
  CLAIM_STATUS_CODE.PARTIAL,
  CLAIM_STATUS_CODE.DENIED,
];

/**
 * Statuses that mean the claim is finished and the payer cannot change.
 *
 * Only CANCELLED on its own. RECEIVED is settled only when money actually
 * came with it — a received claim paying zero is still open, and a denied or
 * rejected claim is open because it has to be reworked (often because the
 * coverage order was wrong).
 */
export const CLOSED_CLAIM_STATUS_CODES: readonly ClaimStatusCode[] = [
  CLAIM_STATUS_CODE.CANCELLED,
];

export const isAdjudicated = (code: string | null | undefined): boolean =>
  (ADJUDICATED_CLAIM_STATUS_CODES as readonly string[]).includes(String(code ?? ''));
