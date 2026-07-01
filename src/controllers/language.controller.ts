import { Request, Response, NextFunction } from 'express';
import { languageService } from '../services/language.service';

export class LanguageController {
  async getAllLanguages(req: Request, res: Response, next: NextFunction) {
    try {
      const { isActive } = req.query;
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;
      
      let activeFilter: boolean | undefined;
      if (isActive === 'true') {
        activeFilter = true;
      } else if (isActive === 'false') {
        activeFilter = false;
      }

      const languages = await languageService.getAllLanguages(search, activeFilter);

      return res.status(200).json({ success: true, data: languages, message: 'Languages retrieved successfully' });
    } catch (error) {
      next(error);
    }
  }
}

export const languageController = new LanguageController();
