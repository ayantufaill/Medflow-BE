import { prisma } from '../config/db';
import { NotFoundError } from '../utils/error.util';
import { getNextId } from '../utils/opendental-ids.util';

const parseJson = <T>(value?: string | null): T => {
  if (!value) return {} as T;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? (parsed as T) : ({} as T);
  } catch {
    return {} as T;
  }
};

const buildJson = (value: Record<string, unknown>) => JSON.stringify(value);

type FormMeta = {
  type?: string;
  formPatNum?: string;
  formData?: any;
  templateId?: string;
  status?: string;
  submittedAt?: string;
};

export class PatientFormService {
  async getAllForms(page = 1, limit = 10, patientId?: string) {
    const skip = (page - 1) * limit;
    const where: any = { Note: { contains: '"type":"patient_form"' } };
    if (patientId) where.PatNum = BigInt(patientId);

    const [rows, total] = await Promise.all([
      prisma.commlog.findMany({
        where,
        orderBy: { CommDateTime: 'desc' },
        skip,
        take: limit,
      }),
      prisma.commlog.count({ where }),
    ]);

    return {
      forms: rows.map((row) => {
        const meta = parseJson<FormMeta>(row.Note);
        return {
          _id: meta.formPatNum ?? row.CommlogNum.toString(),
          patientId: row.PatNum?.toString() ?? null,
          templateId: meta.templateId ?? null,
          formData: meta.formData ?? null,
          status: meta.status ?? 'submitted',
          submittedAt: meta.submittedAt ? new Date(meta.submittedAt) : row.CommDateTime ?? null,
        };
      }),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getFormById(formId: string) {
    const row = await prisma.commlog.findFirst({
      where: { Note: { contains: `"formPatNum":"${formId}"` } },
    });
    if (!row) {
      throw new NotFoundError('Form not found');
    }

    const meta = parseJson<FormMeta>(row.Note);
    return {
      _id: meta.formPatNum ?? formId,
      patientId: row.PatNum?.toString() ?? null,
      templateId: meta.templateId ?? null,
      formData: meta.formData ?? null,
      status: meta.status ?? 'submitted',
      submittedAt: meta.submittedAt ? new Date(meta.submittedAt) : row.CommDateTime ?? null,
    };
  }

  async createForm(data: { patientId: string; formData: any; templateId?: string }) {
    const nextId = await getNextId('formpat', 'FormPatNum');
    await prisma.formpat.create({
      data: {
        FormPatNum: nextId,
        PatNum: BigInt(data.patientId),
        FormDateTime: new Date(),
      },
    });

    const payload: FormMeta = {
      type: 'patient_form',
      formPatNum: nextId.toString(),
      formData: data.formData,
      templateId: data.templateId,
      status: 'submitted',
      submittedAt: new Date().toISOString(),
    };

    const commlogNum = await getNextId('commlog', 'CommlogNum');
    await prisma.commlog.create({
      data: {
        CommlogNum: commlogNum,
        PatNum: BigInt(data.patientId),
        CommDateTime: new Date(),
        Note: buildJson(payload),
      },
    });

    return { _id: nextId.toString(), ...payload, patientId: data.patientId };
  }

  async deleteForm(formId: string) {
    const row = await prisma.formpat.findUnique({
      where: { FormPatNum: BigInt(formId) },
    });
    if (!row) {
      throw new NotFoundError('Form not found');
    }

    const commlog = await prisma.commlog.findFirst({
      where: { Note: { contains: `"formPatNum":"${formId}"` } },
    });
    if (commlog) {
      await prisma.commlog.delete({ where: { CommlogNum: commlog.CommlogNum } });
    }
    await prisma.formpat.delete({ where: { FormPatNum: row.FormPatNum } });

    return { message: 'Form deleted successfully' };
  }
}

export const patientFormService = new PatientFormService();
