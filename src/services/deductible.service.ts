/**
 * Dental deductible engine.
 *
 * Deliberately a pure module: no Prisma / Express imports, so the calculation
 * rules are unit-testable independently of the persistence layer.
 *
 * Model — every row in `deductiblesGrid` is an INDEPENDENT pool
 * (Standard / Preventative / Basic / Major / Orthodontics, plus any
 * CDT-code-specific rows the user added). A procedure drains exactly one pool,
 * resolved as:
 *
 *     exact CDT code  ->  category row  ->  Standard row  ->  no deductible
 *
 * A pool's remaining balance is `max(0, tier - metAmount)`, and balances are
 * consumed in date-of-service order across the whole claim — never per line.
 *
 * Money is always computed against the ALLOWED / contracted fee. The
 * contractual write-off (`charge - basisFee`) is deliberately excluded from
 * every calculation here.
 *
 * Calculation order matters: the deductible is applied to the allowed amount
 * BEFORE coinsurance, so it can never exceed the initial patient coinsurance.
 *
 *   deductibleApplied = min(remaining, basisFee)
 *   afterDed          = basisFee - deductibleApplied
 *   insurance         = afterDed * coveragePercent
 *   coinsurance       = afterDed - insurance
 *   patient           = deductibleApplied + coinsurance
 */

export type DeductibleTier = 'individual' | 'family';

export type DeductibleRow = {
  type?: string;
  typeKey?: string;
  lifetime?: boolean;
  standard?: boolean;
  individual?: number | string | null;
  family?: number | string | null;
  metAmount?: number | string | null;
  metDate?: string | null;
};

export type NormalizedDeductibleRow = {
  typeKey: string;
  type: string;
  lifetime: boolean;
  standard: boolean;
  individual: number;
  family: number;
  /** True when the `family` field was actually filled in (vs. left blank). */
  familyProvided: boolean;
  metAmount: number;
  metDate: string | null;
};

export type DeductibleLineResult = {
  deductibleApplied: number;
  afterDeductible: number;
  insurancePortion: number;
  coinsurance: number;
  patientPortion: number;
  rowKey: string | null;
};

const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * The deductible grid represents separate deductible configurations, so the
 * `standard` flag is stored as metadata only. Treating it as a "deductible
 * waived" gate would silently zero out real deductibles until that meaning is
 * confirmed with the client.
 */
export const STANDARD_FLAG_IS_METADATA_ONLY = true;

const CODE_ROW_RE = /^D?\d{4,5}$/i;
const CODE_KEY_RE = /^D?(\d{4,5})$/;

/** Category row keys the grid can express directly. */
export const CATEGORY_ROW_KEYS = [
  'standard',
  'preventative',
  'basic',
  'major',
  'orthodontics',
] as const;

/** Parse a money-ish value ("$1,250.00", "1250", 1250) into a number. */
export const toAmount = (value: unknown): number => {
  if (value === null || value === undefined) return 0;
  const n =
    typeof value === 'number'
      ? value
      : parseFloat(String(value).replace(/[^0-9.-]+/g, ''));
  return Number.isFinite(n) && n > 0 ? round2(n) : 0;
};

const isBlank = (value: unknown): boolean =>
  value === null || value === undefined || String(value).trim() === '';

/** Normalize a procedure code to canonical `D####` form. Returns '' if not a code. */
export const normalizeCode = (raw: unknown): string => {
  const code = String(raw ?? '').toUpperCase().trim();
  const match = code.match(CODE_KEY_RE);
  return match ? `D${match[1]}` : '';
};

/**
 * Derive a stable row key from the free-text `type` field.
 *
 * The client-only `isCodeRow` flag cannot be trusted (rows already persisted
 * predate it), so the code-vs-category decision is derived from the string.
 */
export const deriveTypeKey = (type: unknown): string => {
  const value = String(type ?? '').trim();
  if (!value) return '';
  if (CODE_ROW_RE.test(value)) {
    return `code:${normalizeCode(value)}`;
  }
  return value.toLowerCase().replace(/[^a-z]/g, '');
};

const BASIC_PERIO_CODES = new Set([
  '4341',
  '4342',
  '4346',
  '4355',
  '4910',
  '4920',
  '4921',
]);

/**
 * Map a CDT code to one of the 12 internal coverage categories.
 *
 * This is the canonical version of the mapping that previously lived inline in
 * invoice.service.ts. Both the percentage lookup and the deductible must call
 * this same function — if they ever disagree, every estimate silently mis-deducts.
 * Periodontics carries a basic/major sub-key, matching the original lookup.
 */
export const mapCodeToCategory = (rawCode: unknown): string | null => {
  const code = String(rawCode ?? '').toUpperCase().trim();
  if (!code) return null;
  if (!/^D\d{4}/.test(code) && !/^\d{4}$/.test(code)) return null;

  const numMatch = code.match(/\d+/);
  if (!numMatch) return null;
  const num = parseInt(numMatch[0], 10);

  if (num < 1000) return 'diagnostic';
  if (num < 2000) return 'preventative';
  if (num < 3000) return 'restorative';
  if (num < 4000) return 'endodontics';
  if (num < 5000) {
    return BASIC_PERIO_CODES.has(numMatch[0])
      ? 'periodonticsbasic'
      : 'periodonticsmajor';
  }
  if (num < 5900) return 'prosthodonticsremovable';
  if (num < 6000) return 'maxillofacialprosthetics';
  if (num < 6200) return 'implantservices';
  if (num < 7000) return 'prosthodonticsfixed';
  if (num < 8000) return 'oralsurgery';
  if (num < 9000) return 'orthodontics';
  return 'adjunctgeneral';
};

/**
 * Collapse the 12 internal categories onto the 5 rows the grid can express.
 * `null` means "no matching row" — the resolver then falls through to Standard.
 */
const CATEGORY_TO_ROW: Record<string, string | null> = {
  // The grid has no Diagnostic row, so diagnostics fall through to Standard.
  diagnostic: null,
  // Likewise no Adjunct General row.
  adjunctgeneral: null,
  preventative: 'preventative',
  restorative: 'basic',
  endodontics: 'basic',
  periodonticsbasic: 'basic',
  periodonticsmajor: 'major',
  prosthodonticsremovable: 'major',
  maxillofacialprosthetics: 'major',
  implantservices: 'major',
  prosthodonticsfixed: 'major',
  oralsurgery: 'major',
  orthodontics: 'orthodontics',
};

export const categoryToDeductibleRow = (category: string | null): string | null =>
  category ? CATEGORY_TO_ROW[category] ?? null : null;

/**
 * Map a procedure's own coverage tier (from `procedurecode.CoverageCategory`)
 * onto the deductible-grid type key. This is the authoritative routing for the
 * deductible: a plan that splits a category into Basic and Major must not read
 * the delocalized CDT range and silently charge the Basic pool for a crown.
 */
export const tierKeyFromCoverageCategory = (value: unknown): string | null => {
  const norm = String(value ?? '').toLowerCase();
  if (!norm) return null;
  if (norm.includes('basic')) return 'basic';
  if (norm.includes('major')) return 'major';
  if (norm.includes('orthodontic')) return 'orthodontics';
  if (norm.includes('preventive')) return 'preventative';
  return null;
};

/** Normalize a persisted grid, deriving `typeKey` for legacy rows that lack it. */
export const normalizeDeductibleRows = (grid: unknown): NormalizedDeductibleRow[] => {
  if (!Array.isArray(grid)) return [];
  const rows: NormalizedDeductibleRow[] = [];
  for (const entry of grid) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as DeductibleRow;
    // Always derive from `type`: a client-supplied `typeKey` would let a stale or
    // malicious key silently misroute a procedure to the wrong deductible pool.
    const typeKey = deriveTypeKey(row.type);
    if (!typeKey) continue;
    // The grid's Family cell is blank by default and the client posts it as 0,
    // which is indistinguishable from a deliberate "no family deductible" once
    // it is persisted. Only treat `family` as configured when it carries an
    // amount, or when it is 0 *and* the individual amount is also 0 (an
    // explicitly empty row). Otherwise a blank Family field would zero out the
    // limit for every family-tiered plan.
    const individual = toAmount(row.individual);
    const family = toAmount(row.family);
    rows.push({
      typeKey,
      type: String(row.type ?? ''),
      lifetime: Boolean(row.lifetime),
      standard: Boolean(row.standard),
      individual,
      family,
      familyProvided: !isBlank(row.family) && (family > 0 || individual === 0),
      metAmount: toAmount(row.metAmount),
      metDate: row.metDate || null,
    });
  }
  return rows;
};

/**
 * Values of `patplan.Relationship` that all mean "this plan covers only the
 * patient". The column is the OpenDental enum (0=Self, 1=Spouse, 2=Child,
 * 3=Parent, 4=Other) and Prisma surfaces it as a BigInt, so the numeric `0`
 * has to be recognized alongside the label spellings the UI sends.
 */
const SELF_RELATIONSHIPS = new Set(['', 'self', 'sig', '0']);

/** Resolve which deductible tier (individual vs family) applies to a plan. */
export const resolveDeductibleTier = (input: {
  relationship?: string | number | bigint | null;
  patientsCovered?: number | null;
}): DeductibleTier => {
  const covered = Number(input?.patientsCovered ?? 0) || 0;
  // `String(0n)` and `String(0)` are both '0', so numeric and string enum
  // values collapse into one comparison.
  const relationship = String(input?.relationship ?? '').trim().toLowerCase();
  const isSelf = SELF_RELATIONSHIPS.has(relationship);
  return !isSelf || covered > 1 ? 'family' : 'individual';
};

/**
 * Per-claim running deductible balances.
 *
 * Seeded from persisted `metAmount` (which is what carries deductible state
 * between separate claims) and drained as lines are priced.
 */
export class DeductibleLedger {
  private readonly byCode = new Map<string, NormalizedDeductibleRow>();
  private readonly byCategory = new Map<string, NormalizedDeductibleRow>();
  private readonly balances = new Map<string, number>();
  private readonly applied = new Map<string, number>();
  private readonly tier: DeductibleTier;
  private readonly tierByCode: Map<string, string>;

  constructor(grid: unknown, tier: DeductibleTier = 'individual', tierByCode?: Map<string, string>) {
    this.tier = tier;
    this.tierByCode = tierByCode ?? new Map();
    for (const row of normalizeDeductibleRows(grid)) {
      // A family plan whose family deductible was left blank falls back to the
      // individual amount. An explicitly-entered 0 means "no deductible".
      const limit =
        tier === 'family' && !row.familyProvided ? row.individual : tier === 'family' ? row.family : row.individual;

      this.balances.set(row.typeKey, round2(Math.max(0, limit - row.metAmount)));
      if (row.typeKey.startsWith('code:')) {
        this.byCode.set(row.typeKey.slice('code:'.length), row);
      } else {
        this.byCategory.set(row.typeKey, row);
      }
    }
  }

  get tierUsed(): DeductibleTier {
    return this.tier;
  }

  /** exact CDT row -> category row -> Standard row -> no deductible */
  resolve(code: unknown): { row: NormalizedDeductibleRow | null; key: string | null } {
    const normalized = normalizeCode(code);
    if (normalized && this.byCode.has(normalized)) {
      return { row: this.byCode.get(normalized)!, key: `code:${normalized}` };
    }

    // The plan splits the same procedure category into Basic / Major pools, so a
    // numeric CDT range alone cannot route the deductible: a crown this carrier
    // classifies as a Major service must drain the Major pool, not the Basic one.
    // The category string lives on the procedure code itself.
    const explicitTier = tierKeyFromCoverageCategory(normalized ? this.tierByCode.get(normalized) : undefined);
    if (explicitTier && this.byCategory.has(explicitTier)) {
      return { row: this.byCategory.get(explicitTier)!, key: explicitTier };
    }

    const categoryRow = categoryToDeductibleRow(mapCodeToCategory(code));
    if (categoryRow && this.byCategory.has(categoryRow)) {
      return { row: this.byCategory.get(categoryRow)!, key: categoryRow };
    }

    if (this.byCategory.has('standard')) {
      return { row: this.byCategory.get('standard')!, key: 'standard' };
    }

    return { row: null, key: null };
  }

  remaining(key: string | null): number {
    if (!key) return 0;
    return this.balances.get(key) ?? 0;
  }

  /**
   * Draw `amount` down from a pool's running balance and record it as applied.
   * Called by `applyDeductible` after each line is priced.
   */
  recordApplied(key: string | null, amount: number): void {
    if (!key || !(amount > 0)) return;
    const current = this.balances.get(key) ?? 0;
    this.balances.set(key, round2(Math.max(0, current - amount)));
    this.applied.set(key, round2((this.applied.get(key) ?? 0) + amount));
  }

  /**
   * Reduce the balance for a row key without recording it as applied.
   * Used for pre-reserved amounts from existing claims.
   */
  reduceBalance(key: string | null, amount: number): void {
    if (!key || !(amount > 0)) return;
    const current = this.balances.get(key) ?? 0;
    this.balances.set(key, round2(Math.max(0, current - amount)));
  }

  /** Deductible applied per row key, for persisting back to `metAmount`. */
  appliedByRow(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [key, amount] of this.applied) {
      if (amount > 0) out[key] = amount;
    }
    return out;
  }
}

/**
 * Price a single line against its resolved deductible pool.
 *
 * `basisFee` MUST be the allowed/contracted fee — never the provider's billed
 * fee — and never a figure that already has the write-off subtracted.
 */
export const applyDeductible = (
  ledger: DeductibleLedger,
  code: unknown,
  basisFee: number,
  coveragePercent: number | undefined,
): DeductibleLineResult => {
  const basis = round2(Math.max(0, Number(basisFee) || 0));
  const { row, key } = ledger.resolve(code);

  if (!row) {
    const insurancePortion = round2((basis * (coveragePercent ?? 0)) / 100);
    const coinsurance = round2(basis - insurancePortion);
    return {
      deductibleApplied: 0,
      afterDeductible: basis,
      insurancePortion,
      coinsurance,
      patientPortion: coinsurance,
      rowKey: null,
    };
  }

  const deductibleApplied = round2(Math.min(ledger.remaining(key), basis));
  const afterDeductible = round2(basis - deductibleApplied);
  const insurancePortion = round2((afterDeductible * (coveragePercent ?? 0)) / 100);
  const coinsurance = round2(afterDeductible - insurancePortion);

  ledger.recordApplied(key, deductibleApplied);

  return {
    deductibleApplied,
    afterDeductible,
    insurancePortion,
    coinsurance,
    patientPortion: round2(deductibleApplied + coinsurance),
    rowKey: key,
  };
};

/**
 * Split a patient portion into the part a secondary carrier may pay and the
 * part that must stay with the patient.
 *
 * Only coinsurance is secondary-claimable. The deductible the patient has
 * already satisfied is not — transferring it would over-pay the secondary
 * carrier and understate the patient balance.
 */
export const splitSecondaryPortion = (
  patientPortion: number,
  deductibleApplied: number,
): { secondaryPortion: number; patientPortion: number } => {
  const pt = round2(Math.max(0, Number(patientPortion) || 0));
  const ded = round2(Math.max(0, Number(deductibleApplied) || 0));
  const transferable = round2(Math.max(0, pt - ded));
  return { secondaryPortion: transferable, patientPortion: round2(pt - transferable) };
};

/**
 * Aggregate `deductibleApplied` from priced items, grouped by deductible row.
 *
 * Lets callers persist `metAmount` without holding a ledger reference, so the
 * estimate function stays a pure-ish transform of its `items` input.
 */
export const aggregateAppliedByRow = (items: any[]): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const item of items || []) {
    const key = item?.deductibleRowKey;
    const amount = toAmount(item?.deductibleApplied);
    if (!key || !(amount > 0)) continue;
    out[key] = round2((out[key] ?? 0) + amount);
  }
  return out;
};

/**
 * Line indexes ordered by date of service.
 *
 * The deductible is a running balance, so allocation depends on the order lines
 * are priced. Undated lines sort last, and `a - b` is the tiebreak so
 * same-date procedures (e.g. several surfaces on one tooth) keep input order
 * and results do not shuffle between recalculations.
 */
export const orderIndexesByDate = (items: any[]): number[] => {
  const dateOf = (item: any): number => {
    const raw = item?.ProcDate ?? item?.procDate ?? item?.dateOfService ?? item?.date;
    if (!raw) return Number.MAX_SAFE_INTEGER;
    const time = raw instanceof Date ? raw.getTime() : new Date(raw).getTime();
    return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time;
  };

  return items
    .map((_, index) => index)
    .sort((a, b) => dateOf(items[a]) - dateOf(items[b]) || a - b);
};

/**
 * Add newly applied deductible to each row's `metAmount`, stamping `metDate` on
 * first application. Used when a claim is finalized, so the next claim seeds
 * from the correct balance.
 */
export const accumulateMetAmount = (
  grid: unknown,
  appliedByRow: Record<string, number>,
  appliedOn: string,
): unknown[] => {
  const rows = normalizeDeductibleRows(grid);
  const byKey = new Map(rows.map((row) => [row.typeKey, row]));

  for (const [key, delta] of Object.entries(appliedByRow || {})) {
    const row = byKey.get(key);
    if (!row || !(delta > 0)) continue;
    row.metAmount = round2(Math.min(row.individual || row.family || Infinity, row.metAmount + delta));
    if (!row.metDate) row.metDate = appliedOn;
  }

  return rows.map((row) => ({
    type: row.type,
    typeKey: row.typeKey,
    lifetime: row.lifetime,
    standard: row.standard,
    individual: row.individual,
    family: row.family,
    metAmount: row.metAmount,
    metDate: row.metDate,
  }));
};

/**
 * Normalize a grid for persistence: derive `typeKey`, coerce amounts to
 * numbers, and drop rows with no usable `type`. Applied on create/update so the
 * stored grid is never dependent on client-supplied `typeKey` or `isCodeRow`.
 */
export const normalizeDeductibleGrid = (grid: unknown): Record<string, any>[] =>
  normalizeDeductibleRows(grid).map((row) => ({
    type: row.type,
    typeKey: row.typeKey,
    lifetime: row.lifetime,
    standard: row.standard,
    individual: row.individual,
    family: row.family,
    metAmount: row.metAmount,
    metDate: row.metDate,
  }));

/**
 * The scalar `deductibleAmount` is a legacy plan-summary field: the plan's TOTAL
 * deductible, not the patient's remaining balance.
 *
 * Do not subtract `metAmount` here. Remaining balance is derived per procedure by
 * the engine from whichever deductible row actually resolves, so computing it
 * again against the Standard row would be both wrong (the row may not be
 * Standard) and redundant state. Keeping one source of truth for the plan total
 * is why this stays a plain total.
 *
 * Deriving from the Standard row also fixes a latent bug: the UI previously used
 * `row[0].individual`, which silently became 0 whenever the first row was blank.
 */
export const deriveDeductibleAmount = (grid: unknown, tier: DeductibleTier = 'individual'): number => {
  const rows = normalizeDeductibleRows(grid);
  const standard = rows.find((row) => row.typeKey === 'standard');
  if (!standard) return 0;
  const amount = tier === 'family' && standard.familyProvided ? standard.family : standard.individual;
  return round2(Math.max(0, amount));
};
