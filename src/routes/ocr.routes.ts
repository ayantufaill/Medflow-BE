import { Router } from 'express';
import { ocrController } from '../controllers/ocr.controller';
import { authenticate } from '../middleware/auth.middleware';
import { uploadOCRImage } from '../middleware/upload.middleware';

const router = Router();

// All OCR routes require authentication
router.use(authenticate);

/**
 * POST /api/ocr/extract-text
 * Extract text from uploaded image using Google Cloud Vision OCR
 * 
 * Body: multipart/form-data
 * - image: Image file (JPEG, PNG, GIF, WebP, max 10MB)
 * 
 * Response:
 * {
 *   success: true,
 *   data: {
 *     text: "extracted text..."
 *   }
 * }
 */
router.post(
  '/extract-text',
  uploadOCRImage.single('image'),
  ocrController.extractText.bind(ocrController)
);

export default router;

