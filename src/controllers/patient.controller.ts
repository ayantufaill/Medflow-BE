import type { Request, Response, NextFunction } from 'express';
import { patientService } from '../services/patient.service';
import { patientWorkspaceService } from '../services/patient-workspace.service';
import { logActivityFromRequest } from '../utils/activity-logger.util';

export class PatientController {
  async getAllPatients(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = req.query.search as string | undefined;
      const status = req.query.status as string | undefined;
      const dobStart = req.query.dobStart as string | undefined;
      const dobEnd = req.query.dobEnd as string | undefined;
      const gender = req.query.gender as string | undefined;
      const providerId = req.query.providerId as string | undefined;

      const result = await patientService.getAllPatients(page, limit, search, status, dobStart, dobEnd, gender, providerId);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getPatientById(req: Request, res: Response, next: NextFunction) {
    try {
      const { patientId } = req.params;
      const includeSSN = req.query.includeSSN === 'true';
      
      if (!patientId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Patient ID is required' },
        });
      }

      const patient = includeSSN
        ? await patientService.getPatientByIdWithSSN(patientId)
        : await patientService.getPatientById(patientId);

      // Log activity
      if (req.userId) {
        await logActivityFromRequest(req, 'viewed', 'patients', patientId);
      }

      res.status(200).json({
        success: true,
        data: { patient },
      });
    } catch (error) {
      next(error);
    }
  }

  async getPatientBalance(req: Request, res: Response, next: NextFunction) {
    try {
      const { patientId } = req.params;
      
      if (!patientId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Patient ID is required' },
        });
      }
      
      const balance = await patientService.getPatientBalance(patientId);

      res.status(200).json({
        success: true,
        data: balance,
      });
    } catch (error) {
      next(error);
    }
  }

  async getPatientLastVisit(req: Request, res: Response, next: NextFunction) {
  try {
    const { patientId } = req.params;
    if (!patientId) {
      return res.status(400).json({
        success: false,
        error: { message: 'Patient ID is required' },
      });
    }
    const result = await patientService.getPatientLastVisit(patientId);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}
  async searchPatients(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = req.query.search as string | undefined;
      const status = req.query.status as string | undefined;
      const dobStart = req.query.dobStart as string | undefined;
      const dobEnd = req.query.dobEnd as string | undefined;
      const gender = req.query.gender as string | undefined;
      const providerId = req.query.providerId as string | undefined;

      const result = await patientService.getAllPatients(page, limit, search, status, dobStart, dobEnd, gender, providerId);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async checkDuplicates(req: Request, res: Response, next: NextFunction) {
    try {
      const { firstName, lastName, dateOfBirth, phonePrimary, email } = req.body;

      if (!firstName || !lastName || !dateOfBirth) {
        return res.status(400).json({
          success: false,
          error: { message: 'firstName, lastName, and dateOfBirth are required' },
        });
      }

      const duplicates = await patientService.findDuplicatePatients({
        firstName,
        lastName,
        dateOfBirth: new Date(dateOfBirth),
        phonePrimary,
        email,
      });

      res.status(200).json({
        success: true,
        data: { duplicates },
      });
    } catch (error) {
      next(error);
    }
  }

  async createPatient(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const result = await patientService.createPatient(req.body, req.userId);
      res.status(201).json({
        success: true,
        data: { patient: result },
      });
    } catch (error) {
      next(error);
    }
  }

  async updatePatient(req: Request, res: Response, next: NextFunction) {
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
      
      const result = await patientService.updatePatient(patientId, req.body, req.userId);
      res.status(200).json({
        success: true,
        data: { patient: result },
      });
    } catch (error) {
      next(error);
    }
  }

  async deletePatient(req: Request, res: Response, next: NextFunction) {
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
      
      const result = await patientService.deletePatient(patientId, req.userId);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getPatientWorkspace(req: Request, res: Response, next: NextFunction) {
    try {
      const { patientId } = req.params;
      if (!patientId) {
        return res.status(400).json({ success: false, error: { message: 'Patient ID is required' } });
      }
      const patient = await patientWorkspaceService.getPatientWorkspace(patientId);
      res.status(200).json({
        success: true,
        data: { patient },
      });
    } catch (error) {
      next(error);
    }
  }

  async getStructuredMedicalHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const { patientId } = req.params;
      if (!patientId) {
        return res.status(400).json({ success: false, error: { message: 'Patient ID is required' } });
      }
      const result = await patientService.getStructuredMedicalHistory(patientId);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getDentalHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const { patientId } = req.params;
      if (!patientId) {
        return res.status(400).json({ success: false, error: { message: 'Patient ID is required' } });
      }
      const result = await patientService.getDentalHistory(patientId);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getPatientHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const { patientId } = req.params;
    if (!patientId) {
      return res.status(400).json({
        success: false,
        error: { message: 'Patient ID is required' },
      });
    }
    const result = await patientService.getPatientHistoryAggregate(patientId);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

  async updateStructuredMedicalHistory(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }
      const { patientId } = req.params;
      if (!patientId) {
        return res.status(400).json({ success: false, error: { message: 'Patient ID is required' } });
      }
      const result = await patientService.updateStructuredMedicalHistory(patientId, req.body, req.userId);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateDentalHistory(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }
      const { patientId } = req.params;
      if (!patientId) {
        return res.status(400).json({ success: false, error: { message: 'Patient ID is required' } });
      }
      const result = await patientService.updateDentalHistory(patientId, req.body, req.userId);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async updatePatientWorkspaceMeta(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }
      const { patientId } = req.params;
      if (!patientId) {
        return res.status(400).json({ success: false, error: { message: 'Patient ID is required' } });
      }
      const patient = await patientWorkspaceService.updatePatientWorkspaceMeta(
        patientId,
        req.body,
        req.userId
      );
      res.status(200).json({
        success: true,
        data: { patient },
      });
    } catch (error) {
      next(error);
    }
  }

  async getPatientUpdateRequests(req: Request, res: Response, next: NextFunction) {
    try {
      const { patientId } = req.params;
      if (!patientId) {
        return res.status(400).json({ success: false, error: { message: 'Patient ID is required' } });
      }
      const result = await patientWorkspaceService.getUpdateRequests(patientId);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async createPatientUpdateRequest(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }
      const { patientId } = req.params;
      if (!patientId) {
        return res.status(400).json({ success: false, error: { message: 'Patient ID is required' } });
      }
      const result = await patientWorkspaceService.createUpdateRequest(
        patientId,
        req.body,
        req.userId
      );
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getPatientReconciliation(req: Request, res: Response, next: NextFunction) {
    try {
      const { patientId, requestId } = req.params;
      if (!patientId || !requestId) {
        return res.status(400).json({ success: false, error: { message: 'Patient ID and request ID are required' } });
      }
      const result = await patientWorkspaceService.getReconciliation(patientId, requestId);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async applyPatientReconciliation(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }
      const { patientId, requestId } = req.params;
      if (!patientId || !requestId) {
        return res.status(400).json({ success: false, error: { message: 'Patient ID and request ID are required' } });
      }
      const result = await patientWorkspaceService.applyReconciliation(
        patientId,
        requestId,
        req.body,
        req.userId
      );
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getPatientAuditHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const { patientId } = req.params;
      if (!patientId) {
        return res.status(400).json({ success: false, error: { message: 'Patient ID is required' } });
      }
      const result = await patientWorkspaceService.getAuditHistory(patientId);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getPatientCommunications(req: Request, res: Response, next: NextFunction) {
    try {
      const { patientId } = req.params;
      if (!patientId) {
        return res.status(400).json({ success: false, error: { message: 'Patient ID is required' } });
      }
      const result = await patientWorkspaceService.getCommunications(patientId);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async createPatientCommunication(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }
      const { patientId } = req.params;
      if (!patientId) {
        return res.status(400).json({ success: false, error: { message: 'Patient ID is required' } });
      }
      const result = await patientWorkspaceService.createCommunication(
        patientId,
        req.body,
        req.userId
      );
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getPatientReportSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const { patientId } = req.params;
      if (!patientId) {
        return res.status(400).json({ success: false, error: { message: 'Patient ID is required' } });
      }
      const result = await patientWorkspaceService.getReportSummary(patientId);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getPatientReportShowcase(req: Request, res: Response, next: NextFunction) {
    try {
      const { patientId } = req.params;
      if (!patientId) {
        return res.status(400).json({ success: false, error: { message: 'Patient ID is required' } });
      }
      const result = await patientWorkspaceService.getReportShowcase(patientId);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getPatientReportConcerns(req: Request, res: Response, next: NextFunction) {
    try {
      const { patientId } = req.params;
      if (!patientId) {
        return res.status(400).json({ success: false, error: { message: 'Patient ID is required' } });
      }
      const result = await patientWorkspaceService.getReportConcerns(patientId);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async refreshPatientReports(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }
      const { patientId } = req.params;
      if (!patientId) {
        return res.status(400).json({ success: false, error: { message: 'Patient ID is required' } });
      }
      const result = await patientWorkspaceService.refreshReportSnapshots(patientId, req.userId);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async getPatientAccountNotes(req: Request, res: Response, next: NextFunction) {
    try {
      const { patientId } = req.params;
      if (!patientId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Patient ID is required' },
        });
      }
      const notes = await patientService.getPatientAccountNotes(patientId);
      res.status(200).json({
        success: true,
        data: notes,
      });
    } catch (error) {
      next(error);
    }
  }

  async createPatientAccountNote(req: Request, res: Response, next: NextFunction) {
    try {
      const { patientId } = req.params;
      const { text, remindMe } = req.body;
      if (!patientId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Patient ID is required' },
        });
      }
      if (text === undefined || text === null) {
        return res.status(400).json({
          success: false,
          error: { message: 'Text is required' },
        });
      }
      const note = await patientService.createPatientAccountNote(
        patientId,
        text,
        !!remindMe,
        req.userId
      );
      res.status(201).json({
        success: true,
        data: note,
      });
    } catch (error) {
      next(error);
    }
  }

  async updatePatientAccountNote(req: Request, res: Response, next: NextFunction) {
    try {
      const { noteId } = req.params;
      const { text, remindMe, archived } = req.body;
      if (!noteId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Note ID is required' },
        });
      }
      const note = await patientService.updatePatientAccountNote(
        noteId,
        { text, remindMe, archived },
        req.userId
      );
      res.status(200).json({
        success: true,
        data: note,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const patientController = new PatientController();
