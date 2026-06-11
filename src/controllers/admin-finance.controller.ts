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
      const { name, value, itemOrder, amount, percent, note, depositSlip, openEdge, prosperipay, smilepay } = req.body;
      const created = await adminFinanceService.createDefinition(category, {
        name,
        value,
        itemOrder,
        amount,
        percent,
        note,
        depositSlip,
        openEdge,
        prosperipay,
        smilepay,
      });
      res.status(201).json({ success: true, data: created });
    } catch (error) {
      next(error);
    }
  }

  async updateDefinition(req: Request, res: Response, next: NextFunction) {
    try {
      const { defNum } = req.params;
      const { name, value, isHidden, itemOrder, amount, percent, note, depositSlip, openEdge, prosperipay, smilepay } = req.body;
      const updated = await adminFinanceService.updateDefinition(defNum as string, {
        name,
        value,
        isHidden,
        itemOrder,
        amount,
        percent,
        note,
        depositSlip,
        openEdge,
        prosperipay,
        smilepay,
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

  // --- STATEMENT PRINT-OUT FORMS ---
  async getStatementForms(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminFinanceService.getStatementForms();
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async createStatementForm(req: Request, res: Response, next: NextFunction) {
    try {
      const created = await adminFinanceService.createStatementForm(req.body);
      res.status(201).json({ success: true, data: created });
    } catch (error) {
      next(error);
    }
  }

  async updateStatementForm(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const updated = await adminFinanceService.updateStatementForm(id as string, req.body);
      res.status(200).json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }

  async deleteStatementForm(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await adminFinanceService.deleteStatementForm(id as string);
      res.status(200).json({ success: true, message: 'Statement form deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  // --- COVERAGE BOOK SHORTCUTS ---
  async getCoverageBookShortcuts(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adminFinanceService.getCoverageBookShortcuts();
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async createCoverageBookShortcut(req: Request, res: Response, next: NextFunction) {
    try {
      const created = await adminFinanceService.createCoverageBookShortcut(req.body);
      res.status(201).json({ success: true, data: created });
    } catch (error) {
      next(error);
    }
  }

  async updateCoverageBookShortcut(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const updated = await adminFinanceService.updateCoverageBookShortcut(id as string, req.body);
      res.status(200).json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }

  async deleteCoverageBookShortcut(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await adminFinanceService.deleteCoverageBookShortcut(id as string);
      res.status(200).json({ success: true, message: 'Coverage shortcut deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}

export const adminFinanceController = new AdminFinanceController();
