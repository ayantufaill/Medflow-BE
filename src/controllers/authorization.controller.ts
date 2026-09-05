import type { Request, Response, NextFunction } from 'express';
import { authorizationService } from '../services/authorization.service';

export class AuthorizationController {
  async getAllAuthorizations(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      const result = await authorizationService.getAllAuthorizations(page, limit, {
        search: req.query.search as string | undefined,
        status: req.query.status as string | undefined,
        patientId: req.query.patientId as string | undefined,
        insuranceCompanyId: req.query.insuranceCompanyId as string | undefined,
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getAuthorizationById(req: Request, res: Response, next: NextFunction) {
    try {
      const authorizationId = req.params.authorizationId as string;
      const authorization = await authorizationService.getAuthorizationById(authorizationId);

      res.status(200).json({
        success: true,
        data: { authorization },
      });
    } catch (error) {
      next(error);
    }
  }

  async requestAuthorization(req: Request, res: Response, next: NextFunction) {
    try {
      const rawProcedures = req.body.procedureIds || req.body.procedures;
      const normalizedProcedures = Array.isArray(rawProcedures)
        ? rawProcedures.map((id: any) => String(id))
        : undefined;
      const normalizedServiceId =
        req.body.serviceId !== undefined && req.body.serviceId !== null
          ? String(req.body.serviceId)
          : undefined;

      const authorization = await authorizationService.createAuthorization({
        patientId: String(req.body.patientId),
        insuranceCompanyId: req.body.insuranceCompanyId ? String(req.body.insuranceCompanyId) : undefined,
        serviceId: normalizedServiceId,
        authorizationNumber: req.body.authorizationNumber,
        requestedDate: req.body.requestedDate ? new Date(req.body.requestedDate) : undefined,
        approvedDate: req.body.approvedDate ? new Date(req.body.approvedDate) : undefined,
        expirationDate: req.body.expirationDate ? new Date(req.body.expirationDate) : undefined,
        status: req.body.status,
        unitsAuthorized: req.body.unitsAuthorized,
        unitsUsed: req.body.unitsUsed,
        notes: req.body.notes,
        requestedBy: req.userId,
        tags: Array.isArray(req.body.tags) ? req.body.tags.map(String) : undefined,
        procedures: normalizedProcedures,
        procedureIds: normalizedProcedures,
        order: req.body.order,
      });

      res.status(201).json({
        success: true,
        data: { authorization },
        message: 'Authorization requested successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async updateAuthorization(req: Request, res: Response, next: NextFunction) {
    try {
      const authorizationId = req.params.authorizationId as string;
      const rawProcedures = req.body.procedureIds || req.body.procedures;
      const normalizedProcedures = Array.isArray(rawProcedures)
        ? rawProcedures.map((id: any) => String(id))
        : undefined;
      const normalizedServiceId =
        req.body.serviceId !== undefined && req.body.serviceId !== null
          ? String(req.body.serviceId)
          : undefined;

      const authorization = await authorizationService.updateAuthorization(authorizationId, {
        approvedDate: req.body.approvedDate ? new Date(req.body.approvedDate) : undefined,
        expirationDate: req.body.expirationDate ? new Date(req.body.expirationDate) : undefined,
        status: req.body.status,
        unitsAuthorized: req.body.unitsAuthorized,
        unitsUsed: req.body.unitsUsed,
        notes: req.body.notes,
        insuranceCompanyId: req.body.insuranceCompanyId ? String(req.body.insuranceCompanyId) : undefined,
        serviceId: normalizedServiceId,
        requestedBy: req.userId,
        tags: Array.isArray(req.body.tags) ? req.body.tags.map(String) : undefined,
        procedures: normalizedProcedures,
        procedureIds: normalizedProcedures,
        order: req.body.order,
      });

      res.status(200).json({
        success: true,
        data: { authorization },
        message: 'Authorization updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async getAuthorizationStatusHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const authorizationId = req.params.authorizationId as string;
      const statusHistory = await authorizationService.getAuthorizationStatusHistory(authorizationId);

      res.status(200).json({
        success: true,
        data: { statusHistory },
      });
    } catch (error) {
      next(error);
    }
  }

  async printAuthorizationForm(req: Request, res: Response, next: NextFunction) {
    try {
      const authorizationId = req.params.authorizationId as string;
      const pdfBuffer = await authorizationService.getPrintableAuthorizationForm(authorizationId);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="authorization-${authorizationId}.pdf"`);
      res.status(200).send(pdfBuffer);
    } catch (error) {
      next(error);
    }
  }
}

export const authorizationController = new AuthorizationController();
