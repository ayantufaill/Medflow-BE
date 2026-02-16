import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { documentService } from '../services/document.service';
import { logActivityFromRequest } from '../utils/activity-logger.util';
import { uploadToS3 } from '../utils/s3.util';

export class DocumentController {
  async getAllDocuments(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const filters: {
        patientId?: string;
        appointmentId?: string;
        documentType?: string;
        startDate?: Date;
        endDate?: Date;
      } = {};

      if (req.query.patientId) filters.patientId = req.query.patientId as string;
      if (req.query.appointmentId) filters.appointmentId = req.query.appointmentId as string;
      if (req.query.documentType) filters.documentType = req.query.documentType as string;
      if (req.query.startDate) filters.startDate = new Date(req.query.startDate as string);
      if (req.query.endDate) filters.endDate = new Date(req.query.endDate as string);

      const result = await documentService.getAllDocuments(page, limit, filters);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getDocumentById(req: Request, res: Response, next: NextFunction) {
    try {
      const documentId = req.params.documentId as string;

      const document = await documentService.getDocumentById(documentId);

      if (req.userId) {
        await logActivityFromRequest(req, 'viewed', 'documents', documentId);
      }

      res.status(200).json({
        success: true,
        data: { document },
      });
    } catch (error) {
      next(error);
    }
  }

  async getDocumentsByPatient(req: Request, res: Response, next: NextFunction) {
    try {
      const patientId = req.params.patientId as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const documentType = req.query.documentType as string | undefined;

      const result = await documentService.getDocumentsByPatient(patientId, page, limit, documentType);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getDocumentsByAppointment(req: Request, res: Response, next: NextFunction) {
    try {
      const appointmentId = req.params.appointmentId as string;

      const documents = await documentService.getDocumentsByAppointment(appointmentId);

      res.status(200).json({
        success: true,
        data: { documents },
      });
    } catch (error) {
      next(error);
    }
  }

  async createDocument(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const document = await documentService.createDocument(req.body, req.userId);

      res.status(201).json({
        success: true,
        data: { document },
        message: 'Document uploaded successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async uploadDocument(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const uploadedFile =
        req.file ?? (Array.isArray(req.files) ? (req.files[0] as Express.Multer.File | undefined) : undefined);

      if (!uploadedFile) {
        return res.status(400).json({
          success: false,
          error: { message: 'No file uploaded' },
        });
      }

      const patientId = req.body.patientId as string | undefined;
      const documentType = req.body.documentType as string | undefined;
      const appointmentId = req.body.appointmentId as string | undefined;
      const documentName = (req.body.documentName as string | undefined) ?? uploadedFile.originalname;
      const description = req.body.description as string | undefined;
      const isConfidential = req.body.isConfidential === 'true' || req.body.isConfidential === true;
      const tagsRaw = req.body.tags as string | string[] | undefined;

      if (!patientId || !documentType) {
        return res.status(400).json({
          success: false,
          error: { message: 'patientId and documentType are required' },
        });
      }

      const storagePath = await uploadToS3(uploadedFile, 'documents');
      const checksum = crypto.createHash('sha256').update(uploadedFile.buffer).digest('hex');
      const tags = Array.isArray(tagsRaw)
        ? tagsRaw
        : typeof tagsRaw === 'string' && tagsRaw.length > 0
          ? tagsRaw.split(',').map((value) => value.trim()).filter(Boolean)
          : [];

      const document = await documentService.createDocument(
        {
          patientId,
          appointmentId,
          documentName,
          documentType,
          storagePath,
          fileSizeInBytes: uploadedFile.size,
          mimeType: uploadedFile.mimetype,
          description,
          isConfidential,
          checksum,
          tags,
        },
        req.userId
      );

      res.status(201).json({
        success: true,
        data: { document },
        message: 'Document uploaded successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async updateDocument(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const documentId = req.params.documentId as string;

      const document = await documentService.updateDocument(documentId, req.body, req.userId);

      res.status(200).json({
        success: true,
        data: { document },
        message: 'Document updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteDocument(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const documentId = req.params.documentId as string;

      await documentService.deleteDocument(documentId, req.userId);

      res.status(200).json({
        success: true,
        message: 'Document deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async attachToNote(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const documentId = req.params.documentId as string;
      const { clinicalNoteId } = req.body;

      const clinicalNote = await documentService.attachDocumentToNote(
        documentId,
        clinicalNoteId,
        req.userId
      );

      res.status(200).json({
        success: true,
        data: { clinicalNote },
        message: 'Document attached to clinical note successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async getDocumentTypes(req: Request, res: Response, next: NextFunction) {
    try {
      const types = await documentService.getDocumentTypes();

      res.status(200).json({
        success: true,
        data: { types },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const documentController = new DocumentController();
