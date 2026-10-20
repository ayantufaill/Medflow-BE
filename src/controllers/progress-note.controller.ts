import { Request, Response, NextFunction } from 'express';
import { progressNoteService } from '../services/progress-note.service';
import { getNoteHistory } from '../services/note-history.service';
import { logActivity } from '../utils/activity-logger.util';

export class ProgressNoteController {
  getProgressNote = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const progressNote = await progressNoteService.getProgressNoteById(req.params.id);
      res.status(200).json({ success: true, data: { progressNote } });
    } catch (error) { next(error); }
  };

  getHistory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const history = await getNoteHistory(req.params.id, 'progress_notes');
      res.status(200).json({ success: true, data: { history } });
    } catch (error) { next(error); }
  };
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
      const { patientId, category, description, providerId, title, tags } = req.body;
      
      if (!patientId) {
        return res.status(400).json({ success: false, message: 'patientId is required' });
      }
      if (!providerId) {
        return res.status(400).json({ success: false, message: 'providerId is required' });
      }

      const result = await progressNoteService.createProgressNote({
        patientId,
        category,
        description,
        providerId,
        title,
        tags
      });
      if (req.userId) await logActivity(req.userId, 'created', 'progress_notes', result.id, undefined, result);

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
      const before = await progressNoteService.getProgressNoteById(noteId);

      const result = await progressNoteService.addProcedureToNote(noteId, procedureCode);
      if (req.userId) await logActivity(req.userId, 'updated', 'progress_notes', noteId, before, await progressNoteService.getProgressNoteById(noteId));

      res.status(200).json({
        success: true,
        data: result,
        message: result.message
      });
    } catch (error) {
      next(error);
    }
  };
  updateProgressNote = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { description, category, title, tags } = req.body;
    const before = await progressNoteService.getProgressNoteById(id);
    
    const result = await progressNoteService.updateProgressNote(id, {
      description,
      category,
      title,
      tags
    });
    if (req.userId) await logActivity(req.userId, 'updated', 'progress_notes', id, before, await progressNoteService.getProgressNoteById(id));

    res.status(200).json({
      success: true,
      data: { progressNote: result },
      message: 'Progress note updated successfully'
    });
  } catch (error) {
    next(error);
  }
};
archiveProgressNote = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const before = await progressNoteService.getProgressNoteById(id);
    const result = await progressNoteService.archiveProgressNote(id);
    if (req.userId) await logActivity(req.userId, 'status_updated', 'progress_notes', id, before, await progressNoteService.getProgressNoteById(id));

    res.status(200).json({
      success: true,
      data: { progressNote: result },
      message: 'Progress note archived successfully'
    });
  } catch (error) {
    next(error);
  }
};

unarchiveProgressNote = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const before = await progressNoteService.getProgressNoteById(id);
    const result = await progressNoteService.unarchiveProgressNote(id);
    if (req.userId) await logActivity(req.userId, 'status_updated', 'progress_notes', id, before, await progressNoteService.getProgressNoteById(id));

    res.status(200).json({
      success: true,
      data: { progressNote: result },
      message: 'Progress note unarchived successfully'
    });
  } catch (error) {
    next(error);
  }
};
signProgressNote = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { signedBy } = req.body;
    const before = await progressNoteService.getProgressNoteById(id);
    const userId = req.userId;
    
    const result = await progressNoteService.signProgressNote(id, {
      signedBy: signedBy || userId?.toString() || 'Unknown',
      signedDate: new Date().toISOString()
    });
    if (req.userId) await logActivity(req.userId, 'status_updated', 'progress_notes', id, before, await progressNoteService.getProgressNoteById(id));

    res.status(200).json({
      success: true,
      data: { progressNote: result },
      message: 'Progress note signed successfully'
    });
  } catch (error) {
    next(error);
  }
};

exportProgressNote = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const pdfBuffer = await progressNoteService.exportProgressNoteToPdf(id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="progress-note-${id}.pdf"`);
    res.status(200).send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};
}

export const progressNoteController = new ProgressNoteController();
