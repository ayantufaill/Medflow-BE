import { Request, Response, NextFunction } from 'express';
import { treatmentPlanService } from '../services/treatment-plan.service';

export class TreatmentPlanController {
  getAllTreatmentPlans = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
      const patientId = req.query.patientId as string | undefined;

      const result = await treatmentPlanService.getAllTreatmentPlans(page, limit, patientId);
      
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  };

  getTreatmentPlanById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const planId = req.params.id;
      const plan = await treatmentPlanService.getTreatmentPlanById(planId);
      
      res.status(200).json({
        success: true,
        data: { treatmentPlan: plan }
      });
    } catch (error) {
      next(error);
    }
  };

  createTreatmentPlan = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { patientId, title, notes, status, totalAmount, items } = req.body;
      
      const plan = await treatmentPlanService.createTreatmentPlan({
        patientId,
        title,
        notes,
        status,
        totalAmount,
        items
      });
      
      res.status(201).json({
        success: true,
        data: { treatmentPlan: plan },
        message: 'Treatment plan created successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  updateTreatmentPlan = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const planId = req.params.id;
      const { title, notes, status, totalAmount, items } = req.body;
      
      const plan = await treatmentPlanService.updateTreatmentPlan(planId, {
        title,
        notes,
        status,
        totalAmount,
        items
      });
      
      res.status(200).json({
        success: true,
        data: { treatmentPlan: plan },
        message: 'Treatment plan updated successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  deleteTreatmentPlan = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const planId = req.params.id;
      const result = await treatmentPlanService.deleteTreatmentPlan(planId);
      
      res.status(200).json({
        success: true,
        message: result.message
      });
    } catch (error) {
      next(error);
    }
  };

  reorderTreatmentPlanItems = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const planId = req.params.id;
      const { items } = req.body;
      const plan = await treatmentPlanService.reorderTreatmentPlanItems(planId, items);
      
      res.status(200).json({
        success: true,
        data: { treatmentPlan: plan },
        message: 'Treatment plan items reordered successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  printTreatmentPlan = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const planId = req.params.id;
      const printDetails = await treatmentPlanService.getTreatmentPlanPrintDetails(planId);
      
      res.status(200).json({
        success: true,
        data: printDetails
      });
    } catch (error) {
      next(error);
    }
  };

  generateClaim = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const planId = req.params.id;
      // Get the userId from the authenticated user if available
      const userId = (req as any).user?._id; 
      
      const claim = await treatmentPlanService.generateClaimFromTreatmentPlan(planId, userId);
      
      res.status(201).json({
        success: true,
        data: claim,
        message: 'Claim generated successfully'
      });
    } catch (error) {
      next(error);
    }
  };
}

export const treatmentPlanController = new TreatmentPlanController();
