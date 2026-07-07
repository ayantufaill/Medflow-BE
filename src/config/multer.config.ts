import multer from 'multer';
import path from 'path';
import fs from 'fs';

const IMAGE_TYPES = ['profile', 'xray', 'teeth-crop'] as const;
export type ImageType = typeof IMAGE_TYPES[number];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const patientId = req.params.patientId;
    const uploadPath = path.join(process.cwd(), 'uploads', 'patients', patientId);
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const imageType = req.params.imageType as ImageType;
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${imageType}${ext}`);
  },
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, and WebP images are allowed.'));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});