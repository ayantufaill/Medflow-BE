import type { Request, Response, NextFunction } from 'express';
import { audienceService } from '../services/audience.service';

export class AudienceController {
  async getSavedAudiences(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await audienceService.getSavedAudiences();
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async saveAudience(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, kind, filters } = req.body;
      if (!name || !kind) {
        return res.status(400).json({ success: false, message: 'Name and Kind are required' });
      }
      const result = await audienceService.saveAudience({ name, kind, filters: filters || [] });
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async deleteAudience(req: Request, res: Response, next: NextFunction) {
    try {
      const { audienceId } = req.params;
      await audienceService.deleteAudience(audienceId);
      res.status(200).json({ success: true, message: 'Audience deleted' });
    } catch (error) {
      next(error);
    }
  }
}

export const audienceController = new AudienceController();
