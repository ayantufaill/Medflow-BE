import { Router } from 'express';
import { ocrController } from '../controllers/ocr.controller';
import { authenticate } from '../middleware/auth.middleware';
import { uploadOCRImage } from '../middleware/upload.middleware';

const router = Router();

// All OCR routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /ocr/extract-text:
 *   post:
 *     summary: Extract text from image using OCR
 *     tags: [OCR]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - image
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Image file (JPEG, PNG, GIF, WebP, max 10MB)
 *               languageHint:
 *                 type: string
 *                 description: Optional language hint (e.g., 'en', 'es')
 *     responses:
 *       200:
 *         description: Text extracted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     text:
 *                       type: string
 *                       example: "Extracted text from image..."
 *                     confidence:
 *                       type: number
 *                       example: 0.95
 *       400:
 *         description: No image uploaded or invalid file
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Unauthorized
 *       413:
 *         description: File too large (max 10MB)
 *       500:
 *         description: OCR processing failed
 */
router.post(
  '/extract-text',
  uploadOCRImage.single('image'),
  ocrController.extractText.bind(ocrController)
);

export default router;