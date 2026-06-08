import type { Request, Response, NextFunction } from 'express';
import { providerService } from '../services/provider.service';
import { logActivityFromRequest } from '../utils/activity-logger.util';

export class ProviderController {
  async getAllProviders(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = req.query.search as string | undefined;
      const isActive = req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;
      const specialty = req.query.specialty as string | undefined;

      const result = await providerService.getAllProviders(page, limit, search, isActive, specialty);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getSpecialties(req: Request, res: Response, next: NextFunction) {
    try {
      const specialties = await providerService.getSpecialties();

      res.status(200).json({
        success: true,
        data: { specialties },
      });
    } catch (error) {
      next(error);
    }
  }

  async getProviderById(req: Request, res: Response, next: NextFunction) {
    try {
      const { providerId } = req.params;
      
      if (!providerId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Provider ID is required' },
        });
      }

      const provider = await providerService.getProviderById(providerId);

      if (req.userId) {
        await logActivityFromRequest(req, 'viewed', 'providers', providerId);
      }

      res.status(200).json({
        success: true,
        data: { provider },
      });
    } catch (error) {
      next(error);
    }
  }

  async createProvider(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const {
        userId,
        npiNumber,
        licenseNumber,
        specialty,
        title,
        appointmentBufferMinutes,
        maxDailyAppointments,
        consultationFee,
        isAcceptingNewPatients,
        workingHours,
        telehealthEnabled,
      } = req.body;

      const provider = await providerService.createProvider(
        {
          userId,
          npiNumber,
          licenseNumber,
          specialty,
          title,
          appointmentBufferMinutes,
          maxDailyAppointments,
          consultationFee,
          isAcceptingNewPatients,
          workingHours,
          telehealthEnabled,
        },
        req.userId
      );

      res.status(201).json({
        success: true,
        data: { provider },
        message: 'Provider created successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async updateProvider(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const { providerId } = req.params;
      
      if (!providerId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Provider ID is required' },
        });
      }
      
      const updates = req.body;

      const provider = await providerService.updateProvider(providerId, updates, req.userId);

      res.status(200).json({
        success: true,
        data: { provider },
        message: 'Provider updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async activateProvider(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const { providerId } = req.params;
      
      if (!providerId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Provider ID is required' },
        });
      }

      const provider = await providerService.activateProvider(providerId, req.userId);

      res.status(200).json({
        success: true,
        data: { provider },
        message: 'Provider activated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async deactivateProvider(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const { providerId } = req.params;
      
      if (!providerId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Provider ID is required' },
        });
      }

      const provider = await providerService.deactivateProvider(providerId, req.userId);

      res.status(200).json({
        success: true,
        data: { provider },
        message: 'Provider deactivated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async getProviderAvailability(req: Request, res: Response, next: NextFunction) {
    try {
      const { providerId } = req.params;
      const { date, weekOf, durationMinutes } = req.query;

      if (!providerId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Provider ID is required' },
        });
      }

      const duration = durationMinutes ? parseInt(durationMinutes as string, 10) : 30;

      const availability = await providerService.getProviderAvailability(providerId, {
        date: date as string,
        weekOf: weekOf as string,
        durationMinutes: duration,
      });

      res.status(200).json({
        success: true,
        data: availability,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteProvider(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const { providerId } = req.params;
      
      if (!providerId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Provider ID is required' },
        });
      }

      const result = await providerService.deleteProvider(providerId, req.userId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const providerController = new ProviderController();
