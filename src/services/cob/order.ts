/**
 * Coordination of Benefits — the ranking pipeline.
 *
 * Pure: facts in, an ordered suggestion out. No Prisma, no clock, no request.
 * `cob.service.ts` loads the facts and persists the result; everything that
 * decides anything lives here, so a stored order can be replayed exactly from
 * the facts it was computed from.
 *
 * WHY A TOPOLOGICAL SORT AND NOT Array.sort
 * -----------------------------------------
 * The pairwise rules are not a comparator. They are not transitive: the rule
 * that decides (Medicare, employer plan) is a different rule from the one
 * that decides (employer plan, spouse's plan), and the two can combine into a
 * genuine cycle once a third coverage is involved. `Array.sort` with a
 * non-transitive comparator does not report that — it returns an arbitrary
 * order that silently depends on the input permutation and the engine's sort
 * implementation. So we build the directed graph the rules describe and sort
 * it topologically, which makes a cycle a detectable fact instead of a
 * plausible-looking wrong answer.
 */

import type {
  ClaimContext,
  CobRule,
  CoverageFacts,
  DetermineOrderResult,
  ExcludedCoverage,
  MissingField,
  OrderedPosition,
  ReviewFlag,
} from './types';
import { COB_RULES, evaluatePair, type PairOutcome } from './rules';
import { isActiveOn } from './date.util';

/** Numeric where possible so coverage 10 sorts after coverage 9, not before. */
const stableKey = (id: string): [number, string] => {
  const n = Number(id);
  return [Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER, id];
};

const compareStable = (a: string, b: string): number => {
  const [an, as] = stableKey(a);
  const [bn, bs] = stableKey(b);
  if (an !== bn) return an - bn;
  return as < bs ? -1 : as > bs ? 1 : 0;
};

export interface DetermineOrderOptions {
  /** Override the rule sequence. Tests only — production uses COB_RULES. */
  rules?: CobRule[];
}

/**
 * Step 1-5 of the pipeline. Steps 6 (payer comparison) and 7 (persistence)
 * are the service's, because they need the database.
 */
export const determineOrder = (
  coverages: CoverageFacts[],
  ctx: ClaimContext,
  options: DetermineOrderOptions = {}
): DetermineOrderResult => {
  const rules = options.rules || COB_RULES;
  const flags: ReviewFlag[] = [];
  const addFlag = (flag: ReviewFlag) => {
    if (!flags.includes(flag)) flags.push(flag);
  };

  // ── 1. Only coverages in force on the date of service ────────────────────
  const active = coverages.filter((c) =>
    isActiveOn(c.effectiveDate, c.terminationDate, ctx.dateOfService)
  );

  // ── 2. Set aside anything that is not medical coverage ───────────────────
  //
  // A fixed-benefit indemnity policy pays the PATIENT a flat sum per event.
  // It never receives this claim, never coordinates with the plans that do,
  // and its payment does not reduce what a real payer owes. Ranking it would
  // put a payer in the sequence that is not going to be billed. Dental and
  // vision are excluded for the same structural reason: a medical claim does
  // not coordinate against them.
  const excluded: ExcludedCoverage[] = [];
  const rankable: CoverageFacts[] = [];
  for (const c of active) {
    if (c.benefitCategory === 'MEDICAL') {
      rankable.push(c);
      continue;
    }
    const why =
      c.benefitCategory === 'FIXED_INDEMNITY'
        ? `${c.carrierName || `Coverage ${c.id}`} is a fixed-benefit indemnity policy. ` +
          `It pays the patient a set amount directly and takes no part in this ` +
          `claim's coordination, so it is listed here but not ranked. The patient ` +
          `may still be able to claim on it themselves.`
        : `${c.carrierName || `Coverage ${c.id}`} is ${c.benefitCategory.toLowerCase()} ` +
          `coverage, not medical, so it does not coordinate on this claim.`;
    excluded.push({
      coverageId: c.id,
      ruleCode: 'NOT_MEDICAL_COVERAGE',
      explanation: why,
    });
  }

  if (rankable.length === 0) {
    return {
      status: 'SUGGESTED',
      positions: [],
      excluded,
      flags,
      missingFields: [],
      pairwise: [],
    };
  }

  if (rankable.length === 1) {
    return {
      status: 'SUGGESTED',
      positions: [
        {
          position: 1,
          coverageId: rankable[0].id,
          ruleCode: 'SOLE_COVERAGE',
          explanation:
            `${rankable[0].carrierName || `Coverage ${rankable[0].id}`} is the only ` +
            `medical coverage in force on this date of service, so it is primary ` +
            `and there is nothing to coordinate with.`,
        },
      ],
      excluded,
      flags,
      missingFields: [],
      pairwise: [],
    };
  }

  // ── 3. Every pair, through the rule sequence ─────────────────────────────
  const pairwise: DetermineOrderResult['pairwise'] = [];
  const outcomes = new Map<string, PairOutcome>();
  const missingFields: MissingField[] = [];
  const seenMissing = new Set<string>();

  for (let i = 0; i < rankable.length; i++) {
    for (let j = i + 1; j < rankable.length; j++) {
      const a = rankable[i];
      const b = rankable[j];
      const outcome = evaluatePair(a, b, ctx, rules);
      outcomes.set(`${a.id}|${b.id}`, outcome);
      pairwise.push({
        aId: a.id,
        bId: b.id,
        ruleCode: outcome.ruleCode,
        decision: outcome.decision,
        explanation: outcome.explanation,
      });

      for (const flag of outcome.flags) addFlag(flag as ReviewFlag);

      // ── 4. A rule that needs data stops the pipeline for that pair ──────
      for (const field of outcome.missingFields) {
        const [coverageId, ...rest] = field.split('.');
        const key = field;
        if (seenMissing.has(key)) continue;
        seenMissing.add(key);
        missingFields.push({ coverageId, field: rest.join('.') || field });
      }
    }
  }

  // Never guess. One unanswerable pair makes the whole order unsafe to bill,
  // because the pair we could not decide may be the one the claim goes to.
  if (missingFields.length > 0) {
    return {
      status: 'NEEDS_INFO',
      positions: [],
      excluded,
      flags,
      missingFields,
      pairwise,
    };
  }

  // ── 5. Build the graph and sort it, detecting cycles ─────────────────────
  const ids = rankable.map((c) => c.id);
  const edges = new Map<string, Set<string>>(ids.map((id) => [id, new Set<string>()]));
  const decidedBy = new Map<string, PairOutcome>();

  for (let i = 0; i < rankable.length; i++) {
    for (let j = i + 1; j < rankable.length; j++) {
      const a = rankable[i];
      const b = rankable[j];
      const outcome = outcomes.get(`${a.id}|${b.id}`)!;
      if (outcome.decision === 'A_FIRST') {
        edges.get(a.id)!.add(b.id);
        decidedBy.set(`${a.id}->${b.id}`, outcome);
      } else if (outcome.decision === 'B_FIRST') {
        edges.get(b.id)!.add(a.id);
        decidedBy.set(`${b.id}->${a.id}`, outcome);
      }
      // UNDECIDED leaves no edge: the stable tie-break below orders them.
    }
  }

  const cycle = findCycle(ids, edges);
  const sorted = topoSort(ids, edges);

  const byId = new Map(rankable.map((c) => [c.id, c]));
  const positions: OrderedPosition[] = sorted.map((id, index) => {
    const self = byId.get(id)!;
    const neighbourId = index + 1 < sorted.length ? sorted[index + 1] : sorted[index - 1];
    const forward = decidedBy.get(`${id}->${neighbourId}`);
    const backward = decidedBy.get(`${neighbourId}->${id}`);
    const outcome = forward || backward;

    let ruleCode = 'TIE_BREAK_STABLE';
    let explanation =
      `No coordination rule could separate this coverage from ` +
      `${byId.get(neighbourId)?.carrierName || `coverage ${neighbourId}`}, so the ` +
      `order shown is only a stable fallback. Confirm it with the payer before ` +
      `relying on it.`;

    if (outcome) {
      ruleCode = outcome.ruleCode;
      explanation = outcome.explanation;
    }

    return { position: index + 1, coverageId: id, ruleCode, explanation };
  });

  if (cycle) {
    addFlag('RANKING_CYCLE');
    return {
      status: 'NEEDS_REVIEW',
      positions,
      excluded,
      flags,
      missingFields: [],
      pairwise,
    };
  }

  return {
    status: 'SUGGESTED',
    positions,
    excluded,
    flags,
    missingFields: [],
    pairwise,
  };
};

/**
 * Kahn's algorithm with a deterministic tie-break.
 *
 * The tie-break is what makes an UNDECIDED pair reproducible: without it the
 * same facts would produce different orders depending on map iteration, and a
 * stored order could not be trusted to mean anything. On a cyclic graph this
 * still returns a complete order (the remaining nodes in stable key order) so
 * the UI has something to show next to the RANKING_CYCLE flag — but the
 * caller has already set NEEDS_REVIEW and that order is not billable.
 */
const topoSort = (ids: string[], edges: Map<string, Set<string>>): string[] => {
  const inDegree = new Map<string, number>(ids.map((id) => [id, 0]));
  for (const [, targets] of edges) {
    for (const target of targets) {
      inDegree.set(target, (inDegree.get(target) || 0) + 1);
    }
  }

  const remaining = new Set(ids);
  const result: string[] = [];

  while (remaining.size > 0) {
    const ready = [...remaining]
      .filter((id) => (inDegree.get(id) || 0) === 0)
      .sort(compareStable);

    if (ready.length === 0) {
      // Cycle: every remaining node is pointed at by another remaining node.
      // Emit them in stable order so the result is still a complete list.
      for (const id of [...remaining].sort(compareStable)) result.push(id);
      break;
    }

    const next = ready[0];
    result.push(next);
    remaining.delete(next);
    for (const target of edges.get(next) || []) {
      if (remaining.has(target)) {
        inDegree.set(target, (inDegree.get(target) || 0) - 1);
      }
    }
  }

  return result;
};

/**
 * Returns the nodes of one cycle, or null. Iterative DFS with a colour map —
 * recursion would be fine at these sizes, but the explicit stack keeps the
 * path available for the flag detail, which is what a biller needs ("Medicare
 * before the group plan before the spouse's plan before Medicare").
 */
export const findCycle = (
  ids: string[],
  edges: Map<string, Set<string>>
): string[] | null => {
  const WHITE = 0;
  const GREY = 1;
  const BLACK = 2;
  const colour = new Map<string, number>(ids.map((id) => [id, WHITE]));
  const parent = new Map<string, string | null>();

  for (const start of [...ids].sort(compareStable)) {
    if (colour.get(start) !== WHITE) continue;

    const stack: Array<{ id: string; iter: string[]; index: number }> = [
      { id: start, iter: [...(edges.get(start) || [])].sort(compareStable), index: 0 },
    ];
    colour.set(start, GREY);
    parent.set(start, null);

    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      if (frame.index >= frame.iter.length) {
        colour.set(frame.id, BLACK);
        stack.pop();
        continue;
      }
      const next = frame.iter[frame.index++];
      const nextColour = colour.get(next);

      if (nextColour === GREY) {
        // Walk the grey path back to `next` to recover the cycle.
        const cycle: string[] = [next];
        let cursor: string | null | undefined = frame.id;
        while (cursor && cursor !== next) {
          cycle.push(cursor);
          cursor = parent.get(cursor);
        }
        cycle.reverse();
        return cycle;
      }

      if (nextColour === WHITE) {
        colour.set(next, GREY);
        parent.set(next, frame.id);
        stack.push({
          id: next,
          iter: [...(edges.get(next) || [])].sort(compareStable),
          index: 0,
        });
      }
    }
  }

  return null;
};

/**
 * Rebuilds the edge graph for a set of coverages. Exported so the service can
 * put the cycle path into the RANKING_CYCLE flag's detail without re-running
 * the whole pipeline.
 */
export const buildEdges = (
  coverages: CoverageFacts[],
  ctx: ClaimContext,
  rules: CobRule[] = COB_RULES
): Map<string, Set<string>> => {
  const edges = new Map<string, Set<string>>(coverages.map((c) => [c.id, new Set<string>()]));
  for (let i = 0; i < coverages.length; i++) {
    for (let j = i + 1; j < coverages.length; j++) {
      const a = coverages[i];
      const b = coverages[j];
      const outcome = evaluatePair(a, b, ctx, rules);
      if (outcome.decision === 'A_FIRST') edges.get(a.id)!.add(b.id);
      else if (outcome.decision === 'B_FIRST') edges.get(b.id)!.add(a.id);
    }
  }
  return edges;
};

export interface PayerReportedSnapshot {
  /** The coverage the payer was talking about. */
  coverageId: string | null;
  /** The position that payer claims for itself. 1 = "we are primary". */
  reportedSelfOrder: number | null;
  reportedDate: string;
  source: string;
  reportingCarrierName: string | null;
}

export interface PayerComparison {
  mismatch: boolean;
  detail: Array<{
    coverageId: string;
    ourPosition: number | null;
    payerReportedPosition: number;
    reportingCarrierName: string | null;
    reportedDate: string;
    source: string;
  }>;
  explanation: string | null;
}

/**
 * Step 6: our suggestion against what the insurers told us.
 *
 * This NEVER changes the order. The insurer decides who pays first in
 * reality, but it is the insurer that has to be billed in the order their own
 * records expect, and the two being out of step is a fact a human has to
 * resolve — usually by calling the payer, sometimes by fixing our data. All
 * this function does is say "these two disagree, here is exactly how".
 */
export const comparePayerReported = (
  positions: OrderedPosition[],
  reported: PayerReportedSnapshot[]
): PayerComparison => {
  const ourPosition = new Map(positions.map((p) => [p.coverageId, p.position]));
  const detail: PayerComparison['detail'] = [];

  // Latest report per coverage wins: a payer's current position statement
  // supersedes what they said last year.
  const latest = new Map<string, PayerReportedSnapshot>();
  for (const report of reported) {
    if (!report.coverageId || report.reportedSelfOrder == null) continue;
    const existing = latest.get(report.coverageId);
    if (!existing || report.reportedDate > existing.reportedDate) {
      latest.set(report.coverageId, report);
    }
  }

  for (const [coverageId, report] of latest) {
    const ours = ourPosition.get(coverageId) ?? null;
    if (ours !== null && ours === report.reportedSelfOrder) continue;
    detail.push({
      coverageId,
      ourPosition: ours,
      payerReportedPosition: report.reportedSelfOrder!,
      reportingCarrierName: report.reportingCarrierName,
      reportedDate: report.reportedDate,
      source: report.source,
    });
  }

  if (detail.length === 0) {
    return { mismatch: false, detail: [], explanation: null };
  }

  const ordinal = (n: number | null): string =>
    n === null
      ? 'not in the order at all'
      : n === 1
        ? 'primary'
        : n === 2
          ? 'secondary'
          : n === 3
            ? 'tertiary'
            : `position ${n}`;

  const lines = detail.map(
    (d) =>
      `${d.reportingCarrierName || `coverage ${d.coverageId}`} told us on ` +
      `${d.reportedDate} (${d.source.toLowerCase().replace(/_/g, ' ')}) that it is ` +
      `${ordinal(d.payerReportedPosition)}, but our rules place it ` +
      `${ordinal(d.ourPosition)}.`
  );

  return {
    mismatch: true,
    detail,
    explanation:
      `${lines.join(' ')} The payer's own records decide what they will actually ` +
      `pay, so this has to be settled before billing — re-verify eligibility or ` +
      `call the payer, then resolve this flag with what you found.`,
  };
};
