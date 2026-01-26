import { DocumentModel, Document } from '../models/document.model';
import { PatientModel } from '../models/patient.model';
import { ClinicalNoteModel } from '../models/clinical-note.model';
import { NotFoundError, BadRequestError } from '../utils/error.util';
import { logActivity } from '../utils/activity-logger.util';
import crypto from 'crypto';

export class DocumentService {
  async getAllDocuments(
    page = 1,
    limit = 10,
    filters: {
      patientId?: string;
      appointmentId?: string;
      documentType?: string;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ) {
    const skip = (page - 1) * limit;
    const query: any = {};

    if (filters.patientId) query.patientId = filters.patientId;
    if (filters.appointmentId) query.appointmentId = filters.appointmentId;
    if (filters.documentType) query.documentType = filters.documentType;

    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = filters.startDate;
      if (filters.endDate) query.createdAt.$lte = filters.endDate;
    }

    const [documents, total] = await Promise.all([
      DocumentModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('patientId', 'firstName lastName')
        .populate('appointmentId', 'appointmentDate')
        .populate('uploadedBy', 'firstName lastName')
        .lean(),
      DocumentModel.countDocuments(query),
    ]);

    return {
      documents,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getDocumentById(documentId: string) {
    const document = await DocumentModel.findById(documentId)
      .populate('patientId', 'firstName lastName dateOfBirth')
      .populate('appointmentId', 'appointmentDate startTime')
      .populate('uploadedBy', 'firstName lastName')
      .lean();

    if (!document) {
      throw new NotFoundError('Document not found');
    }

    return document;
  }

  async getDocumentsByPatient(patientId: string, page = 1, limit = 10, documentType?: string) {
    const skip = (page - 1) * limit;

    const patient = await PatientModel.findById(patientId).lean();
    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    const query: any = { patientId };
    if (documentType) query.documentType = documentType;

    const [documents, total] = await Promise.all([
      DocumentModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('appointmentId', 'appointmentDate startTime')
        .populate('uploadedBy', 'firstName lastName')
        .lean(),
      DocumentModel.countDocuments(query),
    ]);

    return {
      documents,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getDocumentsByAppointment(appointmentId: string) {
    const documents = await DocumentModel.find({ appointmentId })
      .sort({ createdAt: -1 })
      .populate('uploadedBy', 'firstName lastName')
      .lean();

    return documents;
  }

  async createDocument(
    data: {
      patientId: string;
      appointmentId?: string;
      documentName: string;
      documentType: string;
      storagePath: string;
      fileSizeInBytes?: number;
      mimeType?: string;
      description?: string;
      isConfidential?: boolean;
      expirationDate?: Date;
      ocrText?: string;
      tags?: string[];
    },
    userId: string
  ) {
    const patient = await PatientModel.findById(data.patientId).lean();
    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    const checksumInput = data.storagePath 
      ? data.storagePath + Date.now().toString()
      : data.documentName + Date.now().toString();
    
    const checksum = crypto
      .createHash('md5')
      .update(checksumInput)
      .digest('hex');

    const document = await DocumentModel.create({
      ...data,
      uploadedBy: userId,
      checksum,
    });

    await logActivity(
      userId,
      'created',
      'documents',
      String(document._id),
      undefined,
      { documentName: data.documentName, documentType: data.documentType },
      undefined,
      undefined,
      'medium'
    );

    return document;
  }

  async updateDocument(
    documentId: string,
    updates: {
      documentName?: string;
      description?: string;
      isConfidential?: boolean;
      expirationDate?: Date;
      tags?: string[];
    },
    userId: string
  ) {
    const document = await DocumentModel.findById(documentId);
    if (!document) {
      throw new NotFoundError('Document not found');
    }

    const oldData = document.toObject();

    Object.assign(document, updates);

    await document.save();

    await logActivity(
      userId,
      'updated',
      'documents',
      documentId,
      oldData,
      document.toObject(),
      undefined,
      undefined,
      'low'
    );

    return document;
  }

  async deleteDocument(documentId: string, userId: string) {
    const document = await DocumentModel.findById(documentId);
    if (!document) {
      throw new NotFoundError('Document not found');
    }

    const oldData = document.toObject();

    await DocumentModel.deleteOne({ _id: documentId });

    await logActivity(
      userId,
      'deleted',
      'documents',
      documentId,
      oldData,
      undefined,
      undefined,
      undefined,
      'medium'
    );

    return { message: 'Document deleted successfully' };
  }

  async attachDocumentToNote(documentId: string, clinicalNoteId: string, userId: string) {
    const document = await DocumentModel.findById(documentId);
    if (!document) {
      throw new NotFoundError('Document not found');
    }

    const clinicalNote = await ClinicalNoteModel.findById(clinicalNoteId);
    if (!clinicalNote) {
      throw new NotFoundError('Clinical note not found');
    }

    if (clinicalNote.isSigned) {
      throw new BadRequestError('Cannot attach documents to a signed clinical note');
    }

    const noteObj = clinicalNote.toObject() as any;
    const attachments = noteObj.attachments || [];
    
    const docObj = document.toObject() as any;
    if (!attachments.includes(docObj.storagePath)) {
      attachments.push(docObj.storagePath);
      (clinicalNote as any).attachments = attachments;
      (clinicalNote as any).lastEditedBy = userId;
      await clinicalNote.save();
    }

    await logActivity(
      userId,
      'updated',
      'clinical_notes',
      clinicalNoteId,
      undefined,
      undefined,
      undefined,
      `Document ${docObj.documentName} attached to note`,
      'low'
    );

    return clinicalNote;
  }

  async getDocumentTypes() {
    return [
      { value: 'insurance_card', label: 'Insurance Card' },
      { value: 'id', label: 'ID Document' },
      { value: 'lab_result', label: 'Lab Result' },
      { value: 'imaging', label: 'Imaging/X-Ray' },
      { value: 'consent_form', label: 'Consent Form' },
      { value: 'treatment_plan', label: 'Treatment Plan' },
      { value: 'referral', label: 'Referral' },
      { value: 'prescription', label: 'Prescription' },
      { value: 'other', label: 'Other' },
    ];
  }
}

export const documentService = new DocumentService();
