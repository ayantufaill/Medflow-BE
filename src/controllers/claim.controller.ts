import type { Request, Response, NextFunction } from 'express';
import { claimService } from '../services/claim.service';

export class ClaimController {
  async getAllClaims(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      const deniedOnlyQuery = req.query.deniedOnly;
      const deniedOnly =
        deniedOnlyQuery === 'true' ||
        deniedOnlyQuery === '1';

      const result = await claimService.getAllClaims(page, limit, {
        search: req.query.search as string | undefined,
        status: req.query.status as string | undefined,
        patientId: req.query.patientId as string | undefined,
        invoiceId: req.query.invoiceId as string | undefined,
        insuranceCompanyId: req.query.insuranceCompanyId as string | undefined,
        insuranceType: req.query.insuranceType as string | undefined,
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
        deniedOnly,
      });

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
      const invoiceId = req.params.invoiceId as string;
      const claim = await claimService.createClaimFromInvoice(
        invoiceId,
        {
          insuranceCompanyId: req.body.insuranceCompanyId,
          insuranceType: req.body.insuranceType,
          claimAmount: req.body.claimAmount,
          submittedAmount: req.body.submittedAmount,
          policyNumber: req.body.policyNumber,
          notes: req.body.notes,
        },
        req.userId
      );

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
      const claimId = req.params.claimId as string;
      const claim = await claimService.updateClaim(
        claimId,
        {
          insuranceCompanyId: req.body.insuranceCompanyId,
          invoiceId: req.body.invoiceId,
          insuranceType: req.body.insuranceType,
          status: req.body.status,
          claimAmount: req.body.claimAmount,
          submittedAmount: req.body.submittedAmount,
          totalAmount: req.body.totalAmount,
          paidAmount: req.body.paidAmount,
          patientResponsibility: req.body.patientResponsibility,
          policyNumber: req.body.policyNumber,
          notes: req.body.notes,
          submissionDate: req.body.submissionDate ? new Date(req.body.submissionDate) : undefined,
          deniedDate:
            req.body.deniedDate === null
              ? null
              : req.body.deniedDate
                ? new Date(req.body.deniedDate)
                : undefined,
          denialReason: req.body.denialReason,
          paidDate: req.body.paidDate ? new Date(req.body.paidDate) : undefined,
          corrections: req.body.corrections,
        },
        req.userId
      );

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
      const claimId = req.params.claimId as string;
      const result = await claimService.submitClaim(claimId, req.userId);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Claim submitted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async getClaimStatusHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const claimId = req.params.claimId as string;
      const statusHistory = await claimService.getClaimStatusHistory(claimId);

      res.status(200).json({
        success: true,
        data: { statusHistory },
      });
    } catch (error) {
      next(error);
    }
  }

  async resubmitClaim(req: Request, res: Response, next: NextFunction) {
    try {
      const claimId = req.params.claimId as string;
      const claim = await claimService.resubmitClaim(
        claimId,
        {
          workflowType: req.body.workflowType,
          correctionNotes: req.body.correctionNotes,
          appealReason: req.body.appealReason,
          correctedFields: req.body.correctedFields,
        },
        req.userId
      );

      res.status(200).json({
        success: true,
        data: { claim },
        message: 'Claim resubmitted successfully',
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
      const uploadedFile =
        req.file ?? (Array.isArray(req.files) ? (req.files[0] as Express.Multer.File | undefined) : undefined);

      if (!uploadedFile) {
        return res.status(400).json({
          success: false,
          error: { message: 'No file uploaded' },
        });
      }

      const document = await claimService.attachDocument(
        claimId,
        uploadedFile,
        {
          documentName: req.body.documentName,
          documentType: req.body.documentType,
          description: req.body.description,
        },
        req.userId
      );

      res.status(201).json({
        success: true,
        data: { document },
        message: 'Document attached successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async getClaimDocuments(req: Request, res: Response, next: NextFunction) {
    try {
      const claimId = req.params.claimId as string;
      const documents = await claimService.getClaimDocuments(claimId);

      res.status(200).json({
        success: true,
        data: { documents },
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
