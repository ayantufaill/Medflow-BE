import { prisma } from '../config/db';
import { BadRequestError } from '../utils/error.util';
import { reportField, reportFields, operations, compileReportFilters, validateReportDefinition, reportDate, type ReportValue } from '../utils/reporting-fields.util';
import { reportingClinicWhere } from '../utils/reporting-scope.util';
import { patientReportRows } from './reporting-patient-data.service';

export const reportBuilderFields = () => Object.entries(reportFields).map(([field, type]) => ({ field, type, operators: operations[type], kinds: ['Code', 'Fee', 'Status', 'Date'].includes(field) ? ['Procedures'] : ['Patient', 'Procedures'] }));

export async function runCustomReport(options: { kind: string; filters: any[]; columns: string[]; page?: number; limit?: number; branchId?: string }) {
  validateReportDefinition(options);
  const page = Number(options.page ?? 1), limit = Number(options.limit ?? 50);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 500) throw new BadRequestError('Invalid report page or limit (maximum 500)');
  const matches = compileReportFilters(options.filters);
  const columns = options.columns.length ? options.columns : ['ID', 'First Name', 'Last Name'];
  const keys = columns.map(reportField);
  const data: Record<string, ReportValue>[] = [];
  let total = 0, cursor: bigint | undefined;
  // Scan bounded batches so derived-field filters apply before paging, with an
  // exact total. No arbitrary source-row cap or per-patient query loop.
  for (;;) {
    const where = reportingClinicWhere(options.branchId);
    const procedures = options.kind === 'Procedures';
    const rows: any[] = procedures
      ? await prisma.procedurelog.findMany({ where, take: 250, ...(cursor ? { cursor: { ProcNum: cursor }, skip: 1 } : {}), orderBy: { ProcNum: 'asc' }, include: { patient: true, procedurecode_procedurelog_CodeNumToprocedurecode: true } })
      : await prisma.patient.findMany({ where, take: 250, ...(cursor ? { cursor: { PatNum: cursor }, skip: 1 } : {}), orderBy: { PatNum: 'asc' } });
    if (!rows.length) break;
    const patients = procedures ? [...new Map(rows.filter(p => p.patient).map(p => [String(p.patient.PatNum), p.patient])).values()] : rows;
    const patientRows = await patientReportRows(patients);
    for (const source of rows) {
      const values: Record<string, ReportValue> = { ...(patientRows.get(String(source.PatNum)) ?? {}) };
      if (procedures) Object.assign(values, {
        ID: String(source.ProcNum), Code: source.procedurecode_procedurelog_CodeNumToprocedurecode?.ProcCode || source.OldCode || null,
        Fee: source.ProcFee ?? null, Date: reportDate(source.ProcDate),
        Status: ({ 1: 'Planned', 2: 'Complete', 3: 'Existing Current', 4: 'Existing Other', 5: 'Referred', 6: 'Deleted', 7: 'Condition', 8: 'Treatment Planned Inactive' } as any)[source.ProcStatus] ?? null,
      });
      if (!matches(values)) continue;
      if (total >= (page - 1) * limit && data.length < limit) data.push(Object.fromEntries(columns.map((col, i) => [col, values[keys[i]] ?? null])));
      total++;
    }
    cursor = procedures ? rows.at(-1).ProcNum : rows.at(-1).PatNum;
    if (rows.length < 250) break;
  }
  return { data, total, page, limit };
}
