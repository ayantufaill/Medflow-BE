import type { Request, Response, NextFunction } from 'express';
import { formTemplateService } from '../services/form-template.service';

export class FormTemplateController {
  async getAllTemplates(req: Request, res: Response, next: NextFunction) {
    try {
      const includeInactive = req.query.includeInactive === 'true';
      const data = await formTemplateService.getAllTemplates(includeInactive);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getTemplateByTemplateId(req: Request, res: Response, next: NextFunction) {
    try {
      const { templateId } = req.params;
      const data = await formTemplateService.getTemplateByTemplateId(templateId);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async createTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const { templateId, name, description, fields, isActive } = req.body;
      const data = await formTemplateService.createTemplate({
        templateId,
        name,
        description,
        fields,
        isActive,
      });
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async updateTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const { templateId } = req.params;
      const { name, description, fields, isActive } = req.body;
      const data = await formTemplateService.updateTemplate(templateId, {
        name,
        description,
        fields,
        isActive,
      });
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async deactivateTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const { templateId } = req.params;
      const data = await formTemplateService.deactivateTemplate(templateId);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

export const formTemplateController = new FormTemplateController();
