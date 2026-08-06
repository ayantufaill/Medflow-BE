import type { Request, Response, NextFunction } from 'express';
import { practiceGroupService } from '../services/practice-group.service';

export class PracticeGroupController {
  async createGroup(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, config } = req.body;
      const data = await practiceGroupService.createGroup({ name, config });
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getAllGroups(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await practiceGroupService.getAllGroups();
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getGroupById(req: Request, res: Response, next: NextFunction) {
    try {
      const groupId = parseInt(req.params.groupId, 10);
      const data = await practiceGroupService.getGroupById(groupId);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async createBranch(req: Request, res: Response, next: NextFunction) {
    try {
      const groupId = parseInt(req.params.groupId, 10);
      const { name, address, city, state, zip, phone } = req.body;
      const data = await practiceGroupService.createBranch(groupId, { name, address, city, state, zip, phone });
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async createGroupAdmin(req: Request, res: Response, next: NextFunction) {
    try {
      const groupId = parseInt(req.params.groupId, 10);
      const { email, firstName, lastName, clinicId } = req.body;
      const data = await practiceGroupService.createGroupAdmin(
        groupId,
        { email, firstName, lastName, clinicId },
        req.userId!
      );
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

export const practiceGroupController = new PracticeGroupController();
