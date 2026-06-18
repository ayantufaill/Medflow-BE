import type { Request, Response, NextFunction } from 'express';
import { invoiceService } from '../services/invoice.service';
import { logActivityFromRequest } from '../utils/activity-logger.util';

export class InvoiceController {
  async getAllInvoices(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const filters: {
        patientId?: string;
        appointmentId?: string;
        providerId?: string;
        insuranceCompanyId?: string;
        status?: string;
        startDate?: string;
        endDate?: string;
        search?: string;
      } = {};

      const patientId = req.query.patientId as string | undefined;
      const appointmentId = req.query.appointmentId as string | undefined;
      const providerId = req.query.providerId as string | undefined;
      const insuranceCompanyId = req.query.insuranceCompanyId as string | undefined;
      const status = req.query.status as string | undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const search = req.query.search as string | undefined;

      if (patientId) filters.patientId = patientId;
      if (appointmentId) filters.appointmentId = appointmentId;
      if (providerId) filters.providerId = providerId;
      if (insuranceCompanyId) filters.insuranceCompanyId = insuranceCompanyId;
      if (status) filters.status = status;
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;
      if (search) filters.search = search;

      const result = await invoiceService.getAllInvoices(page, limit, filters);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getInvoiceById(req: Request, res: Response, next: NextFunction) {
    try {
      const invoiceId = req.params.invoiceId as string;
      const result = await invoiceService.getInvoiceById(invoiceId);

      if (req.userId) {
        await logActivityFromRequest(req, 'viewed', 'invoices', invoiceId);
      }

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async createInvoiceFromAppointment(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const appointmentId = req.params.appointmentId as string;
      const dueDate = req.body.dueDate
        ? new Date(req.body.dueDate)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const invoice = await invoiceService.createInvoiceFromAppointment(
        appointmentId,
        {
          dueDate,
          insuranceCompanyId: req.body.insuranceCompanyId,
          providerId: req.body.providerId,
          notes: req.body.notes,
          copayAmount: req.body.copayAmount,
        },
        req.userId
      );

      res.status(201).json({
        success: true,
        data: { invoice },
        message: 'Invoice created successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async addInvoiceItem(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const invoiceId = req.params.invoiceId as string;
      const item = await invoiceService.addInvoiceItem(invoiceId, req.body, req.userId);

      res.status(201).json({
        success: true,
        data: { item },
        message: 'Invoice item added successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async updateInvoiceItem(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const invoiceId = req.params.invoiceId as string;
      const itemId = req.params.itemId as string;
      const item = await invoiceService.updateInvoiceItem(invoiceId, itemId, req.body, req.userId);

      res.status(200).json({
        success: true,
        data: { item },
        message: 'Invoice item updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteInvoiceItem(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const invoiceId = req.params.invoiceId as string;
      const itemId = req.params.itemId as string;
      const result = await invoiceService.deleteInvoiceItem(invoiceId, itemId, req.userId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteInvoice(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const invoiceId = req.params.invoiceId as string;
      const result = await invoiceService.deleteInvoice(invoiceId, req.userId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async recalculateInvoice(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const invoiceId = req.params.invoiceId as string;
      const invoice = await invoiceService.recalculateInvoice(
        invoiceId,
        req.body.insuranceCoveragePercent
      );

      res.status(200).json({
        success: true,
        data: { invoice },
      });
    } catch (error) {
      next(error);
    }
  }

  async updateInvoice(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const invoiceId = req.params.invoiceId as string;
      const updates = { ...req.body } as Parameters<typeof invoiceService.updateInvoice>[1];
      if (req.body.dueDate) {
        updates.dueDate = new Date(req.body.dueDate);
      } else {
        delete updates.dueDate;
      }

      const invoice = await invoiceService.updateInvoice(
        invoiceId,
        updates,
        req.userId
      );

      res.status(200).json({
        success: true,
        data: { invoice },
        message: 'Invoice updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async getInvoicesByPatient(req: Request, res: Response, next: NextFunction) {
    try {
      const patientId = req.params.patientId as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const result = await invoiceService.getInvoicesByPatient(patientId, page, limit);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getPatientBalance(req: Request, res: Response, next: NextFunction) {
    try {
      const patientId = req.params.patientId as string;
      const result = await invoiceService.getPatientBalance(patientId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async finalizeInvoice(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const invoiceId = req.params.invoiceId as string;
      const invoice = await invoiceService.finalizeInvoice(invoiceId, req.userId);

      res.status(200).json({
        success: true,
        data: { invoice },
        message: 'Invoice finalized successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async voidInvoice(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const invoiceId = req.params.invoiceId as string;
      const reason = req.body.reason as string | undefined;
      const invoice = await invoiceService.voidInvoice(invoiceId, reason, req.userId);

      res.status(200).json({
        success: true,
        data: { invoice },
        message: 'Invoice voided successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async createStandaloneInvoice(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const invoice = await invoiceService.createStandaloneInvoice(req.body, req.userId);

      res.status(201).json({
        success: true,
        data: { invoice },
        message: 'Standalone invoice created successfully',
      });
    } catch (error) {
      next(error);
    }
  }
  async markItemPaid(req: Request, res: Response, next: NextFunction) {
  try {
    const { invoiceId, itemId } = req.params;
    const { amount } = req.body;
    
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ 
        success: false, 
        error: { message: 'amount must be > 0' } 
      });
    }
    
    await invoiceService.markItemPaid(invoiceId, itemId, Number(amount));
    res.json({ 
      success: true, 
      message: 'Item payment recorded' 
    });
  } catch (error) {
    next(error);
  }
}
}

export const invoiceController = new InvoiceController();
