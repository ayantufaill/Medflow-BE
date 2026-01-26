import type { Request, Response, NextFunction } from 'express';
import { clinicalNoteService } from '../services/clinical-note.service';
import { logActivityFromRequest } from '../utils/activity-logger.util';

export class ClinicalNoteController {
  async getAllClinicalNotes(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const filters: {
        search?: string;
        patientId?: string;
        providerId?: string;
        appointmentId?: string;
        noteType?: string;
        isSigned?: boolean;
        startDate?: Date;
        endDate?: Date;
      } = {};

      if (req.query.search) filters.search = req.query.search as string;
      if (req.query.patientId) filters.patientId = req.query.patientId as string;
      if (req.query.providerId) filters.providerId = req.query.providerId as string;
      if (req.query.appointmentId) filters.appointmentId = req.query.appointmentId as string;
      if (req.query.noteType) filters.noteType = req.query.noteType as string;
      if (req.query.isSigned === 'true') filters.isSigned = true;
      else if (req.query.isSigned === 'false') filters.isSigned = false;
      if (req.query.startDate) filters.startDate = new Date(req.query.startDate as string);
      if (req.query.endDate) filters.endDate = new Date(req.query.endDate as string);

      const result = await clinicalNoteService.getAllClinicalNotes(page, limit, filters);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getClinicalNoteById(req: Request, res: Response, next: NextFunction) {
    try {
      const clinicalNoteId = req.params.clinicalNoteId as string;

      const clinicalNote = await clinicalNoteService.getClinicalNoteById(clinicalNoteId);

      if (req.userId) {
        await logActivityFromRequest(req, 'viewed', 'clinical_notes', clinicalNoteId);
      }

      res.status(200).json({
        success: true,
        data: { clinicalNote },
      });
    } catch (error) {
      next(error);
    }
  }

  async getClinicalNotesByPatient(req: Request, res: Response, next: NextFunction) {
    try {
      const patientId = req.params.patientId as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      const result = await clinicalNoteService.getClinicalNotesByPatient(patientId, page, limit);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getClinicalNoteByAppointment(req: Request, res: Response, next: NextFunction) {
    try {
      const appointmentId = req.params.appointmentId as string;

      const clinicalNote = await clinicalNoteService.getClinicalNoteByAppointment(appointmentId);

      res.status(200).json({
        success: true,
        data: { clinicalNote },
      });
    } catch (error) {
      next(error);
    }
  }

  async createClinicalNote(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const clinicalNote = await clinicalNoteService.createClinicalNote(req.body, req.userId);

      res.status(201).json({
        success: true,
        data: { clinicalNote },
        message: 'Clinical note created successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async createNoteFromTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const templateId = req.params.templateId as string;
      const { 
        patientId, 
        appointmentId, 
        providerId,
        noteType,
        chiefComplaint,
        subjective,
        objective,
        assessment,
        plan,
        historyOfPresentIllness,
        physicalExam,
        diagnosisCodes,
        requiresFollowUp,
        followUpDate,
      } = req.body;

      const noteData: {
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
      } = {
        patientId,
        appointmentId,
        providerId,
      };
      
      if (noteType) noteData.noteType = noteType;
      if (chiefComplaint) noteData.chiefComplaint = chiefComplaint;
      if (subjective) noteData.subjective = subjective;
      if (objective) noteData.objective = objective;
      if (assessment) noteData.assessment = assessment;
      if (plan) noteData.plan = plan;
      if (historyOfPresentIllness) noteData.historyOfPresentIllness = historyOfPresentIllness;
      if (physicalExam) noteData.physicalExam = physicalExam;
      if (diagnosisCodes) noteData.diagnosisCodes = diagnosisCodes;
      if (requiresFollowUp !== undefined) noteData.requiresFollowUp = requiresFollowUp;
      if (followUpDate) noteData.followUpDate = new Date(followUpDate);

      const clinicalNote = await clinicalNoteService.createNoteFromTemplate(
        templateId,
        noteData,
        req.userId
      );

      res.status(201).json({
        success: true,
        data: { clinicalNote },
        message: 'Clinical note created from template successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async updateClinicalNote(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const clinicalNoteId = req.params.clinicalNoteId as string;

      const clinicalNote = await clinicalNoteService.updateClinicalNote(
        clinicalNoteId,
        req.body,
        req.userId
      );

      res.status(200).json({
        success: true,
        data: { clinicalNote },
        message: 'Clinical note updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async saveDraft(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const clinicalNoteId = req.params.clinicalNoteId as string;

      const clinicalNote = await clinicalNoteService.saveDraft(
        clinicalNoteId,
        req.body,
        req.userId
      );

      res.status(200).json({
        success: true,
        data: { clinicalNote },
        message: 'Draft saved successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async signClinicalNote(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const clinicalNoteId = req.params.clinicalNoteId as string;

      const clinicalNote = await clinicalNoteService.signClinicalNote(clinicalNoteId, req.userId);

      res.status(200).json({
        success: true,
        data: { clinicalNote },
        message: 'Clinical note signed successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async addAttachment(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const clinicalNoteId = req.params.clinicalNoteId as string;
      const { attachmentUrl } = req.body;

      const clinicalNote = await clinicalNoteService.addAttachment(
        clinicalNoteId,
        attachmentUrl,
        req.userId
      );

      res.status(200).json({
        success: true,
        data: { clinicalNote },
        message: 'Attachment added successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async removeAttachment(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const clinicalNoteId = req.params.clinicalNoteId as string;
      const { attachmentUrl } = req.body;

      const clinicalNote = await clinicalNoteService.removeAttachment(
        clinicalNoteId,
        attachmentUrl,
        req.userId
      );

      res.status(200).json({
        success: true,
        data: { clinicalNote },
        message: 'Attachment removed successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteClinicalNote(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const clinicalNoteId = req.params.clinicalNoteId as string;

      await clinicalNoteService.deleteClinicalNote(clinicalNoteId, req.userId);

      res.status(200).json({
        success: true,
        message: 'Clinical note deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async getUnsignedNotes(req: Request, res: Response, next: NextFunction) {
    try {
      const providerId = req.params.providerId as string;

      const unsignedNotes = await clinicalNoteService.getUnsignedNotesByProvider(providerId);

      res.status(200).json({
        success: true,
        data: { unsignedNotes },
      });
    } catch (error) {
      next(error);
    }
  }

  async getPatientMedicalHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const patientId = req.params.patientId as string;
      
      const options: {
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
      } = {};

      if (req.query.includeAllergies === 'false') options.includeAllergies = false;
      if (req.query.includeVitals === 'false') options.includeVitals = false;
      if (req.query.includePrescriptions === 'false') options.includePrescriptions = false;
      if (req.query.includeLabOrders === 'false') options.includeLabOrders = false;
      if (req.query.includeLabResults === 'false') options.includeLabResults = false;
      if (req.query.includeDocuments === 'false') options.includeDocuments = false;
      if (req.query.includeNotes === 'false') options.includeNotes = false;
      
      if (req.query.startDate) options.startDate = new Date(req.query.startDate as string);
      if (req.query.endDate) options.endDate = new Date(req.query.endDate as string);
      if (req.query.limit) options.limit = parseInt(req.query.limit as string);

      const medicalHistory = await clinicalNoteService.getPatientMedicalHistory(patientId, options);

      if (req.userId) {
        await logActivityFromRequest(req, 'viewed', 'patient_medical_history', patientId);
      }

      res.status(200).json({
        success: true,
        data: medicalHistory,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const clinicalNoteController = new ClinicalNoteController();
