import multer from 'multer';
import { isValidImageType, isValidFileSize } from '../utils/s3.util';

// Configure multer to use memory storage (for S3 upload)
const storage = multer.memoryStorage();

// File filter for images only
const fileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (isValidImageType(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images (JPEG, PNG, GIF, WebP) are allowed.'));
  }
};

// Multer configuration for logos (5MB max)
export const uploadLogo = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
});

// Multer configuration for OCR images (10MB max)
export const uploadOCRImage = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max for OCR
  },
});

