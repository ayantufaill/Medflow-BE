import type { Request, Response, NextFunction } from 'express';
import { insuranceCompanyService } from '../services/insurance-company.service';
import { logActivityFromRequest } from '../utils/activity-logger.util';

export class InsuranceCompanyController {
  private getEmailFromRawBody(req: Request): string | undefined {
    const rawBody = (req as any).rawBody;
    if (!rawBody || typeof rawBody !== 'string') return undefined;

    try {
      const parsed = JSON.parse(rawBody);
      if (!parsed || typeof parsed !== 'object') return undefined;
      const value = (parsed as Record<string, unknown>).email;
      if (value === undefined || value === null) return undefined;
      const normalized = String(value).trim();
      return normalized.length > 0 ? normalized : undefined;
    } catch {
      return undefined;
    }
  }

  private normalizePayload(body: any) {
    const hasOwn = (key: string) => Object.prototype.hasOwnProperty.call(body ?? {}, key);
    const pick = (...keys: string[]) => {
      for (const key of keys) {
        if (hasOwn(key)) return body[key];
      }
      return undefined;
    };
    const normalizeOptionalString = (value: any) => {
      if (value === undefined) return undefined;
      if (value === null) return undefined;
      const str = String(value).trim();
      return str.length > 0 ? str : undefined;
    };

    return {
      name: normalizeOptionalString(pick('name', 'Name')),
      payerId: normalizeOptionalString(pick('payerId', 'PayerId', 'payerID')),
      phone: normalizeOptionalString(pick('phone', 'Phone')),
      addressLine1: normalizeOptionalString(pick('addressLine1', 'AddressLine1', 'address')),
      addressLine2: normalizeOptionalString(pick('addressLine2', 'AddressLine2', 'address2')),
      city: normalizeOptionalString(pick('city', 'City')),
      state: normalizeOptionalString(pick('state', 'State')),
      zipCode: normalizeOptionalString(pick('zipCode', 'ZipCode', 'zip')),
      email: normalizeOptionalString(pick('email', 'Email', 'emailAddress')),
      fax: normalizeOptionalString(pick('fax', 'Fax')),
      website: normalizeOptionalString(pick('website', 'Website')),
      country: normalizeOptionalString(pick('country', 'Country')),
      isActive: pick('isActive', 'IsActive'),
    };
  }

  private mergeWithRawBody(rawBody: any, normalized: Record<string, any>) {
    const payload = { ...(rawBody ?? {}) } as Record<string, any>;
    for (const [key, value] of Object.entries(normalized)) {
      if (value !== undefined) {
        payload[key] = value;
      } else {
        delete payload[key];
      }
    }
    return payload;
  }

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

      const normalized = this.normalizePayload(req.body);
      const mergedPayload = this.mergeWithRawBody(req.body, normalized);
      const createPayload: {
        name: string;
        payerId?: string;
        phone?: string;
        addressLine1?: string;
        addressLine2?: string;
        city?: string;
        state?: string;
        zipCode?: string;
        email?: string;
        fax?: string;
        website?: string;
        country?: string;
        isActive?: boolean;
      } = {
        name:
          normalized.name ??
          (typeof req.body?.name === 'string' ? req.body.name.trim() : ''),
        payerId: mergedPayload.payerId,
        phone: mergedPayload.phone,
        addressLine1: mergedPayload.addressLine1,
        addressLine2: mergedPayload.addressLine2,
        city: mergedPayload.city,
        state: mergedPayload.state,
        zipCode: mergedPayload.zipCode,
        email: mergedPayload.email,
        fax: mergedPayload.fax,
        website: mergedPayload.website,
        country: mergedPayload.country,
        isActive: mergedPayload.isActive,
      };
      if (!createPayload.email) {
        createPayload.email = this.getEmailFromRawBody(req);
      }
      const company = await insuranceCompanyService.createInsuranceCompany(createPayload, req.userId);
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
      
      const payload = this.mergeWithRawBody(req.body, this.normalizePayload(req.body));
      if (!payload.email) {
        payload.email = this.getEmailFromRawBody(req);
      }
      const company = await insuranceCompanyService.updateInsuranceCompany(
        insuranceCompanyId,
        payload,
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
