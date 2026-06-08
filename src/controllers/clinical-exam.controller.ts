import { Request, Response, NextFunction } from 'express';
import { clinicalExamService } from '../services/clinical-exam.service';
import { ExamType } from '../types/clinical-exam.types';

export class ClinicalExamController {
  
  // GET /clinical-exams/:examType/:appointmentId
  getExamByAppointment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const examType = req.params.examType as ExamType;
      const appointmentId = req.params.appointmentId;
      
      const exam = await clinicalExamService.getExamByAppointment(examType, appointmentId);
      
      res.status(200).json({
        success: true,
        data: { exam }
      });
    } catch (error) {
      next(error);
    }
  };

  // PUT /clinical-exams/:examType/:appointmentId
  upsertExam = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const examType = req.params.examType as ExamType;
      const appointmentId = req.params.appointmentId;
      const userId = req.user?.userId || '0';
      
      const { patientId, providerId, examData } = req.body;
      
      const exam = await clinicalExamService.upsertExam(
        examType, 
        appointmentId, 
        { patientId, providerId, examData },
        userId
      );
      
      res.status(200).json({
        success: true,
        data: { exam },
        message: `${examType} exam saved successfully`
      });
    } catch (error) {
      next(error);
    }
  };

  // POST /clinical-exams/:examType/:appointmentId/sign
  signExam = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const examType = req.params.examType as ExamType;
      const appointmentId = req.params.appointmentId;
      const userId = req.user?.userId || '0';
      
      const exam = await clinicalExamService.signExam(examType, appointmentId, userId);
      
      res.status(200).json({
        success: true,
        data: { exam },
        message: `${examType} exam signed and locked successfully`
      });
    } catch (error) {
      next(error);
    }
  };
}

export const clinicalExamController = new ClinicalExamController();
