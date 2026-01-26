import type { Request, Response, NextFunction } from 'express';
import { insuranceCompanyService } from '../services/insurance-company.service';
import { logActivityFromRequest } from '../utils/activity-logger.util';

export class InsuranceCompanyController {
  async getAllInsuranceCompanies(req: Request, res: Response, next: NextFunction) {
    try {
      const isActive = req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;
      const search = req.query.search as string | undefined;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      const filters: {
        search?: string;
        isActive?: boolean;
        page: number;
        limit: number;
      } = {
        page,
        limit,
      };
      
      if (search) filters.search = search;
      if (isActive !== undefined) filters.isActive = isActive;

      const result = await insuranceCompanyService.getAllInsuranceCompanies(filters);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getInsuranceCompanyById(req: Request, res: Response, next: NextFunction) {
    try {
      const { insuranceCompanyId } = req.params;
      
      if (!insuranceCompanyId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Insurance company ID is required' },
        });
      }
      
      const company = await insuranceCompanyService.getInsuranceCompanyById(insuranceCompanyId);

      // Log activity
      if (req.userId) {
        await logActivityFromRequest(req, 'viewed', 'insurance_companies', insuranceCompanyId);
      }

      res.status(200).json({
        success: true,
        data: { company },
      });
    } catch (error) {
      next(error);
    }
  }

  async createInsuranceCompany(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const company = await insuranceCompanyService.createInsuranceCompany(req.body, req.userId);
      res.status(201).json({
        success: true,
        data: { company },
      });
    } catch (error) {
      next(error);
    }
  }

  async updateInsuranceCompany(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const { insuranceCompanyId } = req.params;
      
      if (!insuranceCompanyId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Insurance company ID is required' },
        });
      }
      
      const company = await insuranceCompanyService.updateInsuranceCompany(
        insuranceCompanyId,
        req.body,
        req.userId
      );
      res.status(200).json({
        success: true,
        data: { company },
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteInsuranceCompany(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const { insuranceCompanyId } = req.params;
      
      if (!insuranceCompanyId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Insurance company ID is required' },
        });
      }
      
      const result = await insuranceCompanyService.deleteInsuranceCompany(insuranceCompanyId, req.userId);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const insuranceCompanyController = new InsuranceCompanyController();

