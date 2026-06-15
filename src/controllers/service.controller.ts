import type { Request, Response, NextFunction } from 'express';
import { serviceService } from '../services/service.service';
import { logActivityFromRequest } from '../utils/activity-logger.util';

export class ServiceController {
  async getAllServices(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = req.query.search as string | undefined;
      const category = req.query.category as string | undefined;
      const isActive =
        req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;
      const isBillable =
        req.query.isBillable !== undefined ? req.query.isBillable === 'true' : undefined;

      const filters: {
        search?: string;
        category?: string;
        isActive?: boolean;
        isBillable?: boolean;
      } = {};
      
      if (search) filters.search = search;
      if (category) filters.category = category;
      if (isActive !== undefined) filters.isActive = isActive;
      if (isBillable !== undefined) filters.isBillable = isBillable;

      const result = await serviceService.getAllServices(page, limit, filters);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getServiceById(req: Request, res: Response, next: NextFunction) {
    try {
      const { serviceId } = req.params;
      
      if (!serviceId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Service ID is required' },
        });
      }
      
      const service = await serviceService.getServiceById(serviceId);

      if (req.userId) {
        await logActivityFromRequest(req, 'viewed', 'services', serviceId);
      }

      res.status(200).json({
        success: true,
        data: { service },
      });
    } catch (error) {
      next(error);
    }
  }

  async createService(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const service = await serviceService.createService(req.body, req.userId);

      res.status(201).json({
        success: true,
        data: { service },
        message: 'Service created successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async updateService(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const { serviceId } = req.params;
      
      if (!serviceId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Service ID is required' },
        });
      }
      
      const service = await serviceService.updateService(serviceId, req.body, req.userId);

      res.status(200).json({
        success: true,
        data: { service },
        message: 'Service updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteService(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const { serviceId } = req.params;
      
      if (!serviceId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Service ID is required' },
        });
      }
      
      const result = await serviceService.deleteService(serviceId, req.userId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async activateService(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const { serviceId } = req.params;
      if (!serviceId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Service ID is required' },
        });
      }

      const service = await serviceService.activateService(serviceId, req.userId);

      res.status(200).json({
        success: true,
        data: { service },
        message: 'Service activated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async deactivateService(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const { serviceId } = req.params;
      if (!serviceId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Service ID is required' },
        });
      }

      const service = await serviceService.deactivateService(serviceId, req.userId);

      res.status(200).json({
        success: true,
        data: { service },
        message: 'Service deactivated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async getCategories(req: Request, res: Response, next: NextFunction) {
    try {
      const categories = await serviceService.getCategories();

      res.status(200).json({
        success: true,
        data: { categories },
      });
    } catch (error) {
      next(error);
    }
  }

  async toggleServiceStatus(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const { serviceId } = req.params;
      if (!serviceId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Service ID is required' },
        });
      }

      const service = await serviceService.getServiceById(serviceId);
      const nextActive = !service.isActive;

      const updatedService = await serviceService.updateService(
        serviceId,
        { isActive: nextActive },
        req.userId
      );

      res.status(200).json({
        success: true,
        data: { service: updatedService },
        message: `Service status toggled to ${nextActive ? 'active' : 'inactive'}`,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const serviceController = new ServiceController();
