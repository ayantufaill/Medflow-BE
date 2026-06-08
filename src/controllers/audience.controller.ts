import type { Request, Response, NextFunction } from 'express';
import { audienceService } from '../services/audience.service';

export class AudienceController {
  async getAllAudiences(req: Request, res: Response, next: NextFunction) {
    try {
      const audiences = await audienceService.getAllAudiences();
      res.status(200).json({
        success: true,
        data: audiences,
      });
    } catch (error) {
      next(error);
    }
  }

  async saveAudience(req: Request, res: Response, next: NextFunction) {
    try {
      const audience = await audienceService.saveAudience(req.body, req.userId);
      res.status(201).json({
        success: true,
        data: audience,
        message: 'Audience segment saved successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteAudience(req: Request, res: Response, next: NextFunction) {
    try {
      const { audienceId } = req.params;
      const result = await audienceService.deleteAudience(audienceId);
      res.status(200).json({
        success: true,
        data: result,
        message: 'Audience segment deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const audienceController = new AudienceController();
