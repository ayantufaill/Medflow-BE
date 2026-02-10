import type { Request, Response, NextFunction } from 'express';
import { claimService } from '../services/claim.service';

export class ClaimController {
  async getAllClaims(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const filters: Parameters<typeof claimService.getAllClaims>[2] = {};

      const patientId = req.query.patientId as string | undefined;
      const invoiceId = req.query.invoiceId as string | undefined;
      const insuranceCompanyId = req.query.insuranceCompanyId as string | undefined;
      const status = req.query.status as string | undefined;
      const deniedOnly = req.query.deniedOnly === 'true';
      const secondaryOnly = req.query.secondaryOnly === 'true' || req.query.insuranceType === 'secondary';
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const search = req.query.search as string | undefined;

      if (patientId) filters.patientId = patientId;
      if (secondaryOnly) filters.secondaryOnly = true;
      if (invoiceId) filters.invoiceId = invoiceId;
      if (insuranceCompanyId) filters.insuranceCompanyId = insuranceCompanyId;
      if (status) filters.status = status;
      if (deniedOnly) filters.deniedOnly = deniedOnly;
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;
      if (search) filters.search = search;

      const result = await claimService.getAllClaims(page, limit, filters);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getClaimById(req: Request, res: Response, next: NextFunction) {
    try {
      const claimId = req.params.claimId as string;
      const claim = await claimService.getClaimById(claimId);

      res.status(200).json({
        success: true,
        data: { claim },
      });
    } catch (error) {
      next(error);
    }
  }

  async createClaimFromInvoice(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const invoiceId = req.params.invoiceId as string;
      const claimData = (req.body || {}) as { insuranceCompanyId?: string };
      const claim = await claimService.createClaimFromInvoice(invoiceId, claimData, req.userId);

      res.status(201).json({
        success: true,
        data: { claim },
        message: 'Claim created successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async updateClaim(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const claimId = req.params.claimId as string;
      const updates = req.body || {};
      const claim = await claimService.updateClaim(claimId, updates, req.userId);

      res.status(200).json({
        success: true,
        data: { claim },
        message: 'Claim updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async validateClaim(req: Request, res: Response, next: NextFunction) {
    try {
      const claimId = req.params.claimId as string;
      const result = await claimService.validateClaim(claimId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async submitClaim(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const claimId = req.params.claimId as string;
      const result = await claimService.submitClaim(claimId, req.userId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getClaimStatusHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const claimId = req.params.claimId as string;
      const result = await claimService.getClaimStatusHistory(claimId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async resubmitClaim(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const claimId = req.params.claimId as string;
      const corrections = req.body || {};
      const claim = await claimService.resubmitClaim(claimId, corrections, req.userId);

      res.status(200).json({
        success: true,
        data: { claim },
        message: 'Claim resubmitted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async getClaimDocuments(req: Request, res: Response, next: NextFunction) {
    try {
      const claimId = req.params.claimId as string;
      const result = await claimService.getClaimDocuments(claimId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async attachDocument(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const claimId = req.params.claimId as string;
      const result = await claimService.attachDocument(claimId, req.body || {}, req.file, req.userId!);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async removeClaimDocument(req: Request, res: Response, next: NextFunction) {
    try {
      const claimId = req.params.claimId as string;
      const documentId = req.params.documentId as string;
      const result = await claimService.removeClaimDocument(claimId, documentId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const claimController = new ClaimController();
