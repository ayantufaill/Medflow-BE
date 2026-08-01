import type { Request, Response, NextFunction } from 'express';
import { communicationService } from '../services/communication.service';
import { logActivityFromRequest } from '../utils/activity-logger.util';

export class CommunicationController {
  /* ─── Communication Settings ─── */
  async getSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await communicationService.getSettings();
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await communicationService.updateSettings(req.body);
      if (req.userId) {
        await logActivityFromRequest(req, 'updated', 'settings', 'communication');
      }
      res.status(200).json({
        success: true,
        data: result,
        message: 'Settings updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /* ─── Templates ─── */
  async getTemplates(req: Request, res: Response, next: NextFunction) {
    try {
      const type = req.query.type ? parseInt(req.query.type as string, 10) : undefined;
      const result = await communicationService.getTemplates(type);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getTemplateById(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await communicationService.getTemplateById(req.params.id);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async createTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await communicationService.createTemplate(req.body);
      if (req.userId) {
        await logActivityFromRequest(req, 'created', 'templates', result._id);
      }
      res.status(201).json({
        success: true,
        data: result,
        message: 'Template created successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async updateTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await communicationService.updateTemplate(req.params.id, req.body);
      if (req.userId) {
        await logActivityFromRequest(req, 'updated', 'templates', req.params.id);
      }
      res.status(200).json({
        success: true,
        data: result,
        message: 'Template updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await communicationService.deleteTemplate(req.params.id);
      if (req.userId) {
        await logActivityFromRequest(req, 'deleted', 'templates', req.params.id);
      }
      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }

  /* ─── Email Campaigns ─── */
  async getCampaigns(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 10;
      const result = await communicationService.getCampaigns(page, limit);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getCampaignMetrics(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await communicationService.getCampaignMetrics();
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getCampaignById(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await communicationService.getCampaignById(req.params.id);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async createCampaign(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'Authentication required' },
        });
      }
      const result = await communicationService.createCampaign(req.body, req.userId);
      await logActivityFromRequest(req, 'created', 'campaigns', result._id);
      res.status(201).json({
        success: true,
        data: result,
        message: 'Campaign created successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async updateCampaign(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await communicationService.updateCampaign(req.params.id, req.body);
      if (req.userId) {
        await logActivityFromRequest(req, 'updated', 'campaigns', req.params.id);
      }
      res.status(200).json({
        success: true,
        data: result,
        message: 'Campaign updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteCampaign(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await communicationService.deleteCampaign(req.params.id);
      if (req.userId) {
        await logActivityFromRequest(req, 'deleted', 'campaigns', req.params.id);
      }
      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }

  /* ─── Questionnaires ─── */
  async getQuestionnaires(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await communicationService.getQuestionnaires();
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getQuestionnaireById(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await communicationService.getQuestionnaireById(req.params.id);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async createQuestionnaire(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await communicationService.createQuestionnaire(req.body);
      if (req.userId) {
        await logActivityFromRequest(req, 'created', 'questionnaires', result._id);
      }
      res.status(201).json({
        success: true,
        data: result,
        message: 'Questionnaire created successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async updateQuestionnaire(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await communicationService.updateQuestionnaire(req.params.id, req.body);
      if (req.userId) {
        await logActivityFromRequest(req, 'updated', 'questionnaires', req.params.id);
      }
      res.status(200).json({
        success: true,
        data: result,
        message: 'Questionnaire updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteQuestionnaire(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await communicationService.deleteQuestionnaire(req.params.id);
      if (req.userId) {
        await logActivityFromRequest(req, 'deleted', 'questionnaires', req.params.id);
      }
      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }

  /* ─── Gap Fills ─── */
  async getGapFills(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await communicationService.getGapFills();
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getGapFillSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await communicationService.getGapFillSettings();
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async saveGapFillSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await communicationService.saveGapFillSettings(req.body);
      if (req.userId) {
        await logActivityFromRequest(req, 'updated', 'gapfills_settings', 'global');
      }
      res.status(200).json({
        success: true,
        data: result,
        message: 'Gap fill settings saved successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async saveGapFill(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await communicationService.saveGapFill(req.body);
      if (req.userId) {
        await logActivityFromRequest(req, 'updated', 'gapfills', result.id);
      }
      res.status(200).json({
        success: true,
        data: result,
        message: 'Gap fill configuration saved successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteGapFill(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await communicationService.deleteGapFill(req.params.id);
      if (req.userId) {
        await logActivityFromRequest(req, 'deleted', 'gapfills', req.params.id);
      }
      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }

  /* ─── Review Settings ─── */
  async getReviewSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await communicationService.getReviewSettings();
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateReviewSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await communicationService.updateReviewSettings(req.body);
      if (req.userId) {
        await logActivityFromRequest(req, 'updated', 'reviews', 'settings');
      }
      res.status(200).json({
        success: true,
        data: result,
        message: 'Review settings updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const communicationController = new CommunicationController();
