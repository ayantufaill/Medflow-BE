import { Request, Response, NextFunction } from 'express';
import { labCaseService } from '../services/lab-case.service';

export class LabCaseController {
  getAllLabCases = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 25;
      const patientId = req.query.patientId as string | undefined;
      const tab = req.query.tab as string | undefined;
      const status = req.query.status as string | undefined;
      const sortBy = req.query.sortBy as string | undefined;
      const order = req.query.order as string | undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;

      const result = await labCaseService.getAllLabCases(
        page, limit, patientId, tab, status, sortBy, order, startDate, endDate
      );

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  };

  getLabCaseById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const planId = req.params.id;
      const result = await labCaseService.getLabCaseById(planId);
      
      res.status(200).json({
        success: true,
        data: { labCase: result }
      });
    } catch (error) {
      next(error);
    }
  };

  createLabCase = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { patientId, laboratoryId, appointmentId, dueDate, instructions, labFee, providerNum, sharedOn } = req.body;
      
      const result = await labCaseService.createLabCase({
        patientId,
        laboratoryId,
        appointmentId,
        dueDate,
        instructions,
        labFee,
        providerNum,
        sharedOn
      });
      
      res.status(201).json({
        success: true,
        data: { labCase: result },
        message: 'Lab case created successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  updateLabCase = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const planId = req.params.id;
      const { laboratoryId, appointmentId, dueDate, dateSent, dateReceived, dateChecked, instructions, labFee, invoiceNum } = req.body;
      
      const result = await labCaseService.updateLabCase(planId, {
        laboratoryId,
        appointmentId,
        dueDate,
        dateSent,
        dateReceived,
        dateChecked,
        instructions,
        labFee,
        invoiceNum
      });
      
      res.status(200).json({
        success: true,
        data: { labCase: result },
        message: 'Lab case updated successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  updateLabCaseStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const planId = req.params.id;
      const { status } = req.body;
      
      const result = await labCaseService.updateLabCaseStatus(planId, status);
      
      res.status(200).json({
        success: true,
        data: { labCase: result },
        message: 'Lab case status updated successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  deleteLabCase = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const planId = req.params.id;
      const result = await labCaseService.deleteLabCase(planId);
      
      res.status(200).json({
        success: true,
        message: result.message
      });
    } catch (error) {
      next(error);
    }
  };

  getAllLaboratories = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const includeHidden = req.query.includeHidden === 'true';

      const result = await labCaseService.getAllLaboratories(page, limit, includeHidden);

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  };

  createLaboratory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { description, phone, email, address, city, state, zip } = req.body;
      
      const result = await labCaseService.createLaboratory({
        description,
        phone,
        email,
        address,
        city,
        state,
        zip
      });
      
      res.status(201).json({
        success: true,
        data: { laboratory: result },
        message: 'Laboratory created successfully'
      });
    } catch (error) {
      next(error);
    }
  };
}

export const labCaseController = new LabCaseController();
