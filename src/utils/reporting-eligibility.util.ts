// Current claim-state reporting; this does not measure historical first-pass denials.
export const SUBMITTED_CLAIM_STATES = ['S', 'P', 'R', 'T', 'D'] as const;
export const submittedClaimPredicate = `(
  cl."ClaimStatus" IN (${SUBMITTED_CLAIM_STATES.map(s => `'${s}'`).join(',')})
  OR (cl."ClaimStatus" = 'X' AND cl."DateSent" > DATE '1900-01-01')
)`;
