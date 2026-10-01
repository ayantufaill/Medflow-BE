import type { Request, Response, NextFunction } from 'express';
import { sharingService } from '../services/sharing.service';
import { logActivityFromRequest } from '../utils/activity-logger.util';

export class SharingController {
  async getPolicy(req: Request, res: Response, next: NextFunction) {
    try {
      const groupId = req.access?.groupId || req.branchAccess?.groupId;
      if (!groupId) {
        return res.status(400).json({ success: false, error: { message: 'No practice group context.' } });
      }

      const policy = await sharingService.getSharingPolicy(groupId);
      res.status(200).json({ success: true, data: { policy } });
    } catch (error) {
      next(error);
    }
  }

  async updatePolicy(req: Request, res: Response, next: NextFunction) {
    try {
      const groupId = req.access?.groupId || req.branchAccess?.groupId;
      if (!groupId) {
        return res.status(400).json({ success: false, error: { message: 'No practice group context.' } });
      }

      const { category, mode } = req.body;
      if (!category || !mode) {
        return res.status(400).json({ success: false, error: { message: 'Category and mode are required.' } });
      }

      await sharingService.updateSharingPolicy(groupId, category, mode, req.userId!);
      await logActivityFromRequest(req, 'updated', 'group_sharing_policy', null, null, { category, mode });

      res.status(200).json({ success: true, data: { message: 'Policy updated successfully' } });
    } catch (error) {
      next(error);
    }
  }
}

export const sharingController = new SharingController();

