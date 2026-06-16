import { prisma } from '../config/db';
import { NotFoundError, BadRequestError, AuthorizationError } from '../utils/error.util';
import { logActivity } from '../utils/activity-logger.util';
import { ExamType, UpsertExamInput } from '../types/clinical-exam.types';
import { getNextId } from '../utils/opendental-ids.util';

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
    'dentofacial-opinion': prisma.examdentofacial,
    'periodontal-opinion': prisma.examperiodontal,
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
    examData: record.ExamData ? (typeof record.ExamData === 'string' ? JSON.parse(record.ExamData) : record.ExamData) : null,
    createdAt: record.CreatedAt,
    updatedAt: record.UpdatedAt,
    createdBy: record.CreatedBy?.toString(),
    updatedBy: record.UpdatedBy?.toString(),
  };
};

export class ClinicalExamService {
  
  private async getPrefExam(examType: ExamType, aptNum: bigint) {
    const fkeyType = examType === 'biomechanical' ? 215 : 216;
    const pref = await prisma.userodpref.findFirst({
      where: {
        Fkey: aptNum,
        FkeyType: fkeyType,
      },
    });
    if (!pref || !pref.ValueString) {
      return null;
    }
    try {
      const data = JSON.parse(pref.ValueString);
      return {
        ExamId: pref.UserOdPrefNum,
        PatNum: data.PatNum ? BigInt(data.PatNum) : null,
        AptNum: aptNum,
        ProvNum: data.ProvNum ? BigInt(data.ProvNum) : null,
        IsSigned: !!data.IsSigned,
        SignedBy: data.SignedBy ? BigInt(data.SignedBy) : null,
        SignedAt: data.SignedAt ? new Date(data.SignedAt) : null,
        ExamData: data.ExamData,
        CreatedAt: data.CreatedAt ? new Date(data.CreatedAt) : new Date(),
        UpdatedAt: data.UpdatedAt ? new Date(data.UpdatedAt) : new Date(),
        CreatedBy: data.CreatedBy ? BigInt(data.CreatedBy) : null,
        UpdatedBy: data.UpdatedBy ? BigInt(data.UpdatedBy) : null,
      };
    } catch {
      return null;
    }
  }

  private async savePrefExam(examType: ExamType, aptNum: bigint, record: any) {
    const fkeyType = examType === 'biomechanical' ? 215 : 216;
    const existing = await prisma.userodpref.findFirst({
      where: {
        Fkey: aptNum,
        FkeyType: fkeyType,
      },
    });

    const serialized = {
      PatNum: record.PatNum?.toString(),
      ProvNum: record.ProvNum?.toString(),
      IsSigned: !!record.IsSigned,
      SignedBy: record.SignedBy?.toString(),
      SignedAt: record.SignedAt?.toISOString(),
      ExamData: record.ExamData,
      CreatedAt: record.CreatedAt?.toISOString(),
      UpdatedAt: record.UpdatedAt?.toISOString(),
      CreatedBy: record.CreatedBy?.toString(),
      UpdatedBy: record.UpdatedBy?.toString(),
    };

    const valueString = JSON.stringify(serialized);

    if (existing) {
      const updated = await prisma.userodpref.update({
        where: { UserOdPrefNum: existing.UserOdPrefNum },
        data: { ValueString: valueString },
      });
      return {
        ...record,
        ExamId: updated.UserOdPrefNum,
      };
    } else {
      const nextPrefId = await getNextId('userodpref', 'UserOdPrefNum');
      const created = await prisma.userodpref.create({
        data: {
          UserOdPrefNum: nextPrefId,
          Fkey: aptNum,
          FkeyType: fkeyType,
          ValueString: valueString,
        },
      });
      return {
        ...record,
        ExamId: created.UserOdPrefNum,
      };
    }
  }

  async getExamByAppointment(examType: ExamType, appointmentId: string) {
    const aptNum = BigInt(appointmentId);
    if (examType === 'biomechanical' || examType === 'functional') {
      const record = await this.getPrefExam(examType, aptNum);
      return mapExamRecord(record, examType);
    }

    const model = getModel(examType);
    const record = await model.findUnique({
      where: { AptNum: aptNum }
    });

    return mapExamRecord(record, examType);
  }

  async upsertExam(examType: ExamType, appointmentId: string, data: UpsertExamInput, userId: string) {
    const aptNum = BigInt(appointmentId);
    const patNum = BigInt(data.patientId);
    const provNum = BigInt(data.providerId);
    const userNum = BigInt(userId);
    const examDataJson = data.examData; // object or json

    if (examType === 'biomechanical' || examType === 'functional') {
      const existingRecord = await this.getPrefExam(examType, aptNum);
      if (existingRecord) {
        if (existingRecord.IsSigned) {
          throw new AuthorizationError('Exam is signed and locked. No further edits are allowed.');
        }
        const updatedRecord = {
          ...existingRecord,
          ExamData: examDataJson,
          UpdatedBy: userNum,
          PatNum: patNum,
          ProvNum: provNum,
          UpdatedAt: new Date(),
        };
        const saved = await this.savePrefExam(examType, aptNum, updatedRecord);
        await logActivity(
          userId,
          'updated',
          `exam_${examType}`,
          aptNum.toString(),
          existingRecord,
          saved
        );
        return mapExamRecord(saved, examType);
      } else {
        const newRecord = {
          PatNum: patNum,
          AptNum: aptNum,
          ProvNum: provNum,
          ExamData: examDataJson,
          CreatedBy: userNum,
          UpdatedBy: userNum,
          CreatedAt: new Date(),
          UpdatedAt: new Date(),
          IsSigned: false,
        };
        const saved = await this.savePrefExam(examType, aptNum, newRecord);
        await logActivity(
          userId,
          'created',
          `exam_${examType}`,
          aptNum.toString(),
          null,
          saved
        );
        return mapExamRecord(saved, examType);
      }
    }

    const model = getModel(examType);

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
          ExamData: JSON.stringify(examDataJson),
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
          ExamData: JSON.stringify(examDataJson),
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
    const aptNum = BigInt(appointmentId);
    const userNum = BigInt(userId);

    if (examType === 'biomechanical' || examType === 'functional') {
      const existingRecord = await this.getPrefExam(examType, aptNum);
      if (!existingRecord) {
        throw new NotFoundError(`No ${examType} exam found for appointment ${appointmentId} to sign.`);
      }
      if (existingRecord.IsSigned) {
        throw new BadRequestError('Exam is already signed.');
      }
      const updatedRecord = {
        ...existingRecord,
        IsSigned: true,
        SignedBy: userNum,
        SignedAt: new Date(),
        UpdatedBy: userNum,
        UpdatedAt: new Date(),
      };
      const saved = await this.savePrefExam(examType, aptNum, updatedRecord);
      await logActivity(
        userId,
        'updated',
        `exam_${examType}`,
        aptNum.toString(),
        existingRecord,
        saved
      );
      return mapExamRecord(saved, examType);
    }

    const model = getModel(examType);

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
  async deleteExam(examType: ExamType, appointmentId: string, userId: string) {
  const aptNum = BigInt(appointmentId);

  // Handle pref-based exams (biomechanical & functional)
  if (examType === 'biomechanical' || examType === 'functional') {
    const existingRecord = await this.getPrefExam(examType, aptNum);

    if (!existingRecord) {
      throw new NotFoundError(`No ${examType} exam found for appointment ${appointmentId}.`);
    }

    if (existingRecord.IsSigned) {
      throw new AuthorizationError('Exam is signed and locked. It cannot be deleted.');
    }

    const fkeyType = examType === 'biomechanical' ? 215 : 216;
    await prisma.userodpref.deleteMany({
      where: {
        Fkey: aptNum,
        FkeyType: fkeyType,
      },
    });

    await logActivity(
      userId,
      'deleted',
      `exam_${examType}`,
      aptNum.toString(),
      existingRecord,
      null
    );

    return true;
  }

  // Handle regular exam tables
  const model = getModel(examType);

  const existingRecord = await model.findUnique({
    where: { AptNum: aptNum },
  });

  if (!existingRecord) {
    throw new NotFoundError(`No ${examType} exam found for appointment ${appointmentId}.`);
  }

  if (existingRecord.IsSigned) {
    throw new AuthorizationError('Exam is signed and locked. It cannot be deleted.');
  }

  await model.delete({
    where: { AptNum: aptNum },
  });

  await logActivity(
    userId,
    'deleted',
    `exam_${examType}`,
    aptNum.toString(),
    existingRecord,
    null
  );

  return true;
}
}

export const clinicalExamService = new ClinicalExamService();

