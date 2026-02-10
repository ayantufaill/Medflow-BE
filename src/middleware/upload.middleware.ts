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

// Allowed MIME types for claim documents (PDF, images, common docs)
const claimDocMimeTypes = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/msword', // .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
];

const claimDocFileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (claimDocMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Allowed: PDF, images, Word documents. Got: ${file.mimetype}`));
  }
};

// Multer for claim document uploads (10MB max)
export const uploadClaimDocument = multer({
  storage,
  fileFilter: claimDocFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// ERA/EOB file types (.835, .txt, .edi, .csv for demo)
const eraFileExtensions = ['.835', '.txt', '.edi', '.csv'];
const eraMimeTypes = ['application/octet-stream', 'text/plain', 'text/csv', 'application/csv'];

const eraFileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = file.originalname?.toLowerCase().slice(file.originalname.lastIndexOf('.'));
  const ok = eraFileExtensions.includes(ext) || eraMimeTypes.includes(file.mimetype);
  if (ok) cb(null, true);
  else cb(new Error('Invalid ERA file. Use .835, .txt, .edi, or .csv'));
};

export const uploadERAFile = multer({
  storage,
  fileFilter: eraFileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

