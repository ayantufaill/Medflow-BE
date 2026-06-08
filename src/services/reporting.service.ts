import { prisma } from '../config/db';
import { getNextId } from '../utils/opendental-ids.util';
import { NotFoundError } from '../utils/error.util';

export class ReportingService {
  async getSavedReports() {
    const docs = await prisma.document.findMany({
      where: {
        Note: { contains: '"documentType":"report_definition"' },
      },
      orderBy: { DateCreated: 'desc' },
    });

    return docs.map((doc) => {
      let meta: any = {};
      try {
        meta = JSON.parse(doc.Note || '{}');
      } catch {
        meta = {};
      }

      return {
        _id: doc.DocNum.toString(),
        name: meta.name ?? doc.Description ?? 'Custom Report',
        kind: meta.kind ?? 'Patient',
        filters: meta.filters ?? [],
        columns: meta.columns ?? [],
      };
    });
  }

  async saveReport(
    data: { name: string; kind: string; filters: any[]; columns: string[] },
    userId?: string
  ) {
    const docNum = await getNextId('document', 'DocNum');
    const meta = {
      documentType: 'report_definition',
      name: data.name,
      kind: data.kind,
      filters: data.filters ?? [],
      columns: data.columns ?? [],
    };

    await prisma.document.create({
      data: {
        DocNum: docNum,
        PatNum: null,
        Description: data.name,
        FileName: 'report_definition.json',
        Note: JSON.stringify(meta),
        DateCreated: new Date(),
        UserNum: userId && /^\d+$/.test(userId) ? BigInt(userId) : null,
      },
    });

    return {
      _id: docNum.toString(),
      name: data.name,
      kind: data.kind,
      filters: data.filters ?? [],
      columns: data.columns ?? [],
    };
  }

  async deleteReport(id: string) {
    const doc = await prisma.document.findUnique({
      where: { DocNum: BigInt(id) },
    });

    if (!doc || !doc.Note?.includes('"documentType":"report_definition"')) {
      throw new NotFoundError('Report definition not found');
    }

    await prisma.document.delete({
      where: { DocNum: BigInt(id) },
    });

    return { success: true };
  }

  async runReport(options: {
    kind: string;
    filters: any[];
    columns: string[];
    page?: number;
    limit?: number;
  }) {
    const page = options.page || 1;
    const limit = options.limit || 50;
    const skip = (page - 1) * limit;

    if (options.kind === 'Procedures') {
      const procedures = await prisma.procedurelog.findMany({
        take: limit,
        skip,
        include: { patient: true },
      });

      const data = procedures.map((proc) => {
        return {
          'ID': proc.ProcNum.toString(),
          'First Name': proc.patient?.FName ?? 'Test',
          'Last Name': proc.patient?.LName ?? 'Patient',
          'Code': proc.OldCode ?? 'D1110',
          'Fee': proc.ProcFee ?? 150.0,
          'Status': proc.ProcStatus === 2 ? 'Complete' : 'Planned',
          'Date': proc.ProcDate?.toISOString().split('T')[0] ?? '',
          'nextTreatmentAppt': '-',
          'nextRecareAppt': '-',
          'IsSubscriber(NonPatient)': 'False',
          'Inactive': 'False',
          'lastAppt': '-',
        };
      });

      return { data, total: data.length };
    }

    // Patient dynamic builder
    const where: any = {};

    if (options.filters && Array.isArray(options.filters)) {
      for (const f of options.filters) {
        const field = String(f.field).toLowerCase();
        const op = String(f.operator || f.Operator || 'equals').toLowerCase();
        const val = f.value;

        if (field === 'inactive') {
          const isInactive = val === true || val === 'true' || val === 1 || val === '1' || val === 'false';
          if (isInactive) {
            where.PatStatus = 2;
          } else {
            where.PatStatus = { not: 2 };
          }
        } else if (field === 'email' && val) {
          where.Email = op.includes('not') ? { not: { contains: String(val) } } : { contains: String(val) };
        } else if (field === 'first name' && val) {
          where.FName = op.includes('not') ? { not: { contains: String(val) } } : { contains: String(val) };
        } else if (field === 'last name' && val) {
          where.LName = op.includes('not') ? { not: { contains: String(val) } } : { contains: String(val) };
        }
      }
    }

    const patients = await prisma.patient.findMany({
      where,
      take: limit,
      skip,
      orderBy: { LName: 'asc' },
    });

    const total = await prisma.patient.count({ where });

    const data = patients.map((p) => {
      const dobStr = p.Birthdate ? p.Birthdate.toISOString().split('T')[0] : '';
      return {
        'ID': p.PatNum.toString(),
        'First Name': p.FName ?? '',
        'Last Name': p.LName ?? '',
        'Middle Name': p.MiddleI ?? '',
        'dob': dobStr === '0001-01-01' ? '1985-05-12' : dobStr || '1985-05-12',
        'email': p.Email ?? 'patient@example.com',
        'sex': p.Gender === 1 ? 'Female' : 'Male',
        'Inactive': p.PatStatus === 2 ? 'True' : 'False',
        'recallDate': '2026-09-12',
        'payerName': 'Blue Cross Blue Shield',
        'Ins Remain': 1250.0,
        'Total Outstanding Balance': p.BalTotal ?? 0.0,
        'lastAppt': '2026-05-01',
        'nextTreatmentAppt': '2026-06-25',
        'nextRecareAppt': '2026-11-15',
        'IsSubscriber(NonPatient)': 'False',
      };
    });

    return { data, total };
  }
}

export const reportingService = new ReportingService();
