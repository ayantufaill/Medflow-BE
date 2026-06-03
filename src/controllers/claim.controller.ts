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

  async getTabSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const summary = await claimService.getTabSummary();
      res.status(200).json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }

  async getOutstandingClaims(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const result = await claimService.getOutstandingClaims(page, limit, {
        dateRange: req.query.dateRange as string | undefined,
        groupBy: req.query.groupBy as string | undefined,
        search: req.query.search as string | undefined,
      });
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getOutstandingClaimsForAllocation(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await claimService.getOutstandingClaims(1, 100, {
        search: req.query.search as string | undefined,
      });
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getPredeterminations(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const result = await claimService.getPredeterminations(page, limit, {
        patientId: req.query.patientId as string | undefined,
        search: req.query.search as string | undefined,
      });
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async batchSubmitClaims(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await claimService.batchSubmitClaims(
        req.body.claimIds,
        req.body.submissionType,
        req.userId
      );
      res.status(200).json({
        success: true,
        data: result,
        message: 'Claims processed in batch',
      });
    } catch (error) {
      next(error);
    }
  }

  async recordBatchPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await claimService.recordBatchPayment(req.body, req.userId);
      res.status(200).json({
        success: true,
        data: result,
        message: 'Batch payment recorded successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async getBatchPayments(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const result = await claimService.getBatchPayments(page, limit, {
        search: req.query.search as string | undefined,
      });
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async uploadEOB(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }
      const paymentId = req.params.paymentId as string;
      const uploadedFile =
        req.file ?? (Array.isArray(req.files) ? (req.files[0] as Express.Multer.File | undefined) : undefined);

      if (!uploadedFile) {
        return res.status(400).json({
          success: false,
          error: { message: 'No file uploaded' },
        });
      }

      const result = await claimService.uploadEOB(
        paymentId,
        uploadedFile,
        req.body.description,
        req.userId
      );

      res.status(200).json({
        success: true,
        data: result,
        message: 'EOB uploaded successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async getDenticalReports(req: Request, res: Response, next: NextFunction) {
    try {
      const reports = await claimService.getDenticalReports();
      res.status(200).json({
        success: true,
        data: reports,
      });
    } catch (error) {
      next(error);
    }
  }

  async getEraReports(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const eraTab = (req.query.eraTab as string) || 'active';
      const search = req.query.search as string | undefined;

      const result = await claimService.getEraReports(eraTab, search, page, limit);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getPendingProcedures(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await claimService.getPendingProcedures();
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async generateBatchInvoices(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await claimService.generateBatchInvoices(
        req.body.patientIds,
        req.body.deliveryPreference,
        req.userId
      );
      res.status(200).json({
        success: true,
        data: result,
        message: 'Invoices generated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async getClearinghouseStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const claimId = req.params.claimId as string;
      const result = await claimService.getClearinghouseStatus(claimId);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async quickStatusUpdate(req: Request, res: Response, next: NextFunction) {
    try {
      const claimId = req.params.claimId as string;
      const result = await claimService.quickStatusUpdate(
        claimId,
        req.body.status,
        req.body.note,
        req.userId
      );
      res.status(200).json({
        success: true,
        data: { claim: result },
        message: 'Status updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async uncompleteProcedures(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await claimService.uncompleteProcedures(req.body.procedureIds);
      res.status(200).json({
        success: true,
        data: result,
        message: 'Procedures un-completed successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const claimController = new ClaimController();
