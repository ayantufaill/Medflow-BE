import type { Request, Response, NextFunction } from 'express';
import { ocrService } from '../services/ocr.service';
import { authenticate } from '../middleware/auth.middleware';

export class OCRController {
  /**
   * Extract text from uploaded image using Google Cloud Vision OCR
   * POST /api/ocr/extract-text
   */
  async extractText(req: Request, res: Response, next: NextFunction) {
    try {
      // Check if user is authenticated
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      // Check if OCR service is available
      if (!ocrService.isAvailable()) {
        return res.status(503).json({
          success: false,
          error: {
            message: 'OCR service is not available. Please check Google Cloud Vision configuration.',
          },
        });
      }

      // Check if file was uploaded
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'No image file provided',
            errors: {
              image: ['Please upload an image file'],
            },
          },
        });
      }

      // Validate file size (max 10MB for OCR)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (req.file.size > maxSize) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Image file size exceeds maximum allowed size (10MB)',
            errors: {
              image: ['Image file size must be less than 10MB'],
            },
          },
        });
      }

      // Extract text using Google Cloud Vision
      const extractedText = await ocrService.extractTextFromImage(req.file.buffer);

      if (!extractedText || extractedText.trim().length === 0) {
        return res.status(200).json({
          success: true,
          data: {
            text: '',
            message: 'No text could be extracted from the image. Please ensure the image is clear and contains readable text.',
          },
        });
      }

      res.status(200).json({
        success: true,
        data: {
          text: extractedText,
        },
      });
    } catch (error: any) {
      console.error('OCR Controller Error:', error);
      next(error);
    }
  }
}

// Export singleton instance
export const ocrController = new OCRController();

