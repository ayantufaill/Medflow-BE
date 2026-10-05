/**
 * Dental downgrade (alternate benefit / least-expensive-alternative) engine.
 *
 * Deliberately a pure module: no Prisma / Express imports, so the lookup rules
 * are unit-testable independently of the persistence layer — same convention as
 * deductible.service.ts.
 *
 * A downgrade lets a plan pay for a cheaper procedure instead of the one the
 * dentist billed. The classic case is a crown (`D2740`) downgraded to a core
 * buildup (`D2791`), or posterior composite downgraded to amalgam.
 *
 * Critical distinction — what a downgrade changes:
 *
 *   insurance pays = (allowed fee of the DOWNGRADE code - deductible) x percent
 *   patient owes   = fee for the code actually done - insurance pays
 *
 * The patient share must NOT be derived from the downgrade fee. The patient
 * received the real procedure and owes the difference between its fee and what
 * insurance pays; deriving it from the downgrade fee silently under-bills them.
 * See `applyDowngradeSplit` — the caller owns that correction.
 *
 * The billed code is never rewritten. The payer applies the alternate benefit
 * itself at adjudication; nothing is signalled on the 837.
 *
 * Exactly ONE downgrade level is applied (A -> B, never A -> B -> C). The map is
 * built in a single pass and a rule's `downgrade` target is never itself
 * resolved, so a cycle cannot arise.
 *
 * FEATURE FLAG NOTE: this engine is opt-in per row via `hasDowngrade`. There is
 * no plan-level switch — the row flag is already the user saying "apply this".
 */

import { normalizeCode, toAmount } from './deductible.service';

/** Where the teeth limit for a rule was found, for auditing/debugging. */
export type TeethSource = 'downgrade-row' | 'billed-row' | 'none';

export type DowngradeRule = {
  /** The billed procedure code this rule applies to (canonical `D####`). */
  code: string;
  /** The cheaper procedure the plan may substitute (canonical `D####`). */
  downgradeCode: string;
  /** Per-row allowed amount, used only as a fallback when the plan has no fee. */
  maxAllowed?: number;
  /**
   * Teeth this downgrade is limited to, as namespaced tooth keys.
   * Empty means unrestricted — the downgrade applies to every tooth.
   */
  teethLimit: ToothKey[];
  teethSource: TeethSource;
};

/**
 * A tooth identifier in a namespace that keeps permanent, primary and
 * supernumerary teeth distinct.
 *
 * Deliberately NOT collapsed onto universal numbers. Primary letters A-T sit in
 * a separate series, so mapping `A` -> 1 would make a limit of "1, 2, 3"
 * silently match primary teeth A, B and C — applying a downgrade to teeth the
 * plan never covered. Each series keeps its own identity and only matches a
 * limit that names the same series.
 *
 *   permanent     `P:1` .. `P:32`   (universal numbering)
 *   primary       `R:A` .. `R:T`     (retained primary dentition)
 *   supernumerary `S:AS` .. `S:KS`   (supernumerary primary)
 *   super adult   `A:51` .. `A:82`   (supernumerary permanent)
 */
export type ToothKey = string;

/**
 * Quadrant shorthand from the tooth picker. The coverage-book UI stores teeth
 * as universal numbers but also offers `Q1`-`Q4` chips for whole-quadrant
 * limits. A plan configured "posterior only" relies on these, so they expand to
 * their member permanent teeth.
 */
const QUADRANT_TEETH: Record<string, number[]> = {
  Q1: [1, 2, 3, 4, 5, 6, 7, 8],
  Q2: [9, 10, 11, 12, 13, 14, 15, 16],
  Q3: [17, 18, 19, 20, 21, 22, 23, 24],
  Q4: [25, 26, 27, 28, 29, 30, 31, 32],
};

/**
 * Canonical tooth key for a single token, or null when the token is not a
 * recognizable tooth.
 *
 * Accepts every form this codebase produces or persists:
 *   - universal numbers `1`-`32`, and supernumerary adult `51`-`82`
 *   - primary letters `A`-`T`
 *   - supernumerary primary `AS`, `BS`, ... `KS`
 *   - quadrant shorthand `Q1`-`Q4` (only meaningful in a limit)
 *   - surface / arch qualifiers: `3M`, `14MO`, `UR6`
 *
 * A bare number above 32 but below 51 is rejected as implausible, while 51-82 is
 * accepted as the supernumerary permanent series.
 */
// Arch / quadrant shorthand. These name a whole quadrant, never a single
  // tooth, and must be rejected before the primary-tooth match below — `LL`
  // would otherwise parse as tooth `L` carrying a surface suffix.
const ARCH_TOKENS = new Set(['UR', 'UL', 'LR', 'LL', 'UA', 'LA']);

export const normalizeTooth = (raw: unknown): ToothKey | null => {
  if (raw === null || raw === undefined) return null;

  const text = String(raw).trim().toUpperCase();
  if (!text) return null;

  // A range ("1-3", "4,5,6") is not a single tooth; the caller handles those.
  if (/[-,/]/.test(text)) return null;
  if (ARCH_TOKENS.has(text)) return null;

  // Supernumerary primary: a letter followed by a REQUIRED `S` (e.g. `AS`). The
  // suffix must be present, otherwise a bare primary letter would be captured
  // here instead of in its own series.
  const superPrimary = text.match(/^([A-T])S$/);
  if (superPrimary) return `S:${superPrimary[1]}S`;

  // Retained primary dentition, optionally carrying a surface suffix
  // ("AM" == primary tooth A, mesial surface).
  const primary = text.match(/^([A-T])(?:[A-Z]{1,2})?$/);
  if (primary) return `R:${primary[1]}`;

  // Strip surface and arch qualifiers in either position:
  //   "3M"  -> 3   (surface suffix)   "14MO" -> 14
  //   "UR6" -> 6   (arch prefix)       "UR" / "LL" alone is an arch with no
  //                                     single tooth, so it falls through.
  const numeric = text.match(/^(?:[A-Z]{1,2})?(\d{1,2})(?:[A-Z]{1,2})?$/);
  if (numeric) {
    const n = parseInt(numeric[1], 10);
    if (n >= 1 && n <= 32) return `P:${n}`;
    if (n >= 51 && n <= 82) return `A:${n}`;
    return null;
  }

  return null;
};

/**
 * Expand a stored `teethLimit` (comma-separated string or array) into the set
 * of tooth keys it covers. Quadrant tokens expand to their member permanent
 * teeth so `Q1` matches tooth 6. Unparseable tokens are dropped rather than
 * throwing — a malformed limit must not break pricing.
 *
 * Returns null when the row expresses NO limit at all, which the caller treats
 * as "downgrade applies to every tooth".
 */
export const parseTeethLimit = (raw: unknown): ToothKey[] | null => {
  if (raw === null || raw === undefined) return null;

  const tokens: string[] = Array.isArray(raw)
    ? raw.map((t) => String(t))
    : String(raw)
        .split(',')
        .map((t) => t.trim());

  const cleaned = tokens.filter((t) => t.length > 0);
  if (cleaned.length === 0) return null;

  const teeth = new Set<ToothKey>();
  for (const token of cleaned) {
    const upper = token.trim().toUpperCase();
    if (QUADRANT_TEETH[upper]) {
      for (const t of QUADRANT_TEETH[upper]) teeth.add(`P:${t}`);
      continue;
    }
    const single = normalizeTooth(upper);
    if (single !== null) teeth.add(single);
  }

  return teeth.size > 0 ? Array.from(teeth).sort() : null;
};

/**
 * Expand a procedure's `site` into the tooth keys it covers.
 *
 * `invoice.service.ts` treats a `site` longer than two characters as a RANGE
 * (e.g. `1-3`, `4,5,6`), so a range must expand to its members and be allowed
 * when the limit covers ANY of them. A procedure spanning both an included and
 * an excluded tooth is ambiguous, so this returns `null` for a mixed range —
 * the caller then treats the line as unprovable and declines to downgrade.
 *
 * Returns a single-element array for a plain tooth, or `null` when the site
 * names no recognizable tooth.
 */
export const parseTeethRange = (raw: unknown): ToothKey[] | null => {
  if (raw === null || raw === undefined) return null;

  const text = String(raw).trim().toUpperCase();
  if (!text || text === 'NONE') return null;

  // Plain single tooth: no separators, so it short-circuits to one key.
  if (!/[-,/]/.test(text)) {
    const single = normalizeTooth(text);
    return single ? [single] : null;
  }

  // A pure numeric span like "1-3" must be handled BEFORE splitting, otherwise
  // the separator consumes the span and it degrades to just its endpoints.
  const wholeSpan = text.match(/^(\d{1,2})\s*-\s*(\d{1,2})$/);
  if (wholeSpan) {
    const lo = parseInt(wholeSpan[1], 10);
    const hi = parseInt(wholeSpan[2], 10);
    if (lo >= 1 && hi <= 32 && hi >= lo) {
      const keys: ToothKey[] = [];
      for (let n = lo; n <= hi; n++) keys.push(`P:${n}`);
      return keys;
    }
    return null;
  }

  const parts = text.split(/[-,/]/).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;

  const keys: ToothKey[] = [];
  for (const part of parts) {
    const single = normalizeTooth(part);
    if (single) keys.push(single);
  }

  return keys.length > 0 ? Array.from(new Set(keys)).sort() : null;
};

/** True when a row's `teethLimit` restricts the downgrade to certain teeth. */
export const isToothAllowed = (
  limit: ToothKey[] | null,
  teeth: ToothKey | ToothKey[] | null | undefined
): boolean => {
  // No configured limit => the downgrade applies to every tooth.
  if (limit === null || limit.length === 0) return true;

  const list = (Array.isArray(teeth) ? teeth : teeth ? [teeth] : []).filter(Boolean);
  // A limit exists but the procedure has no tooth (e.g. a lab-only line).
  // Do not downgrade: we cannot prove the tooth qualifies.
  if (list.length === 0) return false;

  // Every tooth the procedure covers must be in the limit. A multi-tooth
  // procedure spanning one included and one excluded tooth is ambiguous, so it
  // is declined rather than guessed at.
  return list.every((t) => limit.includes(t));
};

/**
 * Normalize a persisted `coverageBookData` array into downgrade rules.
 *
 * Rows look like:
 *   { code: 'D2740', hasDowngrade: true, downgrade: 'D2791', maxAllowed: '450' }
 *
 * A row is skipped when the flag is off, the target is blank, the target is not
 * a CDT code, or the target is the code itself (a self-reference would make the
 * substitution meaningless and could recurse).
 */
export const normalizeDowngradeRows = (coverageBookData: unknown): DowngradeRule[] => {
  if (!Array.isArray(coverageBookData)) return [];

  const rows = coverageBookData.filter(
    (row): row is Record<string, unknown> =>
      !!row && typeof row === 'object' && !Array.isArray(row)
  );

  // Pass 1: collect every row keyed by its own code. Used to resolve a limit
  // stored on either the billed row or the downgrade row — the UI has written
  // it to both places over time (the summary table stores teeth under the
  // downgrade code, older configs stored them on the billed row).
  const byCode = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const code = normalizeCode(row.code);
    if (code) byCode.set(code, row);
  }

  // Pass 2: build the rules. Single pass, so a downgrade target is never itself
  // resolved as a source rule — that is what guarantees a single level.
  const rules: DowngradeRule[] = [];
  for (const row of rows) {
    if (row.hasDowngrade !== true) continue;

    const code = normalizeCode(row.code);
    const downgradeCode = normalizeCode(row.downgrade);
    if (!code || !downgradeCode) continue;
    if (code === downgradeCode) continue;

    // Prefer the downgrade row's limit (current UI behaviour), fall back to the
    // billed row so plans configured before that change still restrict teeth.
    const dgTeeth = parseTeethLimit(byCode.get(downgradeCode)?.teethLimit);
    const billedTeeth = parseTeethLimit(row.teethLimit);
    const teethLimit = dgTeeth ?? billedTeeth ?? [];
    const teethSource: TeethSource =
      dgTeeth !== null ? 'downgrade-row' : billedTeeth !== null ? 'billed-row' : 'none';

    const maxAllowed = toAmount(row.maxAllowed) || undefined;

    rules.push({ code, downgradeCode, maxAllowed, teethLimit, teethSource });
  }

  return rules;
};

/** Index rules by their billed code for O(1) lookup in the pricing loop. */
export const buildDowngradeMap = (
  coverageBookData: unknown
): Map<string, DowngradeRule> => {
  const map = new Map<string, DowngradeRule>();
  for (const rule of normalizeDowngradeRows(coverageBookData)) {
    map.set(rule.code, rule);
  }
  return map;
};

/**
 * Resolve the downgrade rule for a billed procedure.
 *
 * `teeth` is the procedure's tooth key(s) from `parseTeethRange(item.site)` —
 * an array when the site is a range. Pass null for a toothless line. A rule
 * limited to certain teeth does NOT apply to a toothless line, and a range
 * spanning an excluded tooth is declined as ambiguous — we only downgrade when
 * we can prove the teeth qualify.
 *
 * NOTE: this performs no fee check. The plan's fee schedules live in
 * invoice.service.ts, so "no fee for the downgrade code -> skip the downgrade"
 * is decided by the caller, which also sets the audit flag.
 */
/** Outcome of a downgrade lookup, distinguishing "no rule" from "tooth blocked". */
export type DowngradeLookup = {
  rule: DowngradeRule | null;
  /**
   * Set when a rule EXISTS for this code but was not applied:
   *   'tooth' — the rule's teeth limit excludes this procedure's tooth
   * Null when there is no rule at all, or when the rule applied.
   */
  skipped: 'tooth' | null;
};

export const resolveDowngrade = (
  code: unknown,
  map: Map<string, DowngradeRule> | null | undefined,
  tooth?: ToothKey | ToothKey[] | null
): DowngradeLookup => {
  if (!map || map.size === 0) return { rule: null, skipped: null };

  const key = normalizeCode(code);
  if (!key) return { rule: null, skipped: null };

  const rule = map.get(key);
  if (!rule) return { rule: null, skipped: null };

  const allowed = isToothAllowed(
    rule.teethLimit.length > 0 ? rule.teethLimit : null,
    tooth ?? null
  );


  // Report the tooth exclusion distinctly so the caller can record
  // `downgradeSkipped: 'tooth'` — silently returning null made this
  // indistinguishable from "this plan has no rule for this code".
  return allowed ? { rule, skipped: null } : { rule: null, skipped: 'tooth' };
};

/**
 * Split a priced line into insurance and patient portions under a downgrade.
 *
 * `applyDeductible` derives the patient share from the basis fee it was given.
 * When the basis was the downgrade fee that share is too low — the patient
 * received the real procedure. This recomputes the patient portion from the
 * billed charge, and reports the parts separately:
 *
 *   contractualWriteOff = contracted discount (from the BILLED code)
 *   insurancePortion    = what the plan pays (priced on the DOWNGRADE fee)
 *   patientPortion      = charge - contractualWriteOff - insurancePortion
 *
 * The deductible the patient satisfied is folded into the patient portion and
 * is deliberately NOT separated out here — secondary-splitting already treats
 * `deductibleApplied` as patient-only downstream.
 */
export const applyDowngradeSplit = (input: {
  charge: number;
  contractualWriteOff: number;
  insurancePortion: number;
}): { patientPortion: number; coinsurance: number } => {
  const charge = Math.max(0, Number(input.charge) || 0);
  const writeOff = Math.max(0, Number(input.contractualWriteOff) || 0);
  const insurancePortion = Math.max(0, Number(input.insurancePortion) || 0);

  const patientPortion = Math.max(0, charge - writeOff - insurancePortion);

  return {
    patientPortion,
    // Mirrors the non-downgrade path, where coinsurance IS the patient share.
    coinsurance: patientPortion,
  };
};
