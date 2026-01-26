import type { Request, Response, NextFunction } from 'express';
import { practiceInfoService } from '../services/practice-info.service';
import { uploadToS3, deleteFromS3, isValidFileSize } from '../utils/s3.util';

export class PracticeInfoController {
  /**
   * Get all practice info records
   */
  async getAllPracticeInfo(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = req.query.search as string | undefined;

      const result = await practiceInfoService.getAllPracticeInfo(page, limit, search);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get single practice info (most recent)
   */
  async getPracticeInfo(req: Request, res: Response, next: NextFunction) {
    try {
      const practiceInfo = await practiceInfoService.getPracticeInfo();
      res.status(200).json({
        success: true,
        data: { practiceInfo },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get practice info by ID
   */
  async getPracticeInfoById(req: Request, res: Response, next: NextFunction) {
    try {
      const { practiceInfoId } = req.params;
      
      if (!practiceInfoId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Practice info ID is required' },
        });
      }
      
      const practiceInfo = await practiceInfoService.getPracticeInfoById(practiceInfoId);
      res.status(200).json({
        success: true,
        data: { practiceInfo },
      });
    } catch (error) {
      next(error);
    }
  }


  /**
   * Create a new practice info
   */
  async createPracticeInfo(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      // FormData is already parsed by validateFormData middleware

      // Handle logo upload to S3
      let logoUrl: string | undefined;
      if (req.file) {
        // Validate file size
        if (!isValidFileSize(req.file.size)) {
          return res.status(400).json({
            success: false,
            error: {
              message: 'Logo file size must be less than 5MB',
              errors: {
                logo: ['Logo file size must be less than 5MB'],
              },
            },
          });
        }

        try {
          logoUrl = await uploadToS3(req.file, 'practice-logos');
        } catch (uploadError: any) {
          console.error('Logo upload error:', uploadError);
          // Return the actual error message for better debugging
          const errorMessage = uploadError?.message || 'Failed to upload logo to S3';
          return res.status(500).json({
            success: false,
            error: { message: errorMessage },
          });
        }
      }

      // Prepare data with logo URL
      const practiceData = {
        ...req.body,
        logoPath: logoUrl || req.body.logoPath,
      };

      const result = await practiceInfoService.createPracticeInfo(practiceData, req.userId);
      res.status(201).json({
        success: true,
        data: { practiceInfo: result },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update practice info
   */
  async updatePracticeInfo(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const { practiceInfoId } = req.params;

      // FormData is already parsed by validateFormData middleware

      if (!practiceInfoId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Practice info ID is required' },
        });
      }
      
      // Get existing practice info to check for old logo
      let oldLogoUrl: string | undefined;
      try {
        const existingPractice = await practiceInfoService.getPracticeInfoById(practiceInfoId);
        oldLogoUrl = existingPractice.logoPath as string | undefined;
      } catch (error) {
        // If practice not found, continue without old logo
      }

      // Handle logo upload to S3
      let logoUrl: string | undefined;
      if (req.file) {
        // Validate file size
        if (!isValidFileSize(req.file.size)) {
          return res.status(400).json({
            success: false,
            error: {
              message: 'Logo file size must be less than 5MB',
              errors: {
                logo: ['Logo file size must be less than 5MB'],
              },
            },
          });
        }

        try {
          logoUrl = await uploadToS3(req.file, 'practice-logos');
          
          // Delete old logo from S3 if it exists and is from S3
          if (oldLogoUrl && oldLogoUrl.includes('amazonaws.com')) {
            await deleteFromS3(oldLogoUrl);
          }
        } catch (uploadError) {
          return res.status(500).json({
            success: false,
            error: { message: 'Failed to upload logo to S3' },
          });
        }
      }

      // Prepare data with logo URL
      const practiceData = {
        ...req.body,
        logoPath: logoUrl || req.body.logoPath || oldLogoUrl,
      };

      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }
      
      const result = await practiceInfoService.updatePracticeInfo(
        practiceInfoId,
        practiceData,
        req.userId
      );
      res.status(200).json({
        success: true,
        data: { practiceInfo: result },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete practice info
   */
  async deletePracticeInfo(req: Request, res: Response, next: NextFunction) {
    try {
      const { practiceInfoId } = req.params;
      
      if (!practiceInfoId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Practice info ID is required' },
        });
      }
      
      await practiceInfoService.deletePracticeInfo(practiceInfoId);
      res.status(200).json({
        success: true,
        data: { message: 'Practice info deleted successfully' },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const practiceInfoController = new PracticeInfoController();

