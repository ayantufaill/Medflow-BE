import type { Request, Response, NextFunction } from 'express';
import { membershipPlanService } from '../services/membership-plan.service';

export class MembershipPlanController {
  async getMembershipPlans(req: Request, res: Response, next: NextFunction) {
    try {
      const plans = await membershipPlanService.getMembershipPlans();
      res.status(200).json({
        success: true,
        data: plans,
      });
    } catch (error) {
      next(error);
    }
  }

  async createMembershipPlan(req: Request, res: Response, next: NextFunction) {
    try {
      const plan = await membershipPlanService.createMembershipPlan(req.body);
      res.status(201).json({
        success: true,
        data: plan,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateMembershipPlan(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const plan = await membershipPlanService.updateMembershipPlan(id, req.body);
      res.status(200).json({
        success: true,
        data: plan,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteMembershipPlan(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await membershipPlanService.deleteMembershipPlan(id);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const membershipPlanController = new MembershipPlanController();
