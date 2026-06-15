import type { NextFunction, Request, Response } from 'express';
import { insurancePlanService } from '../services/insurance-plan.service';

export class InsurancePlanController {
  async getInsurancePlans(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt((req.query.page as string) || '1', 10);
      const limit = parseInt((req.query.limit as string) || '20', 10);
      const search = (req.query.search as string) || '';
      const result = await insurancePlanService.getInsurancePlans(page, limit, search);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getInsurancePlanById(req: Request, res: Response, next: NextFunction) {
    try {
      const { planId } = req.params;
      if (!planId) {
        return res.status(400).json({ success: false, error: { message: 'Plan ID is required' } });
      }
      const plan = await insurancePlanService.getInsurancePlanById(planId);
      res.status(200).json({ success: true, data: { plan } });
    } catch (error) {
      next(error);
    }
  }

  async createInsurancePlan(req: Request, res: Response, next: NextFunction) {
    try {
      const plan = await insurancePlanService.createInsurancePlan(req.body);
      res.status(201).json({ success: true, data: { plan } });
    } catch (error) {
      next(error);
    }
  }

  async updateInsurancePlan(req: Request, res: Response, next: NextFunction) {
    try {
      const { planId } = req.params;
      if (!planId) {
        return res.status(400).json({ success: false, error: { message: 'Plan ID is required' } });
      }
      const plan = await insurancePlanService.updateInsurancePlan(planId, req.body);
      res.status(200).json({ success: true, data: { plan } });
    } catch (error) {
      next(error);
    }
  }

  async getCoverageTemplates(_req: Request, res: Response, next: NextFunction) {
    try {
      const result = await insurancePlanService.getCoverageTemplates();
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async createCoverageTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await insurancePlanService.createCoverageTemplate(req.body, req.userId);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getPatientCoverages(req: Request, res: Response, next: NextFunction) {
    try {
      const { patientId } = req.params;
      if (!patientId) {
        return res.status(400).json({ success: false, error: { message: 'Patient ID is required' } });
      }
      const result = await insurancePlanService.getPatientCoverages(patientId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async createPatientCoverage(req: Request, res: Response, next: NextFunction) {
    try {
      const { patientId } = req.params;
      if (!patientId) {
        return res.status(400).json({ success: false, error: { message: 'Patient ID is required' } });
      }
      const result = await insurancePlanService.createPatientCoverage(patientId, req.body, req.userId);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async deleteInsurancePlan(req: Request, res: Response, next: NextFunction) {
    try {
      const { planId } = req.params;
      if (!planId) {
        return res.status(400).json({ success: false, error: { message: 'Plan ID is required' } });
      }
      await insurancePlanService.deleteInsurancePlan(planId);
      res.status(200).json({ success: true, message: 'Insurance plan deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}

export const insurancePlanController = new InsurancePlanController();
