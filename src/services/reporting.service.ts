import { prisma } from '../config/db';
import { 
  getReportMeta, 
  setReportMeta, 
  getAllSavedReports, 
  deleteReportMeta 
} from '../utils/opendental-auth.util';

export interface ReportFilter {
  field: string;
  operator: 'equals' | 'contains' | 'gt' | 'lt' | 'gte' | 'lte' | 'in';
  value: any;
}

export interface ReportOptions {
  kind: 'Patient' | 'Procedures' | 'Revenue';
  filters: ReportFilter[];
  columns: string[];
  page?: number;
  limit?: number;
}

export class ReportingService {
  async getSavedReports() {
    return getAllSavedReports();
  }

  async saveReport(data: { name: string, kind: string, filters: ReportFilter[], columns: string[] }) {
    const reportId = BigInt(Date.now()); // Simple unique ID
    await setReportMeta(reportId, data);
    return { _id: reportId.toString(), ...data };
  }

  async deleteReport(reportId: string) {
    await deleteReportMeta(BigInt(reportId));
  }

  async runReport(options: ReportOptions) {
    const { kind, filters, columns, page = 1, limit = 50 } = options;
    const skip = (page - 1) * limit;

    switch (kind) {
      case 'Patient':
        return this.runPatientReport(filters, columns, skip, limit);
      case 'Procedures':
        return this.runProcedureReport(filters, columns, skip, limit);
      case 'Revenue':
        return this.runRevenueReport(filters, columns, skip, limit);
      default:
        throw new Error(`Unsupported report kind: ${kind}`);
    }
  }

  private async runPatientReport(filters: ReportFilter[], columns: string[], skip: number, limit: number) {
    const where: any = {};

    filters.forEach(f => {
      const prismaField = this.mapPatientField(f.field);
      if (!prismaField) return;

      if (f.operator === 'contains') {
        where[prismaField] = { contains: f.value };
      } else if (f.operator === 'equals') {
        where[prismaField] = f.value;
      } else if (['gt', 'lt', 'gte', 'lte'].includes(f.operator)) {
        where[prismaField] = { [f.operator]: f.value };
      } else if (f.operator === 'in') {
        where[prismaField] = { in: f.value };
      }
    });

    const [data, total] = await Promise.all([
      prisma.patient.findMany({
        where,
        skip,
        take: limit,
        orderBy: { LName: 'asc' }
      }),
      prisma.patient.count({ where })
    ]);

    return {
      data: data.map(p => this.formatResult(p, columns)),
      total,
      page: Math.floor(skip / limit) + 1,
      limit
    };
  }

  private async runProcedureReport(filters: ReportFilter[], columns: string[], skip: number, limit: number) {
    const where: any = {};
    // Basic implementation for procedures
    const [data, total] = await Promise.all([
      prisma.procedurelog.findMany({
        where,
        skip,
        take: limit,
        include: { procedurecode_procedurelog_CodeNumToprocedurecode: true }
      }),
      prisma.procedurelog.count({ where })
    ]);

    return {
      data: data.map(p => this.formatResult(p, columns)),
      total,
      page: Math.floor(skip / limit) + 1,
      limit
    };
  }

  private async runRevenueReport(filters: ReportFilter[], columns: string[], skip: number, limit: number) {
    // Placeholder for revenue report
    return { data: [], total: 0, page: 1, limit };
  }

  private mapPatientField(feField: string): string | null {
    const map: Record<string, string> = {
      'Last Name': 'LName',
      'First Name': 'FName',
      'email': 'Email',
      'dob': 'Birthdate',
      'Inactive': 'PatStatus', // 2 is inactive
      'Total Outstanding Balance': 'BalTotal',
      'zip code': 'Zip',
    };
    return map[feField] || feField;
  }

  private formatResult(row: any, columns: string[]) {
    const result: any = {};
    columns.forEach(col => {
      const field = this.mapPatientField(col) || col;
      let val = row[field];
      
      // Handle BigInt
      if (typeof val === 'bigint') val = val.toString();
      
      result[col] = val;
    });
    return result;
  }
}

export const reportingService = new ReportingService();
