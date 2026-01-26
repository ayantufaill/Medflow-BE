import type { Request, Response, NextFunction } from 'express';
import { noteTemplateService } from '../services/note-template.service';
import { logActivityFromRequest } from '../utils/activity-logger.util';

export class NoteTemplateController {
  async getAllNoteTemplates(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = req.query.search as string | undefined;
      const specialty = req.query.specialty as string | undefined;
      const isActive = req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;

      const result = await noteTemplateService.getAllNoteTemplates(
        page,
        limit,
        search || undefined,
        specialty || undefined,
        isActive
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getNoteTemplateById(req: Request, res: Response, next: NextFunction) {
    try {
      const { noteTemplateId } = req.params;
      
      if (!noteTemplateId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Note template ID is required' },
        });
      }

      const noteTemplate = await noteTemplateService.getNoteTemplateById(noteTemplateId);

      if (req.userId) {
        await logActivityFromRequest(req, 'viewed', 'note_templates', noteTemplateId);
      }

      res.status(200).json({
        success: true,
        data: { noteTemplate },
      });
    } catch (error) {
      next(error);
    }
  }

  async createNoteTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const {
        name,
        description,
        templateStructure,
        defaultContent,
        specialty,
      } = req.body;

      const noteTemplate = await noteTemplateService.createNoteTemplate(
        {
          name,
          description,
          templateStructure,
          defaultContent,
          specialty,
        },
        req.userId
      );

      res.status(201).json({
        success: true,
        data: { noteTemplate },
        message: 'Note template created successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async updateNoteTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const { noteTemplateId } = req.params;
      
      if (!noteTemplateId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Note template ID is required' },
        });
      }
      
      const updates = req.body;

      const noteTemplate = await noteTemplateService.updateNoteTemplate(
        noteTemplateId,
        updates,
        req.userId
      );

      res.status(200).json({
        success: true,
        data: { noteTemplate },
        message: 'Note template updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteNoteTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const { noteTemplateId } = req.params;
      
      if (!noteTemplateId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Note template ID is required' },
        });
      }

      await noteTemplateService.deleteNoteTemplate(noteTemplateId, req.userId);

      res.status(200).json({
        success: true,
        message: 'Note template deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async duplicateNoteTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const { noteTemplateId } = req.params;
      
      if (!noteTemplateId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Note template ID is required' },
        });
      }
      
      const { newName } = req.body;

      if (!newName) {
        return res.status(400).json({
          success: false,
          error: { message: 'New name is required for duplication' },
        });
      }

      const noteTemplate = await noteTemplateService.duplicateNoteTemplate(
        noteTemplateId,
        newName,
        req.userId
      );

      res.status(201).json({
        success: true,
        data: { noteTemplate },
        message: 'Note template duplicated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async getTemplatesBySpecialty(req: Request, res: Response, next: NextFunction) {
    try {
      const { specialty } = req.params;
      
      if (!specialty) {
        return res.status(400).json({
          success: false,
          error: { message: 'Specialty is required' },
        });
      }

      const noteTemplates = await noteTemplateService.getTemplatesBySpecialty(specialty);

      res.status(200).json({
        success: true,
        data: { noteTemplates },
      });
    } catch (error) {
      next(error);
    }
  }

  async getActiveTemplates(req: Request, res: Response, next: NextFunction) {
    try {
      const noteTemplates = await noteTemplateService.getActiveTemplates();

      res.status(200).json({
        success: true,
        data: { noteTemplates },
      });
    } catch (error) {
      next(error);
    }
  }

  async toggleNoteTemplateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const { noteTemplateId } = req.params;
      
      if (!noteTemplateId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Note template ID is required' },
        });
      }

      const noteTemplate = await noteTemplateService.toggleNoteTemplateStatus(
        noteTemplateId,
        req.userId
      );

      res.status(200).json({
        success: true,
        data: { noteTemplate },
        message: 'Note template status updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const noteTemplateController = new NoteTemplateController();
