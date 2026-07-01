import { Request, Response, NextFunction } from 'express';
import { patientImageService } from '../services/patient-image.service';

export class PatientImageController {

  // GET /patients/:patientId/images
  getImages = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const images = await patientImageService.getImages(req.params.patientId);
      res.status(200).json({ success: true, data: images });
    } catch (error) {
      next(error);
    }
  };

  // GET /patients/:patientId/images/:imageType
  getSingleImage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const image = await patientImageService.getSingleImage(
        req.params.patientId,
        req.params.imageType
      );
      res.status(200).json({ success: true, data: image });
    } catch (error) {
      next(error);
    }
  };

  // POST /patients/:patientId/images/:imageType
  uploadImage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, message: 'No file uploaded.' });
        return;
      }

      const userId = req.user?.userId || '0';
      const filePath = req.file.path;

      const images = await patientImageService.upsertImage(
        req.params.patientId,
        req.params.imageType,
        filePath,
        userId
      );

      res.status(200).json({
        success: true,
        data: images,
        message: `${req.params.imageType} image uploaded successfully`,
      });
    } catch (error) {
      next(error);
    }
  };

  // DELETE /patients/:patientId/images/:imageType
  deleteImage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId || '0';
      await patientImageService.deleteImage(
        req.params.patientId,
        req.params.imageType,
        userId
      );

      res.status(200).json({
        success: true,
        data: null,
        message: `${req.params.imageType} image deleted successfully`,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const patientImageController = new PatientImageController();