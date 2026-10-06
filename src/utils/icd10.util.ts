import { UnprocessableEntityError } from './error.util';

export const normalizeIcd10Code = (value: unknown): string | null => {
  if (value == null || value === '' || value === '-') return null;
  if (typeof value !== 'string') throw new UnprocessableEntityError('ICD code must be a string');
  const code = value.trim().toUpperCase();
  if (!code || code === '-') return null;
  if (!/^[A-Z][0-9][A-Z0-9](?:\.?[A-Z0-9]{1,4})?$/.test(code)) {
    throw new UnprocessableEntityError(`Invalid ICD-10 code: ${code}`);
  }
  const raw = code.replace('.', '');
  return raw.length > 3 ? `${raw.slice(0, 3)}.${raw.slice(3)}` : raw;
};

type DiagnosisItem = { id?: unknown; _id?: unknown; procTPNum?: unknown; icd?: unknown; dx?: unknown; procedures?: DiagnosisItem[]; [key: string]: any };
type NormalizedDiagnosisItem = DiagnosisItem & { icd: string | null };
type LookupClient = { icd10: { findMany: any } };
const itemId = (item: DiagnosisItem) => String(item.id ?? item._id ?? item.procTPNum ?? '');

/** Validate the entire payload before writes. Retain unchanged legacy diagnoses. */
export const validateIcd10Assignments = async (
  items: DiagnosisItem[], previousItems: DiagnosisItem[], db: LookupClient,
): Promise<NormalizedDiagnosisItem[]> => {
  const previous = new Map(previousItems.filter(item => itemId(item)).map(item => [itemId(item), item]));
  const candidates: string[] = [];
  const normalizeItem = (item: DiagnosisItem): NormalizedDiagnosisItem => {
    if (Array.isArray(item.procedures)) return { ...item, icd: null, procedures: item.procedures.map(normalizeItem) };
    const old = previous.get(itemId(item));
    const hasDiagnosis = Object.hasOwn(item, 'icd') || Object.hasOwn(item, 'dx');
    const value = hasDiagnosis ? (Object.hasOwn(item, 'icd') ? item.icd : item.dx) : old?.icd;
    // Existing erroneous CDT values remain editable without silently changing them.
    if (old && typeof value === 'string' && value === old.icd && value !== '' && value !== '-') return { ...item, icd: value };
    const code = normalizeIcd10Code(value);
    if (code) candidates.push(code);
    return { ...item, icd: code };
  };
  const normalized = items.map(normalizeItem);
  if (candidates.length) {
    const codes = [...new Set(candidates)];
    const rows: Array<{ Icd10Code: string | null }> = await db.icd10.findMany({
      where: { Icd10Code: { in: codes.flatMap(code => [code, code.replace('.', '')]) } },
      select: { Icd10Code: true },
    });
    const known = new Set(rows.map(row => normalizeIcd10Code(row.Icd10Code)));
    const missing = codes.filter(code => !known.has(code));
    if (missing.length) throw new UnprocessableEntityError(`ICD-10 code is not in the catalogue: ${missing.join(', ')}`);
  }
  return normalized;
};
