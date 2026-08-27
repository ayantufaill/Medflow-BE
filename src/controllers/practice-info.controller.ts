import type { Request, Response, NextFunction } from 'express';
import { practiceInfoService } from '../services/practice-info.service';
import { isValidFileSize } from '../utils/s3.util';

const MOCK_AWS_REGION = 'us-west-2';
const MOCK_AWS_BUCKET = 'medflow-practice-logos-dev';

const buildMockS3Url = (filename: string) => {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const key = `practice-logos/${Date.now()}-${safeName}`;
  return `https://${MOCK_AWS_BUCKET}.s3.${MOCK_AWS_REGION}.amazonaws.com/${key}`;
};

export class PracticeInfoController {
  /**
   * Get all practice info records
   */
  async getAllPracticeInfo(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = req.query.search as string | undefined;

      const result = await practiceInfoService.getAllPracticeInfo(page, limit, search, req.branchAccess?.groupClinicIds);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get single practice info (most recent)
   */
  async getPracticeInfo(req: Request, res: Response, next: NextFunction) {
    try {
      const practiceInfo = await practiceInfoService.getPracticeInfo({
        userId: req.userId,
        branchId: req.query.branchId as string | undefined,
        groupClinicIds: req.branchAccess?.groupClinicIds,
      });
      res.status(200).json({
        success: true,
        data: { practiceInfo },
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
 * Update current practice info (no ID needed)
 */
async updateCurrentPracticeInfo(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.userId) {
      return res.status(401).json({
        success: false,
        error: { message: 'User not authenticated' },
      });
    }

    // Get current practice
    const currentPractice = await practiceInfoService.getPracticeInfo({
      userId: req.userId,
      branchId: req.query.branchId as string | undefined,
      groupClinicIds: req.branchAccess?.groupClinicIds,
    });
    if (!currentPractice) {
      return res.status(404).json({
        success: false,
        error: { message: 'No practice info found' },
      });
    }

    // Handle logo upload
    let logoUrl: string | undefined;
    if (req.file) {
      if (!isValidFileSize(req.file.size)) {
        return res.status(400).json({
          success: false,
          error: { message: 'Logo file size must be less than 5MB' },
        });
      }
      logoUrl = buildMockS3Url(req.file.originalname || 'practice-logo.png');
    }

    const practiceData = {
      ...req.body,
      logoPath: logoUrl || req.body.logoPath || currentPractice.logoPath,
    };

    const result = await practiceInfoService.updatePracticeInfo(
      currentPractice._id,
      practiceData,
      req.branchAccess?.clinicIds
    );

    res.status(200).json({
      success: true,
      data: { practiceInfo: result },
    });
  } catch (error) {
    next(error);
  }
}
  /**
   * Get practice info by ID
   */
  async getPracticeInfoById(req: Request, res: Response, next: NextFunction) {
    try {
      const { practiceInfoId } = req.params;
      
      if (!practiceInfoId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Practice info ID is required' },
        });
      }
      
      const practiceInfo = await practiceInfoService.getPracticeInfoById(practiceInfoId, req.branchAccess?.groupClinicIds);
      res.status(200).json({
        success: true,
        data: { practiceInfo },
      });
    } catch (error) {
      next(error);
    }
  }


  /**
   * Create a new practice info
   */
  async createPracticeInfo(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      // FormData is already parsed by validateFormData middleware

      // Temporary hardcoded AWS behavior: build mock S3 URL without uploading.
      let logoUrl: string | undefined;
      if (req.file) {
        // Validate file size
        if (!isValidFileSize(req.file.size)) {
          return res.status(400).json({
            success: false,
            error: {
              message: 'Logo file size must be less than 5MB',
              errors: {
                logo: ['Logo file size must be less than 5MB'],
              },
            },
          });
        }

        logoUrl = buildMockS3Url(req.file.originalname || 'practice-logo.png');
      }

      // Prepare data with logo URL
      const practiceData = {
        ...req.body,
        logoPath: logoUrl || req.body.logoPath,
      };

      const result = await practiceInfoService.createPracticeInfo(practiceData);
      res.status(201).json({
        success: true,
        data: { practiceInfo: result },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update practice info
   */
  async updatePracticeInfo(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }

      const { practiceInfoId } = req.params;

      // FormData is already parsed by validateFormData middleware

      if (!practiceInfoId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Practice info ID is required' },
        });
      }
      
      // Get existing practice info to check for old logo
      let oldLogoUrl: string | undefined;
      try {
        const existingPractice = await practiceInfoService.getPracticeInfoById(practiceInfoId, req.branchAccess?.groupClinicIds);
        oldLogoUrl = existingPractice.logoPath ?? undefined;
      } catch (error) {
        // If practice not found, continue without old logo
      }

      // Temporary hardcoded AWS behavior: build mock S3 URL without uploading.
      let logoUrl: string | undefined;
      if (req.file) {
        // Validate file size
        if (!isValidFileSize(req.file.size)) {
          return res.status(400).json({
            success: false,
            error: {
              message: 'Logo file size must be less than 5MB',
              errors: {
                logo: ['Logo file size must be less than 5MB'],
              },
            },
          });
        }

        logoUrl = buildMockS3Url(req.file.originalname || 'practice-logo.png');
      }

      // Prepare data with logo URL
      const practiceData = {
        ...req.body,
        logoPath: logoUrl || req.body.logoPath || oldLogoUrl,
      };

      if (!req.userId) {
        return res.status(401).json({
          success: false,
          error: { message: 'User not authenticated' },
        });
      }
      
      const result = await practiceInfoService.updatePracticeInfo(practiceInfoId, practiceData, req.branchAccess?.clinicIds);
      res.status(200).json({
        success: true,
        data: { practiceInfo: result },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update practice opening hours
   */
  async updateOpeningHours(req: Request, res: Response, next: NextFunction) {
    try {
      const { practiceInfoId } = req.params;
      const { businessHours } = req.body;

      if (!practiceInfoId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Practice info ID is required' },
        });
      }

      const result = await practiceInfoService.updatePracticeInfo(practiceInfoId, { businessHours }, req.branchAccess?.clinicIds);
      res.status(200).json({
        success: true,
        data: { practiceInfo: result },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update practice billing configuration
   */
  async updateBillingConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const { practiceInfoId } = req.params;
      const { billingOutOfNetwork, billingAssignmentType, billingProvider } = req.body;

      if (!practiceInfoId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Practice info ID is required' },
        });
      }

      const result = await practiceInfoService.updatePracticeInfo(practiceInfoId, {
        billingOutOfNetwork,
        billingAssignmentType,
        billingProvider,
      }, req.branchAccess?.clinicIds);
      res.status(200).json({
        success: true,
        data: { practiceInfo: result },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update kiosk settings
   */
  async updateKioskSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const { practiceInfoId } = req.params;
      const { kioskSettings } = req.body;

      if (!practiceInfoId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Practice info ID is required' },
        });
      }

      const updates: any = {};
      if (kioskSettings?.password !== undefined) updates.kioskPassword = kioskSettings.password;
      if (kioskSettings?.accounts !== undefined) updates.kioskAccounts = kioskSettings.accounts;

      const result = await practiceInfoService.updatePracticeInfo(practiceInfoId, updates, req.branchAccess?.clinicIds);
      res.status(200).json({
        success: true,
        data: { practiceInfo: result },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update MyChart settings
   */
  async updateMyChartSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const { practiceInfoId } = req.params;
      const { mychartSettings } = req.body;

      if (!practiceInfoId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Practice info ID is required' },
        });
      }

      const result = await practiceInfoService.updatePracticeInfo(practiceInfoId, {
        myChartSettings: mychartSettings,
      }, req.branchAccess?.clinicIds);
      res.status(200).json({
        success: true,
        data: { practiceInfo: result },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update office timings
   */
  async updateOfficeTimings(req: Request, res: Response, next: NextFunction) {
    try {
      const { practiceInfoId } = req.params;
      const { officeTimings } = req.body;

      if (!practiceInfoId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Practice info ID is required' },
        });
      }

      const result = await practiceInfoService.updatePracticeInfo(practiceInfoId, { officeTimings }, req.branchAccess?.clinicIds);
      res.status(200).json({
        success: true,
        data: { practiceInfo: result },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update online schedule configuration
   */
  async updateOnlineSchedule(req: Request, res: Response, next: NextFunction) {
    try {
      const { practiceInfoId } = req.params;
      const { onlineSchedule } = req.body;

      if (!practiceInfoId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Practice info ID is required' },
        });
      }

      const result = await practiceInfoService.updatePracticeInfo(practiceInfoId, { onlineSchedule }, req.branchAccess?.clinicIds);
      res.status(200).json({
        success: true,
        data: { practiceInfo: result },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update patient flags
   */
  async updatePatientFlags(req: Request, res: Response, next: NextFunction) {
    try {
      const { practiceInfoId } = req.params;
      const { patientFlags } = req.body;

      if (!practiceInfoId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Practice info ID is required' },
        });
      }

      const result = await practiceInfoService.updatePracticeInfo(practiceInfoId, { patientFlags }, req.branchAccess?.clinicIds);
      res.status(200).json({
        success: true,
        data: { practiceInfo: result },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update document categories
   */
  async updateDocumentCategories(req: Request, res: Response, next: NextFunction) {
    try {
      const { practiceInfoId } = req.params;
      const { documentCategories } = req.body;

      if (!practiceInfoId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Practice info ID is required' },
        });
      }

      const result = await practiceInfoService.updatePracticeInfo(practiceInfoId, { documentCategories }, req.branchAccess?.clinicIds);
      res.status(200).json({
        success: true,
        data: { practiceInfo: result },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update schedule configuration
   */
  async updateScheduleConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const { practiceInfoId } = req.params;
      const { scheduleConfig } = req.body;

      if (!practiceInfoId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Practice info ID is required' },
        });
      }

      const result = await practiceInfoService.updatePracticeInfo(practiceInfoId, { scheduleConfig }, req.branchAccess?.clinicIds);
      res.status(200).json({
        success: true,
        data: { practiceInfo: result },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update practice settings
   */
  async updatePracticeSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const { practiceInfoId } = req.params;
      const { practiceSettings } = req.body;

      if (!practiceInfoId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Practice info ID is required' },
        });
      }

      const result = await practiceInfoService.updatePracticeInfo(practiceInfoId, { practiceSettings }, req.branchAccess?.clinicIds);
      res.status(200).json({
        success: true,
        data: { practiceInfo: result },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete practice info
   */
  async deletePracticeInfo(req: Request, res: Response, next: NextFunction) {
    try {
      const { practiceInfoId } = req.params;
      
      if (!practiceInfoId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Practice info ID is required' },
        });
      }
      
      await practiceInfoService.deletePracticeInfo(practiceInfoId, req.branchAccess?.clinicIds);
      res.status(200).json({
        success: true,
        data: { message: 'Practice info deleted successfully' },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Schedule installation support appointment
   */
  async scheduleSupportAppointment(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, email, date, timeSlot, note, practiceInfoId } = req.body;
      const result = await practiceInfoService.addSupportAppointment({
        practiceInfoId,
        name,
        email,
        date,
        timeSlot,
        note,
      });
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get scheduled support appointments
   */
  async getSupportAppointments(req: Request, res: Response, next: NextFunction) {
    try {
      const practiceInfoId = req.query.practiceInfoId as string | undefined;
      const result = await practiceInfoService.getSupportAppointments(practiceInfoId);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Move patient data migration (Simulation)
   */
  async movePatientData(req: Request, res: Response, next: NextFunction) {
    try {
      const { fromPatient, toPatient, checklist } = req.body;
      const result = await practiceInfoService.movePatientData(fromPatient, toPatient, checklist);
      res.status(200).json({
        success: true,
        message: 'Patient data migration simulation completed successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Move provider future data migration (Simulation)
   */
  async moveProviderData(req: Request, res: Response, next: NextFunction) {
    try {
      const { fromProvider, toProvider } = req.body;
      const result = await practiceInfoService.moveProviderData(fromProvider, toProvider);
      res.status(200).json({
        success: true,
        message: 'Provider data migration simulation completed successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
  /**
 * GET /practice-info/timings
 */
async getTimings(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await practiceInfoService.getOfficeTimings({
      userId: req.userId,
      branchId: req.query.branchId as string | undefined,
      groupClinicIds: req.branchAccess?.groupClinicIds,
    });
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /practice-info/timings
 */
async updateTimings(req: Request, res: Response, next: NextFunction) {
  try {
    const { timings } = req.body;

    if (!Array.isArray(timings) || timings.length !== 7) {
      return res.status(400).json({
        success: false,
        error: { message: 'timings must be an array of 7 days' },
      });
    }

    const result = await practiceInfoService.updateOfficeTimings(timings, {
      userId: req.userId,
      branchId: req.query.branchId as string | undefined,
      groupClinicIds: req.branchAccess?.groupClinicIds,
      clinicIds: req.branchAccess?.clinicIds,
    });
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}
}

export const practiceInfoController = new PracticeInfoController();
