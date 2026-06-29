import { Request, Response, NextFunction } from 'express';
import { rxService } from '../services/rx.service';

export class RxController {
  getPrescriptions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 25;
      const patientId = req.query.patientId as string | undefined;

      const result = await rxService.getPrescriptions(patientId, page, limit);

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  };

  createPrescription = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await rxService.createPrescription(req.body);

      res.status(201).json({
        success: true,
        data: { prescription: result },
        message: 'Prescription created successfully'
      });
    } catch (error) {
      next(error);
    }
  };
  printPrescription = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await rxService.getPrescriptionPrintData(id);

    res.status(200).json({
      success: true,
      data: { prescription: result }
    });
  } catch (error) {
    next(error);
  }
};
}

export const rxController = new RxController();
