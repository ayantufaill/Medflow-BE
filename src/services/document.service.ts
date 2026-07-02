import { prisma } from '../config/db';
import { NotFoundError } from '../utils/error.util';
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
const toIsoString = (value?: string | Date | null): string | undefined => {
  if (!value) return undefined;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
};

type DocumentMeta = {
  appointmentId?: string;
  clinicalNoteId?: string;
  documentType?: string;
  storagePath?: string;
  fileSizeInBytes?: number;
  mimeType?: string;
  description?: string;
  isConfidential?: boolean;
  expirationDate?: string;
  ocrText?: string;
  uploadedBy?: string;
  checksum?: string;
  tags?: string[];
};

export class DocumentService {
  private mapDocumentRow(doc: any) {
    const meta = parseJson<DocumentMeta>(doc.Note);
    const storagePath = meta.storagePath ?? doc.FileName ?? null;
    return {
      _id: doc.DocNum.toString(),
      patientId: doc.PatNum?.toString() ?? null,
      appointmentId: meta.appointmentId ?? null,
      documentName: doc.Description ?? doc.FileName ?? 'Document',
      documentType: meta.documentType ?? 'other',
      storagePath,
      fileUrl: storagePath,
      documentUrl: storagePath,
      fileSizeInBytes: meta.fileSizeInBytes ?? null,
      mimeType: meta.mimeType ?? null,
      description: meta.description ?? null,
      isConfidential: meta.isConfidential ?? false,
      expirationDate: meta.expirationDate ? new Date(meta.expirationDate) : null,
      ocrText: meta.ocrText ?? doc.OcrResponseData ?? null,
      uploadedBy: meta.uploadedBy ?? doc.UserNum?.toString() ?? null,
      checksum: meta.checksum ?? doc.ChartLetterHash ?? null,
      tags: meta.tags ?? [],
      createdAt: doc.DateCreated ?? null,
    };
  }

  async getAllDocuments(page = 1, limit = 10, filters: { patientId?: string; appointmentId?: string; documentType?: string } = {}) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filters.patientId) where.PatNum = BigInt(filters.patientId);

    const [rows, total] = await Promise.all([
      prisma.document.findMany({
        where,
        orderBy: { DateCreated: 'desc' },
        skip,
        take: limit,
      }),
      prisma.document.count({ where }),
    ]);

    let documents = rows.map((doc) => this.mapDocumentRow(doc));

    if (filters.appointmentId) {
      documents = documents.filter((doc) => doc.appointmentId === filters.appointmentId);
    }
    if (filters.documentType) {
      documents = documents.filter((doc) => doc.documentType === filters.documentType);
    }

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
    const doc = await prisma.document.findUnique({
      where: { DocNum: BigInt(documentId) },
    });
    if (!doc) {
      throw new NotFoundError('Document not found');
    }

    return this.mapDocumentRow(doc);
  }

  async getDocumentsByPatient(patientId: string, page = 1, limit = 10, documentType?: string) {
    return this.getAllDocuments(page, limit, { patientId, documentType });
  }

  async getDocumentsByAppointment(appointmentId: string) {
    const docs = await prisma.document.findMany();
    return docs
      .map((doc) => {
        const meta = parseJson<DocumentMeta>(doc.Note);
        return { doc, meta };
      })
      .filter((item) => item.meta.appointmentId === appointmentId)
      .map((item) => this.mapDocumentRow(item.doc));
  }

  async createDocument(
    data: {
      patientId: string;
      appointmentId?: string;
      documentName: string;
      documentType: string;
      storagePath?: string;
      fileSizeInBytes?: number;
      mimeType?: string;
      description?: string;
      isConfidential?: boolean;
      expirationDate?: Date | string;
      ocrText?: string;
      checksum?: string;
      tags?: string[];
    },
    uploadedBy: string
  ) {
    const docNum = await getNextId('document', 'DocNum');
    const payload: DocumentMeta = {
      appointmentId: data.appointmentId,
      documentType: data.documentType,
      storagePath: data.storagePath,
      fileSizeInBytes: data.fileSizeInBytes,
      mimeType: data.mimeType,
      description: data.description,
      isConfidential: data.isConfidential,
      expirationDate: toIsoString(data.expirationDate),
      ocrText: data.ocrText,
      uploadedBy,
      checksum: data.checksum,
      tags: data.tags ?? [],
    };

    const doc = await prisma.document.create({
      data: {
        DocNum: docNum,
        PatNum: BigInt(data.patientId),
        Description: data.documentName,
        FileName: data.storagePath ?? null,
        Note: buildJson(payload),
        DateCreated: new Date(),
        UserNum: BigInt(uploadedBy),
        OcrResponseData: data.ocrText ?? null,
      },
    });

    await logActivity(uploadedBy, 'created', 'documents', doc.DocNum.toString(), undefined, doc);

    return this.mapDocumentRow(doc);
  }

  async updateDocument(
    documentId: string,
    updates: Partial<{
      documentName: string;
      documentType: string;
      storagePath: string;
      fileSizeInBytes: number;
      mimeType: string;
      description: string;
      isConfidential: boolean;
      expirationDate: Date | string;
      ocrText: string;
      checksum: string;
      tags: string[];
    }>,
    userId: string
  ) {
    const doc = await prisma.document.findUnique({
      where: { DocNum: BigInt(documentId) },
    });
    if (!doc) {
      throw new NotFoundError('Document not found');
    }

    const meta = parseJson<DocumentMeta>(doc.Note);
    const nextMeta: DocumentMeta = {
      ...meta,
      documentType: updates.documentType ?? meta.documentType,
      storagePath: updates.storagePath ?? meta.storagePath,
      fileSizeInBytes: updates.fileSizeInBytes ?? meta.fileSizeInBytes,
      mimeType: updates.mimeType ?? meta.mimeType,
      description: updates.description ?? meta.description,
      isConfidential: updates.isConfidential ?? meta.isConfidential,
      expirationDate: toIsoString(updates.expirationDate) ?? meta.expirationDate,
      ocrText: updates.ocrText ?? meta.ocrText,
      checksum: updates.checksum ?? meta.checksum,
      tags: updates.tags ?? meta.tags,
    };

    const updated = await prisma.document.update({
      where: { DocNum: doc.DocNum },
      data: {
        Description: updates.documentName ?? undefined,
        FileName: updates.storagePath ?? undefined,
        Note: buildJson(nextMeta),
        OcrResponseData: updates.ocrText ?? undefined,
      },
    });

    await logActivity(userId, 'updated', 'documents', documentId, doc, updated);

    return this.mapDocumentRow(updated);
  }

  async deleteDocument(documentId: string, userId: string) {
    const doc = await prisma.document.findUnique({
      where: { DocNum: BigInt(documentId) },
    });
    if (!doc) {
      throw new NotFoundError('Document not found');
    }

    await prisma.document.delete({ where: { DocNum: doc.DocNum } });
    await logActivity(userId, 'deleted', 'documents', documentId, doc, undefined);

    return { message: 'Document deleted successfully' };
  }

  async unlinkDocument(documentId: string, userId: string) {
    const doc = await prisma.document.findUnique({
      where: { DocNum: BigInt(documentId) },
    });
    if (!doc) {
      throw new NotFoundError('Document not found');
    }

    const updated = await prisma.document.update({
      where: { DocNum: doc.DocNum },
      data: { PatNum: null },
    });

    await logActivity(userId, 'updated', 'documents', documentId, doc, updated);

    return this.mapDocumentRow(updated);
  }

  async attachDocumentToNote(documentId: string, clinicalNoteId: string, userId: string) {
    const doc = await prisma.document.findUnique({
      where: { DocNum: BigInt(documentId) },
    });
    if (!doc) {
      throw new NotFoundError('Document not found');
    }

    const meta = parseJson<DocumentMeta>(doc.Note);
    const nextMeta: DocumentMeta = {
      ...meta,
      clinicalNoteId,
    };

    const updated = await prisma.document.update({
      where: { DocNum: doc.DocNum },
      data: { Note: buildJson(nextMeta) },
    });

    await logActivity(userId, 'updated', 'documents', documentId, doc, updated);

    return this.mapDocumentRow(updated);
  }

  async getDocumentTypes() {
    const docs = await prisma.document.findMany({ select: { Note: true } });
    const types = new Set<string>();
    for (const doc of docs) {
      const meta = parseJson<DocumentMeta>(doc.Note);
      if (meta.documentType) {
        types.add(meta.documentType);
      }
    }
    return Array.from(types);
  }
}

export const documentService = new DocumentService();
