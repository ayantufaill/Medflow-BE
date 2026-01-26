import { ClinicalNoteModel, ClinicalNote } from '../models/clinical-note.model';
import { NoteTemplateModel } from '../models/note-template.model';
import { AllergyModel } from '../models/allergy.model';
import { VitalSignModel } from '../models/vital-sign.model';
import { PrescriptionModel } from '../models/prescription.model';
import { LabOrderModel } from '../models/lab-order.model';
import { LabResultModel } from '../models/lab-result.model';
import { DocumentModel } from '../models/document.model';
import { NotFoundError, ConflictError, ValidationError, BadRequestError } from '../utils/error.util';
import { logActivity } from '../utils/activity-logger.util';
import mongoose from 'mongoose';

export class ClinicalNoteService {
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
    const query: any = {};

    if (filters.patientId) query.patientId = filters.patientId;
    if (filters.providerId) query.providerId = filters.providerId;
    if (filters.appointmentId) query.appointmentId = filters.appointmentId;
    if (filters.noteType) query.noteType = filters.noteType;
    if (filters.isSigned !== undefined) query.isSigned = filters.isSigned;

    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = filters.startDate;
      if (filters.endDate) query.createdAt.$lte = filters.endDate;
    }

    if (filters.search) {
      query.chiefComplaint = { $regex: filters.search, $options: 'i' };
    }

    let clinicalNotesQuery = ClinicalNoteModel.find(query)
      .sort({ createdAt: -1 })
      .populate('patientId', 'firstName lastName dateOfBirth')
      .populate('providerId', 'firstName lastName specialty')
      .populate('templateId', 'name')
      .populate('signedBy', 'firstName lastName');

    let clinicalNotes = await clinicalNotesQuery.lean();

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      clinicalNotes = clinicalNotes.filter((note: any) => {
        const patientName = `${note.patientId?.firstName || ''} ${note.patientId?.lastName || ''}`.toLowerCase();
        const providerName = `${note.providerId?.firstName || ''} ${note.providerId?.lastName || ''}`.toLowerCase();
        const chiefComplaint = (note.chiefComplaint || '').toLowerCase();
        const noteType = (note.noteType || '').toLowerCase();
        return patientName.includes(searchLower) || 
               providerName.includes(searchLower) || 
               chiefComplaint.includes(searchLower) ||
               noteType.includes(searchLower);
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
    const clinicalNote = await ClinicalNoteModel.findById(clinicalNoteId)
      .populate('patientId', 'firstName lastName dateOfBirth')
      .populate('providerId', 'firstName lastName specialty')
      .populate('templateId', 'name templateStructure')
      .populate('signedBy', 'firstName lastName')
      .populate('lastEditedBy', 'firstName lastName')
      .lean();

    if (!clinicalNote) {
      throw new NotFoundError('Clinical note not found');
    }

    return clinicalNote;
  }

  async getClinicalNotesByPatient(patientId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [clinicalNotes, total] = await Promise.all([
      ClinicalNoteModel.find({ patientId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('providerId', 'firstName lastName specialty')
        .populate('templateId', 'name')
        .lean(),
      ClinicalNoteModel.countDocuments({ patientId }),
    ]);

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

  async getClinicalNoteByAppointment(appointmentId: string) {
    const clinicalNote = await ClinicalNoteModel.findOne({ appointmentId })
      .populate('patientId', 'firstName lastName dateOfBirth')
      .populate('providerId', 'firstName lastName specialty')
      .populate('templateId', 'name templateStructure')
      .populate('signedBy', 'firstName lastName')
      .lean();

    return clinicalNote;
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
    if (data.appointmentId) {
      const existingNote = await ClinicalNoteModel.findOne({
        patientId: data.patientId,
        appointmentId: data.appointmentId,
      }).lean();

      if (existingNote) {
        throw new ConflictError('A clinical note already exists for this appointment');
      }
    }

    if (data.templateId) {
      const template = await NoteTemplateModel.findById(data.templateId).lean();
      if (!template) {
        throw new NotFoundError('Note template not found');
      }
      if (!template.isActive) {
        throw new BadRequestError('Selected template is not active');
      }
    }

    const clinicalNote = await ClinicalNoteModel.create({
      ...data,
      lastEditedBy: userId,
    });

    await logActivity(
      userId,
      'created',
      'clinical_notes',
      String(clinicalNote._id),
      undefined,
      clinicalNote.toObject(),
      undefined,
      undefined,
      'medium'
    );

    return clinicalNote;
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
    const clinicalNote = await ClinicalNoteModel.findById(clinicalNoteId);
    if (!clinicalNote) {
      throw new NotFoundError('Clinical note not found');
    }

    if (clinicalNote.isSigned) {
      throw new BadRequestError('Cannot edit a signed clinical note');
    }

    const oldData = clinicalNote.toObject();

    Object.assign(clinicalNote, {
      ...updates,
      lastEditedBy: userId,
    });

    await clinicalNote.save();

    await logActivity(
      userId,
      'updated',
      'clinical_notes',
      clinicalNoteId,
      oldData,
      clinicalNote.toObject(),
      undefined,
      undefined,
      'medium'
    );

    return clinicalNote;
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
    const clinicalNote = await ClinicalNoteModel.findById(clinicalNoteId);
    if (!clinicalNote) {
      throw new NotFoundError('Clinical note not found');
    }

    if (clinicalNote.isSigned) {
      throw new BadRequestError('Cannot save draft of a signed clinical note');
    }

    Object.assign(clinicalNote, {
      ...draftData,
      lastEditedBy: userId,
    });

    await clinicalNote.save();

    return clinicalNote;
  }

  async signClinicalNote(clinicalNoteId: string, userId: string) {
    const clinicalNote = await ClinicalNoteModel.findById(clinicalNoteId);
    if (!clinicalNote) {
      throw new NotFoundError('Clinical note not found');
    }

    if (clinicalNote.isSigned) {
      throw new BadRequestError('Clinical note is already signed');
    }

    const noteObj = clinicalNote.toObject() as any;
    if (!noteObj.subjective && !noteObj.objective && !noteObj.assessment && !noteObj.plan) {
      throw new ValidationError('Cannot sign an empty clinical note. At least one SOAP section must be completed.');
    }

    const oldData = clinicalNote.toObject();

    (clinicalNote as any).isSigned = true;
    (clinicalNote as any).signedAt = new Date();
    (clinicalNote as any).signedBy = userId;

    await clinicalNote.save();

    await logActivity(
      userId,
      'updated',
      'clinical_notes',
      clinicalNoteId,
      oldData,
      clinicalNote.toObject(),
      undefined,
      undefined,
      'high'
    );

    return clinicalNote;
  }

  async addAttachment(clinicalNoteId: string, attachmentUrl: string, userId: string) {
    const clinicalNote = await ClinicalNoteModel.findById(clinicalNoteId);
    if (!clinicalNote) {
      throw new NotFoundError('Clinical note not found');
    }

    const noteObj = clinicalNote.toObject() as any;
    if (noteObj.isSigned) {
      throw new BadRequestError('Cannot add attachments to a signed clinical note');
    }

    const oldData = clinicalNote.toObject();

    const attachments = noteObj.attachments || [];
    attachments.push(attachmentUrl);
    (clinicalNote as any).attachments = attachments;
    (clinicalNote as any).lastEditedBy = userId;

    await clinicalNote.save();

    await logActivity(
      userId,
      'updated',
      'clinical_notes',
      clinicalNoteId,
      oldData,
      clinicalNote.toObject(),
      undefined,
      'Attachment added to clinical note',
      'low'
    );

    return clinicalNote;
  }

  async removeAttachment(clinicalNoteId: string, attachmentUrl: string, userId: string) {
    const clinicalNote = await ClinicalNoteModel.findById(clinicalNoteId);
    if (!clinicalNote) {
      throw new NotFoundError('Clinical note not found');
    }

    const noteObj = clinicalNote.toObject() as any;
    if (noteObj.isSigned) {
      throw new BadRequestError('Cannot remove attachments from a signed clinical note');
    }

    const oldData = clinicalNote.toObject();

    const attachments = (noteObj.attachments || []).filter(
      (a: string) => a !== attachmentUrl
    );
    (clinicalNote as any).attachments = attachments;
    (clinicalNote as any).lastEditedBy = userId;

    await clinicalNote.save();

    await logActivity(
      userId,
      'updated',
      'clinical_notes',
      clinicalNoteId,
      oldData,
      clinicalNote.toObject(),
      undefined,
      'Attachment removed from clinical note',
      'low'
    );

    return clinicalNote;
  }

  async deleteClinicalNote(clinicalNoteId: string, userId: string) {
    const clinicalNote = await ClinicalNoteModel.findById(clinicalNoteId);
    if (!clinicalNote) {
      throw new NotFoundError('Clinical note not found');
    }

    if (clinicalNote.isSigned) {
      throw new BadRequestError('Cannot delete a signed clinical note');
    }

    const oldData = clinicalNote.toObject();

    await ClinicalNoteModel.deleteOne({ _id: clinicalNoteId });

    await logActivity(
      userId,
      'deleted',
      'clinical_notes',
      clinicalNoteId,
      oldData,
      undefined,
      undefined,
      undefined,
      'medium'
    );

    return { message: 'Clinical note deleted successfully' };
  }

  async getUnsignedNotesByProvider(providerId: string) {
    const unsignedNotes = await ClinicalNoteModel.find({
      providerId,
      isSigned: false,
    })
      .sort({ createdAt: -1 })
      .populate('patientId', 'firstName lastName')
      .populate('appointmentId', 'appointmentDate')
      .lean();

    return unsignedNotes;
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
    const template = await NoteTemplateModel.findById(templateId).lean();
    if (!template) {
      throw new NotFoundError('Note template not found');
    }

    if (!template.isActive) {
      throw new BadRequestError('Selected template is not active');
    }

    const existingNote = await ClinicalNoteModel.findOne({
      patientId: data.patientId,
      appointmentId: data.appointmentId,
    }).lean();

    if (existingNote) {
      throw new ConflictError('A clinical note already exists for this appointment');
    }

    const defaultContent = (template.defaultContent as any) || {};

    const clinicalNote = await ClinicalNoteModel.create({
      patientId: data.patientId,
      appointmentId: data.appointmentId,
      providerId: data.providerId,
      templateId: templateId,
      noteType: data.noteType || 'soap',
      chiefComplaint: data.chiefComplaint,
      subjective: data.subjective || defaultContent.subjective || '',
      objective: data.objective || defaultContent.objective || '',
      assessment: data.assessment || defaultContent.assessment || '',
      plan: data.plan || defaultContent.plan || '',
      historyOfPresentIllness: data.historyOfPresentIllness,
      physicalExam: data.physicalExam,
      diagnosisCodes: data.diagnosisCodes,
      requiresFollowUp: data.requiresFollowUp,
      followUpDate: data.followUpDate,
      structuredData: template.templateStructure,
      lastEditedBy: userId,
    });

    await logActivity(
      userId,
      'created',
      'clinical_notes',
      String(clinicalNote._id),
      undefined,
      clinicalNote.toObject(),
      undefined,
      `Created from template: ${template.name}`,
      'medium'
    );

    return clinicalNote;
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
      if (startDate) dateFilter.$gte = startDate;
      if (endDate) dateFilter.$lte = endDate;
    }

    const historyData: any = {
      patientId,
    };

    const promises: Promise<any>[] = [];

    if (includeAllergies) {
      promises.push(
        AllergyModel.find({ patientId, isActive: true })
          .sort({ documentedDate: -1 })
          .limit(limit)
          .populate('documentedBy', 'firstName lastName')
          .lean()
          .then((allergies) => {
            historyData.allergies = allergies;
          })
      );
    }

    if (includeVitals) {
      const vitalQuery: any = { patientId };
      if (startDate || endDate) {
        vitalQuery.recordedDate = dateFilter;
      }
      promises.push(
        VitalSignModel.find(vitalQuery)
          .sort({ recordedDate: -1 })
          .limit(limit)
          .populate('appointmentId', 'appointmentDate')
          .populate('recordedBy', 'firstName lastName')
          .lean()
          .then((vitals) => {
            historyData.vitals = vitals;
          })
      );
    }

    if (includePrescriptions) {
      const prescriptionQuery: any = { patientId };
      if (startDate || endDate) {
        prescriptionQuery.prescribedDate = dateFilter;
      }
      promises.push(
        PrescriptionModel.find(prescriptionQuery)
          .sort({ prescribedDate: -1 })
          .limit(limit)
          .populate('providerId', 'firstName lastName specialty')
          .populate('medicationId', 'name genericName')
          .populate('appointmentId', 'appointmentDate')
          .lean()
          .then((prescriptions) => {
            historyData.prescriptions = prescriptions;
          })
      );
    }

    if (includeLabOrders) {
      const labOrderQuery: any = { patientId };
      if (startDate || endDate) {
        labOrderQuery.orderedDate = dateFilter;
      }
      promises.push(
        LabOrderModel.find(labOrderQuery)
          .sort({ orderedDate: -1 })
          .limit(limit)
          .populate('providerId', 'firstName lastName specialty')
          .populate('appointmentId', 'appointmentDate')
          .lean()
          .then((labOrders) => {
            historyData.labOrders = labOrders;
          })
      );
    }

    if (includeLabResults) {
      const labResultQuery: any = { patientId };
      if (startDate || endDate) {
        labResultQuery.resultDate = dateFilter;
      }
      promises.push(
        LabResultModel.find(labResultQuery)
          .sort({ resultDate: -1 })
          .limit(limit)
          .populate('labOrderId', 'orderNumber orderType')
          .populate('reviewedBy', 'firstName lastName')
          .lean()
          .then((labResults) => {
            historyData.labResults = labResults;
          })
      );
    }

    if (includeDocuments) {
      const documentQuery: any = { patientId };
      if (startDate || endDate) {
        documentQuery.createdAt = dateFilter;
      }
      promises.push(
        DocumentModel.find(documentQuery)
          .sort({ createdAt: -1 })
          .limit(limit)
          .populate('uploadedBy', 'firstName lastName')
          .populate('appointmentId', 'appointmentDate')
          .lean()
          .then((documents) => {
            historyData.documents = documents;
          })
      );
    }

    if (includeNotes) {
      const notesQuery: any = { patientId };
      if (startDate || endDate) {
        notesQuery.createdAt = dateFilter;
      }
      promises.push(
        ClinicalNoteModel.find(notesQuery)
          .sort({ createdAt: -1 })
          .limit(limit)
          .populate('providerId', 'firstName lastName specialty')
          .populate('appointmentId', 'appointmentDate')
          .populate('templateId', 'name')
          .populate('signedBy', 'firstName lastName')
          .lean()
          .then((notes) => {
            historyData.clinicalNotes = notes;
          })
      );
    }

    await Promise.all(promises);

    const timeline: any[] = [];

    if (historyData.allergies) {
      historyData.allergies.forEach((allergy: any) => {
        timeline.push({
          type: 'allergy',
          date: allergy.documentedDate,
          data: allergy,
        });
      });
    }

    if (historyData.vitals) {
      historyData.vitals.forEach((vital: any) => {
        timeline.push({
          type: 'vital',
          date: vital.recordedDate,
          data: vital,
        });
      });
    }

    if (historyData.prescriptions) {
      historyData.prescriptions.forEach((prescription: any) => {
        timeline.push({
          type: 'prescription',
          date: prescription.prescribedDate,
          data: prescription,
        });
      });
    }

    if (historyData.labOrders) {
      historyData.labOrders.forEach((labOrder: any) => {
        timeline.push({
          type: 'labOrder',
          date: labOrder.orderedDate,
          data: labOrder,
        });
      });
    }

    if (historyData.labResults) {
      historyData.labResults.forEach((labResult: any) => {
        timeline.push({
          type: 'labResult',
          date: labResult.resultDate,
          data: labResult,
        });
      });
    }

    if (historyData.documents) {
      historyData.documents.forEach((document: any) => {
        timeline.push({
          type: 'document',
          date: document.createdAt,
          data: document,
        });
      });
    }

    if (historyData.clinicalNotes) {
      historyData.clinicalNotes.forEach((note: any) => {
        timeline.push({
          type: 'clinicalNote',
          date: note.createdAt,
          data: note,
        });
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
