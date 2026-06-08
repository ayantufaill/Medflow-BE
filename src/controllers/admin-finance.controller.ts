import type { Request, Response, NextFunction } from 'express';
import { adminFinanceService } from '../services/admin-finance.service';

export class AdminFinanceController {
  async getDefinitions(req: Request, res: Response, next: NextFunction) {
    try {
      const category = parseInt(req.params.category as string, 10);
      const list = await adminFinanceService.getDefinitions(category);
      res.status(200).json({ success: true, data: list });
    } catch (error) {
      next(error);
    }
  }

  async createDefinition(req: Request, res: Response, next: NextFunction) {
    try {
      const category = parseInt(req.params.category as string, 10);
      const { name, value, itemOrder } = req.body;
      const created = await adminFinanceService.createDefinition(category, { name, value, itemOrder });
      res.status(201).json({ success: true, data: created });
    } catch (error) {
      next(error);
    }
  }

  async updateDefinition(req: Request, res: Response, next: NextFunction) {
    try {
      const { defNum } = req.params;
      const { name, value, isHidden, itemOrder } = req.body;
      const updated = await adminFinanceService.updateDefinition(defNum as string, {
        name,
        value,
        isHidden,
        itemOrder,
      });
      res.status(200).json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }

  async deleteDefinition(req: Request, res: Response, next: NextFunction) {
    try {
      const { defNum } = req.params;
      await adminFinanceService.deleteDefinition(defNum as string);
      res.status(200).json({ success: true, message: 'Definition deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async getSetting(req: Request, res: Response, next: NextFunction) {
    try {
      const { key } = req.params;
      const data = await adminFinanceService.getSetting(key as string);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async saveSetting(req: Request, res: Response, next: NextFunction) {
    try {
      const { key } = req.params;
      const data = await adminFinanceService.saveSetting(key as string, req.body);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

export const adminFinanceController = new AdminFinanceController();
