import { Router } from 'express';
import { patientImageController } from '../controllers/patient-image.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { upload } from '../config/multer.config';
import { param } from 'express-validator';
import { validate } from '../middleware/validation.middleware';

const router = Router({ mergeParams: true });

const patientIdValidator = [
  param('patientId').isInt({ min: 1 }).withMessage('patientId must be a valid integer.'),
];

const imageTypeValidator = [
  param('imageType')
    .isIn(['profile', 'xray', 'teeth-crop'])
    .withMessage('imageType must be profile, xray, or teeth-crop.'),
];

/**
 * @swagger
 * /patients/{patientId}/images:
 *   get:
 *     summary: Get all images for a patient
 *     description: Returns the file paths for all three image types (profile, x-ray, teeth crop) associated with the given patient. Any image not yet uploaded will be returned as null.
 *     tags: [Patient Images]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: integer }
 *         description: The patient's ID (PatNum)
 *         example: 1
 *     responses:
 *       200:
 *         description: Successfully retrieved patient images
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     imageId: { type: string, example: "1" }
 *                     patientId: { type: string, example: "1" }
 *                     profileImagePath: { type: string, nullable: true, example: "/app/uploads/patients/1/profile.jpg" }
 *                     xrayImagePath: { type: string, nullable: true, example: "/app/uploads/patients/1/xray.jpg" }
 *                     teethCropImagePath: { type: string, nullable: true, example: "/app/uploads/patients/1/teeth-crop.jpg" }
 *                     createdAt: { type: string, format: date-time }
 *                     updatedAt: { type: string, format: date-time }
 *       400:
 *         description: Validation error — invalid patientId
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       403:
 *         description: Forbidden — missing patients.read permission
 */
router.get(
  '/',
  authenticate,
  requirePermission('patients.read'),
  validate(patientIdValidator),
  patientImageController.getImages
);

/**
 * @swagger
 * /patients/{patientId}/images/{imageType}:
 *   get:
 *     summary: Get a single image for a patient by type
 *     description: Returns the file path for a specific image type (profile, xray, or teeth-crop) for the given patient. Returns null if that image has not been uploaded yet.
 *     tags: [Patient Images]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: integer }
 *         description: The patient's ID (PatNum)
 *         example: 1
 *       - in: path
 *         name: imageType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [profile, xray, teeth-crop]
 *         description: The type of image to retrieve
 *         example: profile
 *     responses:
 *       200:
 *         description: Successfully retrieved image
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     patientId: { type: string, example: "1" }
 *                     imageType: { type: string, example: "profile" }
 *                     path: { type: string, nullable: true, example: "/app/uploads/patients/1/profile.jpg" }
 *       400:
 *         description: Validation error — invalid patientId or imageType
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       403:
 *         description: Forbidden — missing patients.read permission
 *       404:
 *         description: No image record found for this patient
 */
router.get(
  '/:imageType',
  authenticate,
  requirePermission('patients.read'),
  validate([...patientIdValidator, ...imageTypeValidator]),
  patientImageController.getSingleImage
);

/**
 * @swagger
 * /patients/{patientId}/images/{imageType}:
 *   post:
 *     summary: Upload or replace an image for a patient
 *     description: Uploads a new image of the specified type for the given patient. If an image of the same type already exists, it is replaced and the old file is deleted from disk. Accepted formats are JPEG, PNG, and WebP. Maximum file size is 10MB.
 *     tags: [Patient Images]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: integer }
 *         description: The patient's ID (PatNum)
 *         example: 1
 *       - in: path
 *         name: imageType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [profile, xray, teeth-crop]
 *         description: The type of image being uploaded
 *         example: xray
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [image]
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: The image file to upload (JPEG, PNG, or WebP, max 10MB)
 *     responses:
 *       200:
 *         description: Image uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     imageId: { type: string, example: "1" }
 *                     patientId: { type: string, example: "1" }
 *                     profileImagePath: { type: string, nullable: true, example: "/app/uploads/patients/1/profile.jpg" }
 *                     xrayImagePath: { type: string, nullable: true, example: "/app/uploads/patients/1/xray.jpg" }
 *                     teethCropImagePath: { type: string, nullable: true, example: null }
 *                     createdAt: { type: string, format: date-time }
 *                     updatedAt: { type: string, format: date-time }
 *                 message: { type: string, example: "xray image uploaded successfully" }
 *       400:
 *         description: Validation error — missing file, invalid imageType, or unsupported file format
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       403:
 *         description: Forbidden — missing patients.update permission
 */
router.post(
  '/:imageType',
  authenticate,
  requirePermission('patients.update'),
  validate([...patientIdValidator, ...imageTypeValidator]),
  upload.single('image'),
  patientImageController.uploadImage
);

/**
 * @swagger
 * /patients/{patientId}/images/{imageType}:
 *   delete:
 *     summary: Delete a specific image for a patient
 *     description: Deletes the image of the specified type for the given patient, removing both the database reference and the file from disk. Returns 404 if the patient has no image record or if that specific image type has not been uploaded.
 *     tags: [Patient Images]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema: { type: integer }
 *         description: The patient's ID (PatNum)
 *         example: 1
 *       - in: path
 *         name: imageType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [profile, xray, teeth-crop]
 *         description: The type of image to delete
 *         example: teeth-crop
 *     responses:
 *       200:
 *         description: Image deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { nullable: true, example: null }
 *                 message: { type: string, example: "teeth-crop image deleted successfully" }
 *       400:
 *         description: Validation error — invalid patientId or imageType
 *       401:
 *         description: Unauthorized — missing or invalid token
 *       403:
 *         description: Forbidden — missing patients.update permission
 *       404:
 *         description: No image record found for this patient, or specified image type not yet uploaded
 */
router.delete(
  '/:imageType',
  authenticate,
  requirePermission('patients.update'),
  validate([...patientIdValidator, ...imageTypeValidator]),
  patientImageController.deleteImage
);

export default router;