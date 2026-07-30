import type { Request, Response, NextFunction } from 'express';
import { clinicalManagementService } from '../services/clinical-management.service';

export class ClinicalManagementController {
  // --- PRODUCTS ---
  async getProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const products = await clinicalManagementService.getProducts();
      res.status(200).json({ success: true, data: products });
    } catch (error) {
      next(error);
    }
  }

  async createProductCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, section } = req.body;
      const category = await clinicalManagementService.createProductCategory(name, section);
      res.status(201).json({ success: true, data: category });
    } catch (error) {
      next(error);
    }
  }

  async createProductChoice(req: Request, res: Response, next: NextFunction) {
    try {
      const categoryId = req.params.categoryId as string;
      const choice = await clinicalManagementService.createProductChoice(categoryId, req.body);
      res.status(201).json({ success: true, data: choice });
    } catch (error) {
      next(error);
    }
  }

  async updateProductChoice(req: Request, res: Response, next: NextFunction) {
    try {
      const choiceId = req.params.choiceId as string;
      const choice = await clinicalManagementService.updateProductChoice(choiceId, req.body);
      res.status(200).json({ success: true, data: choice });
    } catch (error) {
      next(error);
    }
  }

  async deactivateProductCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const categoryId = req.params.categoryId as string;
      const result = await clinicalManagementService.deactivateProductCategory(categoryId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async deactivateProductChoice(req: Request, res: Response, next: NextFunction) {
    try {
      const choiceId = req.params.choiceId as string;
      const result = await clinicalManagementService.deactivateProductChoice(choiceId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // --- CHECKLISTS ---
  async getChecklists(req: Request, res: Response, next: NextFunction) {
    try {
      const checklists = await clinicalManagementService.getChecklists();
      res.status(200).json({ success: true, data: checklists });
    } catch (error) {
      next(error);
    }
  }

  async createChecklistCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const { name } = req.body;
      const category = await clinicalManagementService.createChecklistCategory(name);
      res.status(201).json({ success: true, data: category });
    } catch (error) {
      next(error);
    }
  }

  async createChecklist(req: Request, res: Response, next: NextFunction) {
    try {
      const { categoryName, ...rest } = req.body;
      const checklist = await clinicalManagementService.createChecklist(categoryName, rest);
      res.status(201).json({ success: true, data: checklist });
    } catch (error) {
      next(error);
    }
  }

  async createChecklistItem(req: Request, res: Response, next: NextFunction) {
    try {
      const checklistId = req.params.checklistId as string;
      const item = await clinicalManagementService.createChecklistItem(checklistId, req.body);
      res.status(201).json({ success: true, data: item });
    } catch (error) {
      next(error);
    }
  }

  async addChoiceToChecklistItem(req: Request, res: Response, next: NextFunction) {
    try {
      const itemId = req.params.itemId as string;
      const { choice } = req.body;
      const result = await clinicalManagementService.addChoiceToChecklistItem(itemId, choice);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async addProductToChecklistItem(req: Request, res: Response, next: NextFunction) {
    try {
      const itemId = req.params.itemId as string;
      const { product } = req.body;
      const result = await clinicalManagementService.addProductToChecklistItem(itemId, product);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async updateChecklist(req: Request, res: Response, next: NextFunction) {
    try {
      const checklistId = req.params.checklistId as string;
      const checklist = await clinicalManagementService.updateChecklist(checklistId, req.body);
      res.status(200).json({ success: true, data: checklist });
    } catch (error) {
      next(error);
    }
  }

  async deleteChecklistCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const categoryName = req.params.categoryName as string;
      const result = await clinicalManagementService.deleteChecklistCategory(categoryName);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async deleteChecklist(req: Request, res: Response, next: NextFunction) {
    try {
      const checklistId = req.params.checklistId as string;
      const result = await clinicalManagementService.deleteChecklist(checklistId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async deleteChecklistItem(req: Request, res: Response, next: NextFunction) {
    try {
      const itemId = req.params.itemId as string;
      const result = await clinicalManagementService.deleteChecklistItem(itemId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async removeChoiceFromChecklistItem(req: Request, res: Response, next: NextFunction) {
    try {
      const itemId = req.params.itemId as string;
      const choiceIndex = parseInt(req.params.choiceIndex, 10);
      const result = await clinicalManagementService.removeChoiceFromChecklistItem(itemId, choiceIndex);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async removeProductFromChecklistItem(req: Request, res: Response, next: NextFunction) {
    try {
      const itemId = req.params.itemId as string;
      const productIndex = parseInt(req.params.productIndex, 10);
      const result = await clinicalManagementService.removeProductFromChecklistItem(itemId, productIndex);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // --- PRESCRIPTION TEMPLATES ---
  async getPrescriptionTemplates(req: Request, res: Response, next: NextFunction) {
    try {
      const templates = await clinicalManagementService.getPrescriptionTemplates();
      res.status(200).json({ success: true, data: templates });
    } catch (error) {
      next(error);
    }
  }

  async createPrescriptionTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const template = await clinicalManagementService.createPrescriptionTemplate(req.body);
      res.status(201).json({ success: true, data: template });
    } catch (error) {
      next(error);
    }
  }

  async updatePrescriptionTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const templateId = req.params.templateId as string;
      const template = await clinicalManagementService.updatePrescriptionTemplate(templateId, req.body);
      res.status(200).json({ success: true, data: template });
    } catch (error) {
      next(error);
    }
  }

  async deletePrescriptionTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const templateId = req.params.templateId as string;
      const result = await clinicalManagementService.deletePrescriptionTemplate(templateId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // --- SYSTEM SETTINGS ---
  async getSystemSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await clinicalManagementService.getSystemSettings();
      res.status(200).json({ success: true, data: settings });
    } catch (error) {
      next(error);
    }
  }

  async updateSystemSetting(req: Request, res: Response, next: NextFunction) {
    try {
      const { key, value } = req.body;
      const setting = await clinicalManagementService.updateSystemSetting(key, value);
      res.status(200).json({ success: true, data: setting });
    } catch (error) {
      next(error);
    }
  }

  // --- RECARE CONFIG ---
  async getRecareConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const config = await clinicalManagementService.getRecareConfig();
      res.status(200).json({ success: true, data: config });
    } catch (error) {
      next(error);
    }
  }

  async updateRecareConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const config = await clinicalManagementService.updateRecareConfig(req.body);
      res.status(200).json({ success: true, data: config });
    } catch (error) {
      next(error);
    }
  }

  // --- TREATMENT PLAN PRESENTATION ---
  async getTreatmentPlanPresentationConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const config = await clinicalManagementService.getTreatmentPlanPresentationConfig();
      res.status(200).json({ success: true, data: config });
    } catch (error) {
      next(error);
    }
  }

  async updateTreatmentPlanPresentationConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const config = await clinicalManagementService.updateTreatmentPlanPresentationConfig(req.body);
      res.status(200).json({ success: true, data: config });
    } catch (error) {
      next(error);
    }
  }

  // --- INFORMED CONSENT ---
  async getInformedConsents(req: Request, res: Response, next: NextFunction) {
    try {
      const consents = await clinicalManagementService.getInformedConsents();
      res.status(200).json({ success: true, data: consents });
    } catch (error) {
      next(error);
    }
  }

  async createInformedConsent(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, content } = req.body;
      const consent = await clinicalManagementService.createInformedConsent(name, content);
      res.status(201).json({ success: true, data: consent });
    } catch (error) {
      next(error);
    }
  }

  async updateInformedConsent(req: Request, res: Response, next: NextFunction) {
    try {
      const templateId = req.params.templateId as string;
      const consent = await clinicalManagementService.updateInformedConsent(templateId, req.body);
      res.status(200).json({ success: true, data: consent });
    } catch (error) {
      next(error);
    }
  }

  async deleteInformedConsent(req: Request, res: Response, next: NextFunction) {
    try {
      const templateId = req.params.templateId as string;
      const result = await clinicalManagementService.deleteInformedConsent(templateId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // --- PRE/POST-OPS ---
  async getPrePostOps(req: Request, res: Response, next: NextFunction) {
    try {
      const templates = await clinicalManagementService.getPrePostOps();
      res.status(200).json({ success: true, data: templates });
    } catch (error) {
      next(error);
    }
  }

  async createPrePostOp(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, type, content } = req.body;
      const template = await clinicalManagementService.createPrePostOp(name, type, content);
      res.status(201).json({ success: true, data: template });
    } catch (error) {
      next(error);
    }
  }

  async updatePrePostOp(req: Request, res: Response, next: NextFunction) {
    try {
      const templateId = req.params.templateId as string;
      const template = await clinicalManagementService.updatePrePostOp(templateId, req.body);
      res.status(200).json({ success: true, data: template });
    } catch (error) {
      next(error);
    }
  }

  async deletePrePostOp(req: Request, res: Response, next: NextFunction) {
    try {
      const templateId = req.params.templateId as string;
      const result = await clinicalManagementService.deletePrePostOp(templateId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

export const clinicalManagementController = new ClinicalManagementController();
