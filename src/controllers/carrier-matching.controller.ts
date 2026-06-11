import type { Request, Response, NextFunction } from 'express';
import { carrierMatchingService } from '../services/carrier-matching.service';

export class CarrierMatchingController {
  // --- Converted Carriers ---

  async getConvertedOldPayers(req: Request, res: Response, next: NextFunction) {
    try {
      const payers = await carrierMatchingService.getConvertedOldPayers();
      res.status(200).json({ success: true, data: payers });
    } catch (error) {
      next(error);
    }
  }

  async getConvertedOryxPayers(req: Request, res: Response, next: NextFunction) {
    try {
      const payers = await carrierMatchingService.getConvertedOryxPayers();
      res.status(200).json({ success: true, data: payers });
    } catch (error) {
      next(error);
    }
  }

  async getConvertedMatchedPayers(req: Request, res: Response, next: NextFunction) {
    try {
      const matched = await carrierMatchingService.getConvertedMatchedPayers();
      res.status(200).json({ success: true, data: matched });
    } catch (error) {
      next(error);
    }
  }

  async matchConvertedCarrier(req: Request, res: Response, next: NextFunction) {
    try {
      const { oldPayerId, oryxPayerId } = req.body;
      const user = req.userId || 'Admin';
      const result = await carrierMatchingService.matchConvertedCarrier(oldPayerId, oryxPayerId, user);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async deleteConvertedMatch(req: Request, res: Response, next: NextFunction) {
    try {
      const { oldPayerId } = req.params;
      const result = await carrierMatchingService.deleteConvertedMatch(oldPayerId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async fetchMatches(req: Request, res: Response, next: NextFunction) {
    try {
      // Stub for triggering background matches/analysis
      res.status(200).json({ success: true, message: 'Matching process triggered successfully' });
    } catch (error) {
      next(error);
    }
  }

  // --- Vyne Carriers ---

  async getVyneOfficePayers(req: Request, res: Response, next: NextFunction) {
    try {
      const payers = await carrierMatchingService.getVyneOfficePayers();
      res.status(200).json({ success: true, data: payers });
    } catch (error) {
      next(error);
    }
  }

  async getVynePayers(req: Request, res: Response, next: NextFunction) {
    try {
      const payers = await carrierMatchingService.getVynePayers();
      res.status(200).json({ success: true, data: payers });
    } catch (error) {
      next(error);
    }
  }

  async getVyneMatchedPayers(req: Request, res: Response, next: NextFunction) {
    try {
      const matched = await carrierMatchingService.getVyneMatchedPayers();
      res.status(200).json({ success: true, data: matched });
    } catch (error) {
      next(error);
    }
  }

  async matchVyneCarrier(req: Request, res: Response, next: NextFunction) {
    try {
      const { officePayerId, vynePayerId, vyneMasterId } = req.body;
      const result = await carrierMatchingService.matchVyneCarrier(officePayerId, vynePayerId, vyneMasterId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async deleteVyneMatch(req: Request, res: Response, next: NextFunction) {
    try {
      const { officePayerId } = req.params;
      const result = await carrierMatchingService.deleteVyneMatch(officePayerId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

export const carrierMatchingController = new CarrierMatchingController();
