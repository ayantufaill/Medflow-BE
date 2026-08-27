import { prisma } from '../config/db';
import { ConflictError, NotFoundError } from '../utils/error.util';
import { getNextId } from '../utils/opendental-ids.util';
import type { FormFieldDefinition } from './form-template.service';

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
  requestId?: string;
  sourceSection?: string;
  submittedByRole?: string;
  // Compliance audit trail — who/where/what was submitted. templateFieldsSnapshot is
  // the template's `fields` array as it existed at submit time: it's what proves what
  // the patient actually saw and signed, independent of later template edits, and is
  // also what isConsentBearing() below uses to decide whether this submission is a
  // signed legal record that must be locked from further patient edits.
  ipAddress?: string | null;
  userAgent?: string | null;
  templateFieldsSnapshot?: FormFieldDefinition[] | null;
};

/** A submission is a signed legal record if the fields it was submitted against include a signature. */
const isConsentBearing = (meta: FormMeta): boolean =>
  Array.isArray(meta.templateFieldsSnapshot) &&
  meta.templateFieldsSnapshot.some((field) => field?.type === 'signature');

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
          requestId: meta.requestId ?? null,
          sourceSection: meta.sourceSection ?? null,
          submittedByRole: meta.submittedByRole ?? null,
          ipAddress: meta.ipAddress ?? null,
          userAgent: meta.userAgent ?? null,
          templateFieldsSnapshot: meta.templateFieldsSnapshot ?? null,
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
      requestId: meta.requestId ?? null,
      sourceSection: meta.sourceSection ?? null,
      submittedByRole: meta.submittedByRole ?? null,
      ipAddress: meta.ipAddress ?? null,
      userAgent: meta.userAgent ?? null,
      templateFieldsSnapshot: meta.templateFieldsSnapshot ?? null,
    };
  }

  async updateForm(
    formId: string,
    updates: {
      templateId?: string;
      formData?: any;
      requestId?: string;
      sourceSection?: string;
      submittedByRole?: string;
    }
  ) {
    const row = await prisma.commlog.findFirst({
      where: { Note: { contains: `"formPatNum":"${formId}"` } },
    });
    if (!row) {
      throw new NotFoundError('Form not found');
    }

    const meta = parseJson<FormMeta>(row.Note);

    // Consent forms (signature field present in the snapshot captured at submit
    // time) are a signed legal record once submitted — reject silent overwrites
    // instead of letting a patient edit a form they already signed.
    if ((meta.status ?? 'submitted') === 'submitted' && isConsentBearing(meta)) {
      throw new ConflictError(
        'This form includes a signature and has already been submitted. It cannot be edited.'
      );
    }

    const nowIso = new Date().toISOString();
    const nextMeta: FormMeta = {
      ...meta,
      type: 'patient_form',
      formPatNum: meta.formPatNum ?? formId,
      templateId: updates.templateId ?? meta.templateId,
      formData: updates.formData ?? meta.formData ?? {},
      status: meta.status ?? 'submitted',
      submittedAt: meta.submittedAt ?? nowIso,
      requestId: updates.requestId ?? meta.requestId,
      sourceSection: updates.sourceSection ?? meta.sourceSection,
      submittedByRole: updates.submittedByRole ?? meta.submittedByRole,
    };

    await prisma.commlog.update({
      where: { CommlogNum: row.CommlogNum },
      data: {
        Note: buildJson(nextMeta as unknown as Record<string, unknown>),
      },
    });

    return {
      _id: nextMeta.formPatNum ?? formId,
      patientId: row.PatNum?.toString() ?? null,
      templateId: nextMeta.templateId ?? null,
      formData: nextMeta.formData ?? null,
      status: nextMeta.status ?? 'submitted',
      submittedAt: nextMeta.submittedAt ? new Date(nextMeta.submittedAt) : row.CommDateTime ?? null,
      requestId: nextMeta.requestId ?? null,
      sourceSection: nextMeta.sourceSection ?? null,
      submittedByRole: nextMeta.submittedByRole ?? null,
      ipAddress: nextMeta.ipAddress ?? null,
      userAgent: nextMeta.userAgent ?? null,
      templateFieldsSnapshot: nextMeta.templateFieldsSnapshot ?? null,
    };
  }

  async createForm(data: {
    patientId: string;
    formData: any;
    templateId?: string;
    requestId?: string;
    sourceSection?: string;
    submittedByRole?: string;
    ipAddress?: string | null;
    userAgent?: string | null;
    templateFieldsSnapshot?: FormFieldDefinition[] | null;
  }) {
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
      requestId: data.requestId,
      sourceSection: data.sourceSection,
      submittedByRole: data.submittedByRole,
      ipAddress: data.ipAddress ?? null,
      userAgent: data.userAgent ?? null,
      templateFieldsSnapshot: data.templateFieldsSnapshot ?? null,
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
