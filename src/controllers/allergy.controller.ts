import type { Request, Response, NextFunction } from 'express';
import { allergyService } from '../services/allergy.service';

export class AllergyController {
  async createAllergy(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const { patientId, allergen, reaction, severity, documentedBy, documentedDate } = req.body;

      const allergy = await allergyService.createAllergy({
        patientId,
        allergen,
        reaction,
        severity,
        documentedBy: documentedBy || req.userId, // Use provided documentedBy or authenticated user
        documentedDate: documentedDate ? new Date(documentedDate) : undefined,
        isActive: req.body.isActive !== undefined ? req.body.isActive : true,
      });

      res.status(201).json({
        success: true,
        data: { allergy },
      });
    } catch (error) {
      next(error);
    }
  }

  async getAllergies(req: Request, res: Response, next: NextFunction) {
    try {
      const { patient_id } = req.query;
      
      if (!patient_id) {
        return res.status(400).json({
          success: false,
          error: { message: 'patient_id is required' },
        });
      }

      const allergies = await allergyService.getAllergies(patient_id as string);
      
      res.status(200).json({
        success: true,
        data: { allergies },
      });
    } catch (error) {
      next(error);
    }
  }

  async getAllergyById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id, allergyId } = req.params;
      const allergyIdValue = id || allergyId;
      if (!allergyIdValue) {
        return res.status(400).json({
          success: false,
          error: { message: 'Allergy ID is required' },
        });
      }
      const allergy = await allergyService.getAllergyById(allergyIdValue);
      
      res.status(200).json({
        success: true,
        data: { allergy },
      });
    } catch (error) {
      next(error);
    }
  }

  async updateAllergy(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          error: { message: 'Allergy ID is required' },
        });
      }
      
      const { allergen, reaction, severity, documentedDate, isActive } = req.body;

      const updates: any = {};
      if (allergen !== undefined) updates.allergen = allergen;
      if (reaction !== undefined) updates.reaction = reaction;
      if (severity !== undefined) updates.severity = severity;
      if (documentedDate !== undefined) updates.documentedDate = new Date(documentedDate);
      if (isActive !== undefined) updates.isActive = isActive;

      const allergy = await allergyService.updateAllergy(id, updates);
      
      res.status(200).json({
        success: true,
        data: { allergy },
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteAllergy(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          error: { message: 'Allergy ID is required' },
        });
      }
      
      const result = await allergyService.deleteAllergy(id);
      
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // Patient-specific allergy routes (nested under /patients/:patientId/allergies)
  async getPatientAllergies(req: Request, res: Response, next: NextFunction) {
    try {
      const { patientId } = req.params;
      const { isActive } = req.query;
      
      if (!patientId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Patient ID is required' },
        });
      }
      
      const parsedIsActive =
        isActive === undefined
          ? undefined
          : isActive === 'true'
            ? true
            : isActive === 'false'
              ? false
              : undefined;

      const allergies = await allergyService.getAllergies(patientId, parsedIsActive);
      
      res.status(200).json({
        success: true,
        data: { allergies },
      });
    } catch (error) {
      next(error);
    }
  }

  async createPatientAllergy(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const { patientId } = req.params;
      
      if (!patientId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Patient ID is required' },
        });
      }
      
      const { allergen, reaction, severity, documentedDate } = req.body;

      const allergy = await allergyService.createAllergy({
        patientId,
        allergen,
        reaction,
        severity,
        documentedBy: req.body.documentedBy || req.userId,
        documentedDate: documentedDate ? new Date(documentedDate) : undefined,
        isActive: req.body.isActive !== undefined ? req.body.isActive : true,
      });

      res.status(201).json({
        success: true,
        data: { allergy },
      });
    } catch (error) {
      next(error);
    }
  }

  async updatePatientAllergy(req: Request, res: Response, next: NextFunction) {
    try {
      const { allergyId } = req.params;
      
      if (!allergyId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Allergy ID is required' },
        });
      }
      
      const { allergen, reaction, severity, documentedDate, isActive, documentedBy } = req.body;

      const updates: any = {};
      if (allergen !== undefined) updates.allergen = allergen;
      if (reaction !== undefined) updates.reaction = reaction;
      if (severity !== undefined) updates.severity = severity;
      if (documentedDate !== undefined) updates.documentedDate = new Date(documentedDate);
      if (documentedBy !== undefined) updates.documentedBy = documentedBy;
      if (isActive !== undefined) updates.isActive = isActive;

      const allergy = await allergyService.updateAllergy(allergyId, updates);
      
      res.status(200).json({
        success: true,
        data: { allergy },
      });
    } catch (error) {
      next(error);
    }
  }

  async deletePatientAllergy(req: Request, res: Response, next: NextFunction) {
    try {
      const { allergyId } = req.params;
      
      if (!allergyId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Allergy ID is required' },
        });
      }
      
      const result = await allergyService.deleteAllergy(allergyId);
      
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const allergyController = new AllergyController();
