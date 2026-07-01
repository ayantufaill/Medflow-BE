import { prisma } from '../config/db';
import { NotFoundError, BadRequestError, AuthorizationError } from '../utils/error.util';
import { logActivity } from '../utils/activity-logger.util';
import { ExamType, UpsertExamInput } from '../types/clinical-exam.types';
import { getNextId } from '../utils/opendental-ids.util';

const getModel = (examType: ExamType) => {
  const modelMap: Record<string, any> = {
    'radiographic': prisma.examradiographic,
    'tmj': prisma.examtmj,
    'head-neck': prisma.examheadneck,
    'tooth-structure': prisma.examtoothstructure,
    'teeth-structure': prisma.examtoothstructure,
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
    examData: record.ExamData ? (typeof record.ExamData === 'string' ? JSON.parse(record.ExamData) : record.ExamData) : null,
    createdAt: record.CreatedAt,
    updatedAt: record.UpdatedAt,
    createdBy: record.CreatedBy?.toString(),
    updatedBy: record.UpdatedBy?.toString(),
  };
};

export class ClinicalExamService {
  
  private getFkeyType(examType: ExamType): number {
    switch (examType) {
      case 'biomechanical':
        return 215;
      case 'functional':
        return 216;
      case 'dentofacial-opinion':
        return 217;
      case 'periodontal-opinion':
        return 218;
      default:
        return 216;
    }
  }

  private async getPrefExam(examType: ExamType, aptNum: bigint) {
    const fkeyType = this.getFkeyType(examType);
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
    const fkeyType = this.getFkeyType(examType);
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
    if (examType === 'biomechanical' || examType === 'functional' || examType === 'dentofacial-opinion' || examType === 'periodontal-opinion') {
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

    // Guard: ensure examData is serialized correctly (prevent double-stringify)
    const examDataStr = typeof examDataJson === 'string'
      ? examDataJson
      : JSON.stringify(examDataJson);

    // Payload size validation (reject > 10MB)
    if (examDataStr.length > 10_000_000) {
      throw new BadRequestError('examData payload exceeds maximum allowed size (10MB).');
    }

    if (examType === 'biomechanical' || examType === 'functional' || examType === 'dentofacial-opinion' || examType === 'periodontal-opinion') {
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
          ExamData: examDataStr,
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
          ExamData: examDataStr,
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

    if (examType === 'biomechanical' || examType === 'functional' || examType === 'dentofacial-opinion' || examType === 'periodontal-opinion') {
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

  // Handle pref-based exams (biomechanical, functional, opinions)
  if (examType === 'biomechanical' || examType === 'functional' || examType === 'dentofacial-opinion' || examType === 'periodontal-opinion') {
    const existingRecord = await this.getPrefExam(examType, aptNum);

    if (!existingRecord) {
      throw new NotFoundError(`No ${examType} exam found for appointment ${appointmentId}.`);
    }

    if (existingRecord.IsSigned) {
      throw new AuthorizationError('Exam is signed and locked. It cannot be deleted.');
    }

    const fkeyType = this.getFkeyType(examType);
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

  async getExamHistoryDates(examType: ExamType, patientId: string): Promise<{ date: Date; appointmentId: string }[]> {
    const patNum = BigInt(patientId);

    // Handle pref-based exams (biomechanical, functional, opinions)
    if (examType === 'biomechanical' || examType === 'functional' || examType === 'dentofacial-opinion' || examType === 'periodontal-opinion') {
      const fkeyType = this.getFkeyType(examType);
      const prefs = await prisma.userodpref.findMany({
        where: {
          FkeyType: fkeyType,
        },
      });

      const results: { date: Date; appointmentId: string }[] = [];
      for (const pref of prefs) {
        if (!pref.ValueString) continue;
        try {
          const data = JSON.parse(pref.ValueString);
          if (data.PatNum && BigInt(data.PatNum) === patNum) {
            if (data.CreatedAt) {
              results.push({
                date: new Date(data.CreatedAt),
                appointmentId: pref.Fkey?.toString() || '',
              });
            }
          }
        } catch {
          // ignore parsing error
        }
      }

      // Sort in ascending chronological order (oldest to newest)
      return results.sort((a, b) => a.date.getTime() - b.date.getTime());
    }

    // Handle regular exam tables
    const model = getModel(examType);
    if (!model) {
      throw new BadRequestError(`Invalid examType: ${examType}`);
    }

    const records = await model.findMany({
      where: { PatNum: patNum },
      select: { CreatedAt: true, AptNum: true },
      orderBy: { CreatedAt: 'asc' },
    });

    return records.map((r: any) => ({
      date: r.CreatedAt,
      appointmentId: r.AptNum?.toString() || '',
    }));
  }
}

export const clinicalExamService = new ClinicalExamService();

