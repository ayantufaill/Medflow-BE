import { Request, Response, NextFunction } from 'express';
import { progressNoteService } from '../services/progress-note.service';

export class ProgressNoteController {
  getProgressNotes = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 25;
      
      const filters = {
        patientId: req.query.patientId as string | undefined,
        category: req.query.category as string | undefined,
        tab: req.query.tab as string | undefined
      };

      const result = await progressNoteService.getAllProgressNotes(filters, page, limit);

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  };

  createProgressNote = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { patientId, category, description, providerId } = req.body;
      
      const result = await progressNoteService.createProgressNote({
        patientId,
        category,
        description,
        providerId
      });

      res.status(201).json({
        success: true,
        data: { progressNote: result },
        message: 'Progress note created successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  addProcedure = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const noteId = req.params.id;
      const { procedureCode } = req.body;

      const result = await progressNoteService.addProcedureToNote(noteId, procedureCode);

      res.status(200).json({
        success: true,
        data: result,
        message: result.message
      });
    } catch (error) {
      next(error);
    }
  };
}

export const progressNoteController = new ProgressNoteController();
