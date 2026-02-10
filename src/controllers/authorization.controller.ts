import type { Request, Response, NextFunction } from 'express';
import { authorizationService } from '../services/authorization.service';

export class AuthorizationController {
  async getAllAuthorizations(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const filters: Parameters<typeof authorizationService.getAllAuthorizations>[2] = {};

      const patientId = req.query.patientId as string | undefined;
      const insuranceCompanyId = req.query.insuranceCompanyId as string | undefined;
      const status = req.query.status as string | undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const search = req.query.search as string | undefined;

      if (patientId) filters.patientId = patientId;
      if (insuranceCompanyId) filters.insuranceCompanyId = insuranceCompanyId;
      if (status) filters.status = status;
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;
      if (search) filters.search = search;

      const result = await authorizationService.getAllAuthorizations(page, limit, filters);

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
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const payload = { ...req.body } as Parameters<typeof authorizationService.requestAuthorization>[0];
      if (req.body.requestedDate) payload.requestedDate = new Date(req.body.requestedDate);
      if (req.body.expirationDate) payload.expirationDate = new Date(req.body.expirationDate);

      const authorization = await authorizationService.requestAuthorization(payload, req.userId);

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
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const authorizationId = req.params.authorizationId as string;
      const updates = req.body || {};
      if (updates.approvedDate) updates.approvedDate = new Date(updates.approvedDate);
      if (updates.expirationDate) updates.expirationDate = new Date(updates.expirationDate);

      const authorization = await authorizationService.updateAuthorization(
        authorizationId,
        updates,
        req.userId
      );

      res.status(200).json({
        success: true,
        data: { authorization },
        message: 'Authorization updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async getStatusHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const authorizationId = req.params.authorizationId as string;
      const result = await authorizationService.getStatusHistory(authorizationId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async printAuthorizationForm(req: Request, res: Response, next: NextFunction) {
    try {
      const authorizationId = req.params.authorizationId as string;
      const buffer = await authorizationService.printAuthorizationForm(authorizationId);

      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="authorization-${authorizationId}.txt"`);
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  }
}

export const authorizationController = new AuthorizationController();
