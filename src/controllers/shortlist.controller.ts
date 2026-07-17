import { Request, Response, NextFunction } from 'express';
import { shortlistService } from '../services/shortlist.service';

export class ShortlistController {
  
  getShortlistItems = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const items = await shortlistService.getShortlistItems();
      res.json({ status: 'success', data: items });
    } catch (error) {
      next(error);
    }
  };

  createShortlistItem = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const item = await shortlistService.createShortlistItem(req.body);
      res.status(201).json({ status: 'success', data: item });
    } catch (error) {
      next(error);
    }
  };

  updateShortlistItem = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const item = await shortlistService.updateShortlistItem(id, req.body);
      res.json({ status: 'success', data: item });
    } catch (error) {
      next(error);
    }
  };

  deleteShortlistItem = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      await shortlistService.deleteShortlistItem(id);
      res.json({ status: 'success', message: 'Shortlist item deleted' });
    } catch (error) {
      next(error);
    }
  };
}

export const shortlistController = new ShortlistController();
