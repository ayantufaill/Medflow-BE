import { prisma } from '../config/db';
import { NotFoundError, ConflictError, ValidationError, BadRequestError } from '../utils/error.util';
import { logActivity } from '../utils/activity-logger.util';
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

type ClinicalNoteMeta = {
  appointmentId?: string;
  providerId?: string;
  templateId?: string;
  noteType?: string;
  chiefComplaint?: string;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  diagnosisCodes?: string[];
  structuredData?: any;
  historyOfPresentIllness?: string;
  physicalExam?: string;
  attachments?: string[];
  requiresFollowUp?: boolean;
  followUpDate?: string;
  isSigned?: boolean;
  signedAt?: string;
  signedBy?: string;
  lastEditedBy?: string;
};

export class ClinicalNoteService {
  private mapCommlogToClinicalNote(row: any, meta: ClinicalNoteMeta) {
    return {
      _id: row.CommlogNum.toString(),
      patientId: row.PatNum?.toString() ?? null,
      appointmentId: meta.appointmentId ?? null,
      providerId: meta.providerId ?? null,
      templateId: meta.templateId ?? null,
      noteType: meta.noteType ?? 'soap',
      chiefComplaint: meta.chiefComplaint ?? null,
      subjective: meta.subjective ?? null,
      objective: meta.objective ?? null,
      assessment: meta.assessment ?? null,
      plan: meta.plan ?? null,
      diagnosisCodes: meta.diagnosisCodes ?? [],
      structuredData: meta.structuredData ?? null,
      historyOfPresentIllness: meta.historyOfPresentIllness ?? null,
      physicalExam: meta.physicalExam ?? null,
      attachments: meta.attachments ?? [],
      requiresFollowUp: meta.requiresFollowUp ?? false,
      followUpDate: meta.followUpDate ? new Date(meta.followUpDate) : null,
      isSigned: meta.isSigned ?? false,
      signedAt: meta.signedAt ? new Date(meta.signedAt) : null,
      signedBy: meta.signedBy ?? null,
      lastEditedBy: meta.lastEditedBy ?? null,
      createdAt: row.CommDateTime ?? null,
    };
  }

  async getAllClinicalNotes(
    page = 1,
    limit = 10,
    filters: {
      search?: string;
      patientId?: string;
      providerId?: string;
      appointmentId?: string;
      noteType?: string;
      isSigned?: boolean;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filters.patientId) where.PatNum = BigInt(filters.patientId);
    if (filters.startDate || filters.endDate) {
      where.CommDateTime = {};
      if (filters.startDate) where.CommDateTime.gte = filters.startDate;
      if (filters.endDate) where.CommDateTime.lte = filters.endDate;
    }

    const rows = await prisma.commlog.findMany({
      where,
      orderBy: { CommDateTime: 'desc' },
    });

    let clinicalNotes = rows.map((row) => {
      const meta = parseJson<ClinicalNoteMeta>(row.Note);
      return this.mapCommlogToClinicalNote(row, meta);
    });

    if (filters.providerId) {
      clinicalNotes = clinicalNotes.filter((note: any) => note.providerId === filters.providerId);
    }
    if (filters.appointmentId) {
      clinicalNotes = clinicalNotes.filter((note: any) => note.appointmentId === filters.appointmentId);
    }
    if (filters.noteType) {
      clinicalNotes = clinicalNotes.filter((note: any) => note.noteType === filters.noteType);
    }
    if (filters.isSigned !== undefined) {
      clinicalNotes = clinicalNotes.filter((note: any) => note.isSigned === filters.isSigned);
    }
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      clinicalNotes = clinicalNotes.filter((note: any) => {
        const chiefComplaint = (note.chiefComplaint || '').toLowerCase();
        const noteType = (note.noteType || '').toLowerCase();
        return chiefComplaint.includes(searchLower) || noteType.includes(searchLower);
      });
    }

    const total = clinicalNotes.length;
    clinicalNotes = clinicalNotes.slice(skip, skip + limit);

    return {
      clinicalNotes,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getClinicalNoteById(clinicalNoteId: string) {
    const row = await prisma.commlog.findUnique({
      where: { CommlogNum: BigInt(clinicalNoteId) },
    });

    if (!row) {
      throw new NotFoundError('Clinical note not found');
    }

    const meta = parseJson<ClinicalNoteMeta>(row.Note);
    return this.mapCommlogToClinicalNote(row, meta);
  }

  async getClinicalNotesByPatient(patientId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      prisma.commlog.findMany({
        where: { PatNum: BigInt(patientId) },
        orderBy: { CommDateTime: 'desc' },
        skip,
        take: limit,
      }),
      prisma.commlog.count({ where: { PatNum: BigInt(patientId) } }),
    ]);

    return {
      clinicalNotes: rows.map((row) => {
        const meta = parseJson<ClinicalNoteMeta>(row.Note);
        return this.mapCommlogToClinicalNote(row, meta);
      }),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getClinicalNoteByAppointment(appointmentId: string) {
    const row = await prisma.commlog.findFirst({
      where: { Note: { contains: `"appointmentId":"${appointmentId}"` } },
      orderBy: { CommDateTime: 'desc' },
    });

    if (!row) return null;
    const meta = parseJson<ClinicalNoteMeta>(row.Note);
    return this.mapCommlogToClinicalNote(row, meta);
  }

  async createClinicalNote(
    data: {
      patientId: string;
      appointmentId: string;
      providerId: string;
      templateId?: string;
      noteType?: string;
      chiefComplaint?: string;
      subjective?: string;
      objective?: string;
      assessment?: string;
      plan?: string;
      diagnosisCodes?: string[];
      structuredData?: any;
      historyOfPresentIllness?: string;
      physicalExam?: string;
      attachments?: string[];
      requiresFollowUp?: boolean;
      followUpDate?: Date;
    },
    userId: string
  ) {
    const existing = await prisma.commlog.findFirst({
      where: {
        PatNum: BigInt(data.patientId),
        Note: { contains: `"appointmentId":"${data.appointmentId}"` },
      },
    });

    if (existing) {
      throw new ConflictError('A clinical note already exists for this appointment');
    }

    const commlogNum = await getNextId('commlog', 'CommlogNum');
    const meta: ClinicalNoteMeta = {
      appointmentId: data.appointmentId,
      providerId: data.providerId,
      templateId: data.templateId,
      noteType: data.noteType ?? 'soap',
      chiefComplaint: data.chiefComplaint,
      subjective: data.subjective,
      objective: data.objective,
      assessment: data.assessment,
      plan: data.plan,
      diagnosisCodes: data.diagnosisCodes,
      structuredData: data.structuredData,
      historyOfPresentIllness: data.historyOfPresentIllness,
      physicalExam: data.physicalExam,
      attachments: data.attachments ?? [],
      requiresFollowUp: data.requiresFollowUp ?? false,
      followUpDate: data.followUpDate ? data.followUpDate.toISOString() : undefined,
      isSigned: false,
      lastEditedBy: userId,
    };

    const clinicalNote = await prisma.commlog.create({
      data: {
        CommlogNum: commlogNum,
        PatNum: BigInt(data.patientId),
        CommDateTime: new Date(),
        Note: buildJson(meta),
        UserNum: null,
      },
    });

    await logActivity(
      userId,
      'created',
      'clinical_notes',
      clinicalNote.CommlogNum.toString(),
      undefined,
      this.mapCommlogToClinicalNote(clinicalNote, meta),
      undefined,
      undefined,
      'medium'
    );

    return this.mapCommlogToClinicalNote(clinicalNote, meta);
  }

  async updateClinicalNote(
    clinicalNoteId: string,
    updates: {
      chiefComplaint?: string;
      subjective?: string;
      objective?: string;
      assessment?: string;
      plan?: string;
      diagnosisCodes?: string[];
      structuredData?: any;
      historyOfPresentIllness?: string;
      physicalExam?: string;
      attachments?: string[];
      requiresFollowUp?: boolean;
      followUpDate?: Date;
    },
    userId: string
  ) {
    const clinicalNote = await prisma.commlog.findUnique({
      where: { CommlogNum: BigInt(clinicalNoteId) },
    });
    if (!clinicalNote) {
      throw new NotFoundError('Clinical note not found');
    }

    const meta = parseJson<ClinicalNoteMeta>(clinicalNote.Note);
    if (meta.isSigned) {
      throw new BadRequestError('Cannot edit a signed clinical note');
    }

    const nextMeta: ClinicalNoteMeta = {
      ...meta,
      chiefComplaint: updates.chiefComplaint ?? meta.chiefComplaint,
      subjective: updates.subjective ?? meta.subjective,
      objective: updates.objective ?? meta.objective,
      assessment: updates.assessment ?? meta.assessment,
      plan: updates.plan ?? meta.plan,
      diagnosisCodes: updates.diagnosisCodes ?? meta.diagnosisCodes,
      structuredData: updates.structuredData ?? meta.structuredData,
      historyOfPresentIllness: updates.historyOfPresentIllness ?? meta.historyOfPresentIllness,
      physicalExam: updates.physicalExam ?? meta.physicalExam,
      attachments: updates.attachments ?? meta.attachments,
      requiresFollowUp: updates.requiresFollowUp ?? meta.requiresFollowUp,
      followUpDate: updates.followUpDate ? updates.followUpDate.toISOString() : meta.followUpDate,
      lastEditedBy: userId,
    };

    const updated = await prisma.commlog.update({
      where: { CommlogNum: BigInt(clinicalNoteId) },
      data: { Note: buildJson(nextMeta) },
    });

    await logActivity(
      userId,
      'updated',
      'clinical_notes',
      clinicalNoteId,
      this.mapCommlogToClinicalNote(clinicalNote, meta),
      this.mapCommlogToClinicalNote(updated, nextMeta),
      undefined,
      undefined,
      'medium'
    );

    return this.mapCommlogToClinicalNote(updated, nextMeta);
  }

  async saveDraft(
    clinicalNoteId: string,
    draftData: {
      chiefComplaint?: string;
      subjective?: string;
      objective?: string;
      assessment?: string;
      plan?: string;
      diagnosisCodes?: string[];
      structuredData?: any;
      historyOfPresentIllness?: string;
      physicalExam?: string;
    },
    userId: string
  ) {
    return this.updateClinicalNote(clinicalNoteId, draftData, userId);
  }

  async signClinicalNote(clinicalNoteId: string, userId: string) {
    const clinicalNote = await prisma.commlog.findUnique({
      where: { CommlogNum: BigInt(clinicalNoteId) },
    });
    if (!clinicalNote) {
      throw new NotFoundError('Clinical note not found');
    }

    const meta = parseJson<ClinicalNoteMeta>(clinicalNote.Note);
    if (meta.isSigned) {
      throw new BadRequestError('Clinical note is already signed');
    }

    if (!meta.subjective && !meta.objective && !meta.assessment && !meta.plan) {
      throw new ValidationError('Cannot sign an empty clinical note. At least one SOAP section must be completed.');
    }

    const nextMeta: ClinicalNoteMeta = {
      ...meta,
      isSigned: true,
      signedAt: new Date().toISOString(),
      signedBy: userId,
    };

    const updated = await prisma.commlog.update({
      where: { CommlogNum: BigInt(clinicalNoteId) },
      data: { Note: buildJson(nextMeta) },
    });

    await logActivity(
      userId,
      'updated',
      'clinical_notes',
      clinicalNoteId,
      this.mapCommlogToClinicalNote(clinicalNote, meta),
      this.mapCommlogToClinicalNote(updated, nextMeta),
      undefined,
      undefined,
      'high'
    );

    return this.mapCommlogToClinicalNote(updated, nextMeta);
  }

  async addAttachment(clinicalNoteId: string, attachmentUrl: string, userId: string) {
    const clinicalNote = await prisma.commlog.findUnique({
      where: { CommlogNum: BigInt(clinicalNoteId) },
    });
    if (!clinicalNote) {
      throw new NotFoundError('Clinical note not found');
    }

    const meta = parseJson<ClinicalNoteMeta>(clinicalNote.Note);
    if (meta.isSigned) {
      throw new BadRequestError('Cannot add attachments to a signed clinical note');
    }

    const attachments = meta.attachments ?? [];
    attachments.push(attachmentUrl);

    const nextMeta: ClinicalNoteMeta = {
      ...meta,
      attachments,
      lastEditedBy: userId,
    };

    const updated = await prisma.commlog.update({
      where: { CommlogNum: BigInt(clinicalNoteId) },
      data: { Note: buildJson(nextMeta) },
    });

    await logActivity(
      userId,
      'updated',
      'clinical_notes',
      clinicalNoteId,
      this.mapCommlogToClinicalNote(clinicalNote, meta),
      this.mapCommlogToClinicalNote(updated, nextMeta),
      undefined,
      'Attachment added to clinical note',
      'low'
    );

    return this.mapCommlogToClinicalNote(updated, nextMeta);
  }

  async removeAttachment(clinicalNoteId: string, attachmentUrl: string, userId: string) {
    const clinicalNote = await prisma.commlog.findUnique({
      where: { CommlogNum: BigInt(clinicalNoteId) },
    });
    if (!clinicalNote) {
      throw new NotFoundError('Clinical note not found');
    }

    const meta = parseJson<ClinicalNoteMeta>(clinicalNote.Note);
    if (meta.isSigned) {
      throw new BadRequestError('Cannot remove attachments from a signed clinical note');
    }

    const attachments = (meta.attachments ?? []).filter((a: string) => a !== attachmentUrl);

    const nextMeta: ClinicalNoteMeta = {
      ...meta,
      attachments,
      lastEditedBy: userId,
    };

    const updated = await prisma.commlog.update({
      where: { CommlogNum: BigInt(clinicalNoteId) },
      data: { Note: buildJson(nextMeta) },
    });

    await logActivity(
      userId,
      'updated',
      'clinical_notes',
      clinicalNoteId,
      this.mapCommlogToClinicalNote(clinicalNote, meta),
      this.mapCommlogToClinicalNote(updated, nextMeta),
      undefined,
      'Attachment removed from clinical note',
      'low'
    );

    return this.mapCommlogToClinicalNote(updated, nextMeta);
  }

  async deleteClinicalNote(clinicalNoteId: string, userId: string) {
    const clinicalNote = await prisma.commlog.findUnique({
      where: { CommlogNum: BigInt(clinicalNoteId) },
    });
    if (!clinicalNote) {
      throw new NotFoundError('Clinical note not found');
    }

    const meta = parseJson<ClinicalNoteMeta>(clinicalNote.Note);
    if (meta.isSigned) {
      throw new BadRequestError('Cannot delete a signed clinical note');
    }

    await prisma.commlog.delete({ where: { CommlogNum: BigInt(clinicalNoteId) } });

    await logActivity(
      userId,
      'deleted',
      'clinical_notes',
      clinicalNoteId,
      this.mapCommlogToClinicalNote(clinicalNote, meta),
      undefined,
      undefined,
      undefined,
      'medium'
    );

    return { message: 'Clinical note deleted successfully' };
  }

  async getUnsignedNotesByProvider(providerId: string) {
    const rows = await prisma.commlog.findMany({});
    const notes = rows
      .map((row) => {
        const meta = parseJson<ClinicalNoteMeta>(row.Note);
        return this.mapCommlogToClinicalNote(row, meta);
      })
      .filter((note: any) => note.providerId === providerId && !note.isSigned);

    return notes;
  }

  async createNoteFromTemplate(
    templateId: string,
    data: {
      patientId: string;
      appointmentId: string;
      providerId: string;
      noteType?: string;
      chiefComplaint?: string;
      subjective?: string;
      objective?: string;
      assessment?: string;
      plan?: string;
      historyOfPresentIllness?: string;
      physicalExam?: string;
      diagnosisCodes?: string[];
      requiresFollowUp?: boolean;
      followUpDate?: Date;
    },
    userId: string
  ) {
    return this.createClinicalNote(
      {
        ...data,
        templateId,
        noteType: data.noteType ?? 'soap',
        subjective: data.subjective ?? '',
        objective: data.objective ?? '',
        assessment: data.assessment ?? '',
        plan: data.plan ?? '',
      },
      userId
    );
  }

  async getPatientMedicalHistory(
    patientId: string,
    options: {
      includeAllergies?: boolean;
      includeVitals?: boolean;
      includePrescriptions?: boolean;
      includeLabOrders?: boolean;
      includeLabResults?: boolean;
      includeDocuments?: boolean;
      includeNotes?: boolean;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    } = {}
  ) {
    const {
      includeAllergies = true,
      includeVitals = true,
      includePrescriptions = true,
      includeLabOrders = true,
      includeLabResults = true,
      includeDocuments = true,
      includeNotes = true,
      startDate,
      endDate,
      limit = 50,
    } = options;

    const dateFilter: any = {};
    if (startDate || endDate) {
      if (startDate) dateFilter.gte = startDate;
      if (endDate) dateFilter.lte = endDate;
    }

    const historyData: any = { patientId };

    if (includeAllergies) {
      const allergies = await prisma.allergy.findMany({
        where: { PatNum: BigInt(patientId) },
        take: limit,
        orderBy: { AllergyNum: 'desc' },
        include: { allergydef: true },
      });
      historyData.allergies = allergies.map((allergy) => ({
        _id: allergy.AllergyNum.toString(),
        patientId,
        allergen: allergy.allergydef?.Description ?? 'Allergy',
        reaction: null,
        severity: 'mild',
        isActive: true,
        documentedBy: null,
        documentedDate: null,
      }));
    }

    if (includeVitals) {
      const vitals = await prisma.vitalsign.findMany({
        where: {
          PatNum: BigInt(patientId),
          ...(Object.keys(dateFilter).length ? { DateTaken: dateFilter } : {}),
        },
        orderBy: { DateTaken: 'desc' },
        take: limit,
      });
      historyData.vitals = vitals.map((vital) => ({
        _id: vital.VitalsignNum.toString(),
        patientId,
        recordedDate: vital.DateTaken ?? null,
        weight: vital.Weight ?? null,
        height: vital.Height ?? null,
        bloodPressureSystolic: vital.BpSystolic ?? null,
        bloodPressureDiastolic: vital.BpDiastolic ?? null,
        heartRate: vital.Pulse ?? null,
      }));
    }

    if (includePrescriptions) {
      const prescriptions = await prisma.rxpat.findMany({
        where: {
          PatNum: BigInt(patientId),
          ...(Object.keys(dateFilter).length ? { RxDate: dateFilter } : {}),
        },
        orderBy: { RxDate: 'desc' },
        take: limit,
      });
      historyData.prescriptions = prescriptions.map((rx) => ({
        _id: rx.RxNum.toString(),
        patientId,
        providerId: rx.ProvNum?.toString() ?? null,
        appointmentId: null,
        medicationId: rx.RxCui ? String(rx.RxCui) : null,
        dosage: rx.Disp ?? null,
        quantity: null,
        refillsAllowed: rx.Refills ? Number.parseInt(rx.Refills, 10) || 0 : 0,
        refillsRemaining: null,
        prescribedDate: rx.RxDate ?? null,
        expirationDate: null,
        status: 'active',
        instructions: rx.PatientInstruction ?? rx.Sig ?? null,
        pharmacyName: rx.ErxPharmacyInfo ?? null,
        pharmacyPhone: null,
        isElectronic: rx.IsErxOld ? false : true,
        createdBy: rx.UserNum?.toString() ?? null,
      }));
    }

    if (includeLabOrders) {
      const labPanels = await prisma.labpanel.findMany({
        where: {
          PatNum: BigInt(patientId),
          ...(Object.keys(dateFilter).length ? { DateTStamp: dateFilter } : {}),
        },
        orderBy: { DateTStamp: 'desc' },
        take: limit,
      });
      historyData.labOrders = labPanels.map((panel) => ({
        _id: panel.LabPanelNum.toString(),
        patientId,
        providerId: null,
        appointmentId: null,
        orderNumber: panel.LabPanelNum.toString(),
        orderType: panel.ServiceName ?? 'Lab Panel',
        testsRequested: panel.ServiceId ? [panel.ServiceId] : [],
        priority: 'routine',
        status: 'ordered',
        orderedDate: panel.DateTStamp ?? null,
        dueDate: null,
        collectionDate: null,
        labFacility: panel.LabNameAddress ?? null,
        instructions: panel.RawMessage ?? null,
        fastingRequired: false,
        createdBy: null,
      }));
    }

    if (includeLabResults) {
      const labResults = await prisma.labresult.findMany({
        where: {
          ...(Object.keys(dateFilter).length ? { DateTimeTest: dateFilter } : {}),
          labpanel: {
            PatNum: BigInt(patientId),
          },
        },
        orderBy: { DateTimeTest: 'desc' },
        take: limit,
      });
      historyData.labResults = labResults.map((result) => ({
        _id: result.LabResultNum.toString(),
        labOrderId: result.LabPanelNum?.toString() ?? null,
        patientId,
        testName: result.TestName ?? 'Lab Result',
        resultValue: result.ObsValue ?? '',
        normalRange: result.ObsRange ?? null,
        units: result.ObsUnits ?? null,
        status: result.AbnormalFlag ? 'abnormal' : 'normal',
        resultDate: result.DateTimeTest ?? null,
        providerNotes: null,
        patientNotified: false,
        notificationDate: null,
        reviewedBy: null,
        reviewedDate: null,
      }));
    }

    if (includeDocuments) {
      const documents = await prisma.document.findMany({
        where: {
          PatNum: BigInt(patientId),
          ...(Object.keys(dateFilter).length ? { DateCreated: dateFilter } : {}),
        },
        orderBy: { DateCreated: 'desc' },
        take: limit,
      });
      historyData.documents = documents.map((doc) => ({
        _id: doc.DocNum.toString(),
        patientId,
        appointmentId: null,
        documentName: doc.Description ?? doc.FileName ?? 'Document',
        documentType: 'other',
        storagePath: doc.FileName ?? null,
        fileSizeInBytes: null,
        mimeType: null,
        description: doc.Note ?? null,
        isConfidential: false,
        expirationDate: null,
        ocrText: doc.OcrResponseData ?? null,
        uploadedBy: doc.UserNum?.toString() ?? null,
        checksum: doc.ChartLetterHash ?? null,
        tags: [],
        createdAt: doc.DateCreated ?? null,
      }));
    }

    if (includeNotes) {
      const notes = await prisma.commlog.findMany({
        where: {
          PatNum: BigInt(patientId),
          ...(Object.keys(dateFilter).length ? { CommDateTime: dateFilter } : {}),
        },
        orderBy: { CommDateTime: 'desc' },
        take: limit,
      });
      historyData.clinicalNotes = notes.map((note) => {
        const meta = parseJson<ClinicalNoteMeta>(note.Note);
        return this.mapCommlogToClinicalNote(note, meta);
      });
    }

    const timeline: any[] = [];

    if (historyData.allergies) {
      historyData.allergies.forEach((allergy: any) => {
        timeline.push({ type: 'allergy', date: allergy.documentedDate, data: allergy });
      });
    }
    if (historyData.vitals) {
      historyData.vitals.forEach((vital: any) => {
        timeline.push({ type: 'vital', date: vital.recordedDate, data: vital });
      });
    }
    if (historyData.prescriptions) {
      historyData.prescriptions.forEach((prescription: any) => {
        timeline.push({ type: 'prescription', date: prescription.prescribedDate, data: prescription });
      });
    }
    if (historyData.labOrders) {
      historyData.labOrders.forEach((labOrder: any) => {
        timeline.push({ type: 'labOrder', date: labOrder.orderedDate, data: labOrder });
      });
    }
    if (historyData.labResults) {
      historyData.labResults.forEach((labResult: any) => {
        timeline.push({ type: 'labResult', date: labResult.resultDate, data: labResult });
      });
    }
    if (historyData.documents) {
      historyData.documents.forEach((document: any) => {
        timeline.push({ type: 'document', date: document.createdAt, data: document });
      });
    }
    if (historyData.clinicalNotes) {
      historyData.clinicalNotes.forEach((note: any) => {
        timeline.push({ type: 'clinicalNote', date: note.createdAt, data: note });
      });
    }

    timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      ...historyData,
      timeline,
      summary: {
        totalAllergies: historyData.allergies?.length || 0,
        totalVitals: historyData.vitals?.length || 0,
        totalPrescriptions: historyData.prescriptions?.length || 0,
        totalLabOrders: historyData.labOrders?.length || 0,
        totalLabResults: historyData.labResults?.length || 0,
        totalDocuments: historyData.documents?.length || 0,
        totalClinicalNotes: historyData.clinicalNotes?.length || 0,
      },
    };
  }
}

export const clinicalNoteService = new ClinicalNoteService();
