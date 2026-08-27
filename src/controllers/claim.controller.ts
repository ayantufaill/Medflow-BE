import type { Request, Response, NextFunction } from 'express';
import { claimService } from '../services/claim.service';

const extractId = (value: unknown): string | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const id = obj._id ?? obj.id;
    if (typeof id === 'string') {
      return id;
    }
    if (typeof id === 'number') {
      return String(id);
    }
    if (id && typeof (id as any).toString === 'function') {
      const str = (id as any).toString();
      if (str && str !== '[object Object]') {
        return str;
      }
    }
  }
  return undefined;
};

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
        carrierName: req.query.carrierName as string | undefined,
        hasAttachment: req.query.hasAttachment as string | undefined,
        claimFormat: req.query.claimFormat as string | undefined,
        showHidden: req.query.showHidden as string | undefined,
        patientName: req.query.patientName as string | undefined,
        tab: req.query.tab as string | undefined,
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
      const insuranceCompanyId = extractId(req.body.insuranceCompanyId);
      const invoiceId = extractId(req.body.invoiceId);

      const claim = await claimService.updateClaim(
        claimId,
        {
          insuranceCompanyId,
          invoiceId,
          insuranceType: req.body.insuranceType,
          claimFormat: req.body.claimFormat,
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
          corrections: req.body.corrections,
          providerSignature: req.body.providerSignature,
          patientSignature: req.body.patientSignature,
          delayReasonCode: req.body.delayReasonCode,
          attachmentTransmissionCode: req.body.attachmentTransmissionCode,
          attachmentType: req.body.attachmentType,
          predeterminationNumber: req.body.predeterminationNumber,
          accidentDate: req.body.accidentDate,
          diagnosticCode: req.body.diagnosticCode,
          clearingHouseMessage: req.body.clearingHouseMessage,
          subscriber: req.body.subscriber,
          planName: req.body.planName,
          treatingProviderName: req.body.treatingProvider || req.body.treatingProviderName,
          description: req.body.description,
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

      const filename = req.body.filename || req.body.fileName;
      const remittanceDate = req.body.remittanceDate || req.body.remittance_date;

      const result = await claimService.uploadEOB(
        paymentId,
        uploadedFile,
        req.body.description,
        req.userId,
        filename,
        remittanceDate
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

  async deleteEOB(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }
      const paymentId = req.params.paymentId as string;
      const eobId = req.params.eobId as string;

      const result = await claimService.deleteEOB(paymentId, eobId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async uploadClaimEOB(req: Request, res: Response, next: NextFunction) {
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

      const claimFilename = req.body.filename || req.body.fileName;
      const claimRemittanceDate = req.body.remittanceDate || req.body.remittance_date;

      const result = await claimService.uploadClaimEOB(
        claimId,
        uploadedFile,
        req.body.description,
        req.userId,
        claimFilename,
        claimRemittanceDate
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

  async deleteClaimEOB(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }
      const claimId = req.params.claimId as string;
      const eobId = req.params.eobId as string;

      const result = await claimService.deleteClaimEOB(claimId, eobId);

      res.status(200).json({
        success: true,
        data: result,
        message: 'EOB deleted successfully',
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
  async createManualClaim(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { message: 'User not authenticated' },
      });
    }

    const result = await claimService.createManualClaim(req.body, userId);
    res.status(201).json({
      success: true,
      message: 'Manual claim created successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

  async getClaimPdf(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { claimId } = req.params;
      const pdfBuffer = await claimService.generateAdaClaimPdf(claimId);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="claim_${claimId}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      next(error);
    }
  }

  async uploadAttachments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
        return;
      }

      const claimId = req.params.claimId as string;
      const files = req.files as Express.Multer.File[] | undefined;

      if (!files || files.length === 0) {
        res.status(400).json({
          success: false,
          error: { message: 'No files uploaded' },
        });
        return;
      }

      const attachments = await claimService.uploadAttachments(claimId, files, req.userId);

      res.status(201).json({
        success: true,
        data: { attachments },
        message: 'Attachments uploaded successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}


export const claimController = new ClaimController();
