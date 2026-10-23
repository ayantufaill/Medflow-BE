import { BadRequestError } from './error.util';

export type ReportValue = string | number | boolean | null;
export type FieldType = 'text' | 'number' | 'boolean' | 'date';
export const reportFields: Record<string, FieldType> = {
  'ID': 'text', 'First Name': 'text', 'Last Name': 'text', 'Middle Name': 'text',
  dob: 'date', email: 'text', sex: 'text', Inactive: 'boolean',
  'Home Phone': 'text', 'Mobile Phone': 'text', 'street Address': 'text',
  'additional Address': 'text', city: 'text', state: 'text', 'zip code': 'text', country: 'text',
  recallDate: 'date', payerName: 'text', 'Ins Remain': 'number',
  'Total Outstanding Balance': 'number', 'Patient Account Credit': 'number',
  lastAppt: 'date', nextTreatmentAppt: 'date', nextRecareAppt: 'date',
  'IsSubscriber(NonPatient)': 'boolean', householdHeadUUID: 'text', isHeadOfHousehold: 'boolean',
  newPatientDate: 'date', 'Preferred DDS': 'text', 'Preferred HYG': 'text',
  'Preferred DDS First Name': 'text', 'Preferred DDS Last Name': 'text',
  'Preferred HYG First Name': 'text', 'Preferred HYG Last Name': 'text',
  'patient.PoliciesPayers': 'text', 'Has Mychart Account': 'boolean', Flags: 'text',
  'Created from mychart': 'boolean', Code: 'text', Fee: 'number', Status: 'text', Date: 'date',
};
const key = (v: string) => v.toLowerCase().replace(/[\s.]/g, '');
export function reportField(field: unknown): string {
  const normalized = key(String(field));
  const found = Object.keys(reportFields).find(f => key(f) === normalized || (f === 'zip code' && normalized === 'zip'));
  if (!found) throw new BadRequestError(`Unsupported report field: ${String(field)}`);
  return found;
}
export const operations = {
  text: ['Equals', 'Not Equals', 'Contains', 'Not Contains', 'Starts With', 'Ends With', 'Empty', 'Not Empty'],
  number: ['Equals', 'Not Equals', 'Greater than', 'Less than', 'Greater than or equal', 'Less than or equal', 'Empty', 'Not Empty'],
  date: ['Equals', 'Not Equals', 'Greater than', 'Less than', 'Greater than or equal', 'Less than or equal', 'Empty', 'Not Empty'],
  boolean: ['Equals', 'Not Equals', 'Empty', 'Not Empty'],
};
export const reportDate = (v: unknown): string | null => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) || d.getUTCFullYear() <= 1900 ? null : d.toISOString().slice(0, 10);
};
function typedValue(value: unknown, type: FieldType): string | number | boolean {
  if (type === 'boolean') {
    if ([true, 1, 'true', '1'].includes(typeof value === 'string' ? value.toLowerCase().trim() : value as any)) return true;
    if ([false, 0, 'false', '0'].includes(typeof value === 'string' ? value.toLowerCase().trim() : value as any)) return false;
    throw new BadRequestError('Boolean filters require true or false');
  }
  if (type === 'number') {
    if (value === null || String(value).trim() === '' || !Number.isFinite(Number(value))) throw new BadRequestError('A numeric filter value is required');
    return Number(value);
  }
  if (type === 'date') {
    const text = String(value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || reportDate(text) !== text) throw new BadRequestError('Date filters require a valid YYYY-MM-DD date');
    return text;
  }
  if (typeof value !== 'string' && typeof value !== 'number') throw new BadRequestError('A text filter value is required');
  return String(value).toLowerCase();
}
export function compileReportFilters(filters: any[] = []) {
  if (!Array.isArray(filters) || filters.length > 50) throw new BadRequestError('Provide at most 50 filters');
  const compiled = filters.map(f => {
    if (!f || typeof f !== 'object') throw new BadRequestError('Invalid report filter');
    const field = reportField(f.field);
    let op = String(f.operator ?? f.Operator ?? 'Equals').trim().toLowerCase();
    if (op === 'equal' || op === 'equal to') op = 'equals';
    if (op === 'not equal' || op === 'not equal to') op = 'not equals';
    const type = reportFields[field];
    if (!operations[type].some(v => v.toLowerCase() === op)) throw new BadRequestError(`Unsupported operator '${op}' for ${field}`);
    return { field, type, op, value: ['empty', 'not empty'].includes(op) ? null : typedValue(f.value, type) };
  });
  return (row: Record<string, ReportValue>) => compiled.every(({ field, type, op, value }) => {
    const raw = row[field];
    const empty = raw === null || raw === undefined || (typeof raw === 'string' && !raw.trim());
    if (op === 'empty') return empty;
    if (op === 'not empty') return !empty;
    if (empty) return false;
    const actual = type === 'text' ? String(raw).toLowerCase() : raw;
    switch (op) {
      case 'equals': return actual === value;
      case 'not equals': return actual !== value;
      case 'contains': return String(actual).includes(String(value));
      case 'not contains': return !String(actual).includes(String(value));
      case 'starts with': return String(actual).startsWith(String(value));
      case 'ends with': return String(actual).endsWith(String(value));
      case 'greater than': return actual > value!;
      case 'less than': return actual < value!;
      case 'greater than or equal': return actual >= value!;
      case 'less than or equal': return actual <= value!;
      default: return false;
    }
  });
}
export function validateReportDefinition(options: { kind: string; filters?: any[]; columns?: string[] }) {
  if (!['Patient', 'Procedures'].includes(options.kind)) throw new BadRequestError(`Unsupported custom report kind: ${options.kind}`);
  if (!Array.isArray(options.columns) || options.columns.length > 60) throw new BadRequestError('Report columns must be an array of at most 60 fields');
  compileReportFilters(options.filters);
  for (const value of [...options.columns, ...(options.filters ?? []).map(f => f.field)]) {
    const field = reportField(value);
    if (options.kind === 'Patient' && ['Code', 'Fee', 'Status', 'Date'].includes(field)) throw new BadRequestError(`${field} is a Procedures field`);
  }
  compileReportFilters(options.filters);
}
