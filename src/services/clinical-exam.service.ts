import { prisma } from '../config/db';
import { NotFoundError, BadRequestError, AuthorizationError } from '../utils/error.util';
import { logActivity } from '../utils/activity-logger.util';
import { ExamType, UpsertExamInput } from '../types/clinical-exam.types';

const getModel = (examType: ExamType) => {
  const modelMap = {
    'radiographic': prisma.examradiographic,
    'tmj': prisma.examtmj,
    'head-neck': prisma.examheadneck,
    'tooth-structure': prisma.examtoothstructure,
    'morphological': prisma.exammorphological,
    'periodontal': prisma.examperiodontal,
    'dentofacial': prisma.examdentofacial,
    'airway': prisma.examairway,
  };
  return modelMap[examType] as any; 
};

// Map output to consistent JS format (BigInt -> string, parse ExamData JSON)
const mapExamRecord = (record: any, examType: ExamType) => {
  if (!record) return null;
  return {
    id: record.ExamId ? record.ExamId.toString() : undefined,
    examType,
    patientId: record.PatNum?.toString(),
    appointmentId: record.AptNum?.toString(),
    providerId: record.ProvNum?.toString(),
    isSigned: record.IsSigned,
    signedBy: record.SignedBy?.toString(),
    signedAt: record.SignedAt,
    examData: record.ExamData ? JSON.parse(record.ExamData) : null,
    createdAt: record.CreatedAt,
    updatedAt: record.UpdatedAt,
    createdBy: record.CreatedBy?.toString(),
    updatedBy: record.UpdatedBy?.toString(),
  };
};

export class ClinicalExamService {
  
  async getExamByAppointment(examType: ExamType, appointmentId: string) {
    const model = getModel(examType);
    const aptNum = BigInt(appointmentId);

    const record = await model.findUnique({
      where: { AptNum: aptNum }
    });

    return mapExamRecord(record, examType);
  }

  async upsertExam(examType: ExamType, appointmentId: string, data: UpsertExamInput, userId: string) {
    const model = getModel(examType);
    const aptNum = BigInt(appointmentId);
    const patNum = BigInt(data.patientId);
    const provNum = BigInt(data.providerId);
    const userNum = BigInt(userId);
    const examDataJson = JSON.stringify(data.examData);

    // 1. Check if record exists
    const existingRecord = await model.findUnique({
      where: { AptNum: aptNum }
    });

    if (existingRecord) {
      // 2. If exists AND IsSigned === true → throw AuthorizationError
      if (existingRecord.IsSigned) {
        throw new AuthorizationError('Exam is signed and locked. No further edits are allowed.');
      }

      // 3. Update existing record
      const updatedRecord = await model.update({
        where: { AptNum: aptNum },
        data: {
          ExamData: examDataJson,
          UpdatedBy: userNum,
          PatNum: patNum,
          ProvNum: provNum,
        }
      });

      // Log activity
      await logActivity(
        userId,
        'updated',
        `exam_${examType}`,
        aptNum.toString(),
        existingRecord,
        updatedRecord
      );

      return mapExamRecord(updatedRecord, examType);
    } else {
      // 4. Create new record
      const newRecord = await model.create({
        data: {
          PatNum: patNum,
          AptNum: aptNum,
          ProvNum: provNum,
          ExamData: examDataJson,
          CreatedBy: userNum,
          UpdatedBy: userNum,
        }
      });

      // Log activity
      await logActivity(
        userId,
        'created',
        `exam_${examType}`,
        aptNum.toString(),
        null,
        newRecord
      );

      return mapExamRecord(newRecord, examType);
    }
  }

  async signExam(examType: ExamType, appointmentId: string, userId: string) {
    const model = getModel(examType);
    const aptNum = BigInt(appointmentId);
    const userNum = BigInt(userId);

    // 1. Find record
    const existingRecord = await model.findUnique({
      where: { AptNum: aptNum }
    });

    if (!existingRecord) {
      throw new NotFoundError(`No ${examType} exam found for appointment ${appointmentId} to sign.`);
    }

    // 2. If already signed
    if (existingRecord.IsSigned) {
      throw new BadRequestError('Exam is already signed.');
    }

    // 3. Update IsSigned=true, SignedBy, SignedAt
    const updatedRecord = await model.update({
      where: { AptNum: aptNum },
      data: {
        IsSigned: true,
        SignedBy: userNum,
        SignedAt: new Date(),
        UpdatedBy: userNum,
      }
    });

    // Log activity
    await logActivity(
      userId,
      'updated',
      `exam_${examType}`,
      aptNum.toString(),
      existingRecord,
      updatedRecord
    );

    return mapExamRecord(updatedRecord, examType);
  }
}

export const clinicalExamService = new ClinicalExamService();
