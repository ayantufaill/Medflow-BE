export interface DenialReasonRow {
  claimNum: string;
  narrative: string | null;
  reasonUnderPaid: string | null;
  adjustmentReasonCodes: string | null;
}

const nonBlankText = (value: unknown): string | null =>
  typeof value === 'string' ? value.trim() || null : null;

function getNarrativeReason(narrative: string | null): string | null {
  if (!narrative) return null;
  try {
    const metadata: unknown = JSON.parse(narrative);
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
    return nonBlankText((metadata as Record<string, unknown>).denialReason);
  } catch {
    // Legacy narratives can be plain text or malformed JSON. Try the next source.
    return null;
  }
}

/** Rows must belong to explicitly denied claims. Never infer denial from adjustments. */
export function getTopDenialReasons(rows: readonly DenialReasonRow[]): string[] {
  const claimsByReason = new Map<string, Set<string>>();

  for (const row of rows) {
    const reason = getNarrativeReason(row.narrative)
      ?? nonBlankText(row.reasonUnderPaid)
      ?? nonBlankText(row.adjustmentReasonCodes);
    if (!reason) continue;

    const claims = claimsByReason.get(reason) ?? new Set<string>();
    claims.add(row.claimNum);
    claimsByReason.set(reason, claims);
  }

  return [...claimsByReason.entries()]
    .sort(([reasonA, claimsA], [reasonB, claimsB]) =>
      claimsB.size - claimsA.size || (reasonA < reasonB ? -1 : reasonA > reasonB ? 1 : 0))
    .slice(0, 3)
    .map(([reason]) => reason);
}
