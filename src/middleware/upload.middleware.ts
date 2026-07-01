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

const documentFileFilter = (
  req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const validTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  if (validTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Upload an image, PDF, TXT, DOC, or DOCX file.'));
  }
};

const eraFileFilter = (
  req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const validTypes = [
    'text/plain',
    'text/csv',
    'application/csv',
    'application/edi-x12',
    'application/octet-stream',
    'application/xml',
  ];

  if (validTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid ERA file type. Upload .835, .txt, .edi, or .csv.'));
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

// Multer configuration for patient documents (20MB max)
export const uploadDocument = multer({
  storage,
  fileFilter: documentFileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});

// Multer configuration for ERA files (10MB max)
export const uploadEraFile = multer({
  storage,
  fileFilter: eraFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});
