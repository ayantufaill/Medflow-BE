import { prisma } from '../config/db';
import { NotFoundError, ConflictError, BadRequestError } from '../utils/error.util';
import { logActivity } from '../utils/activity-logger.util';
import { getNextId } from '../utils/opendental-ids.util';
import { mapPatientToApi } from '../utils/opendental-mappers.util';

type VitalsDoc = {
  appointmentId?: string;
  recordedTime?: string;
  recordedBy?: string;
  temperature?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  notes?: string;
};

const parseVitalsDoc = (value?: string | null): VitalsDoc => {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const buildVitalsDoc = (doc: VitalsDoc): string => JSON.stringify(doc);

export class VitalSignService {
  async getAllVitalSigns(
    page = 1,
    limit = 10,
    filters: {
      patientId?: string;
      appointmentId?: string;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filters.patientId) where.PatNum = BigInt(filters.patientId);
    if (filters.appointmentId) {
      where.Documentation = { contains: `"appointmentId":"${filters.appointmentId}"` };
    }

    if (filters.startDate || filters.endDate) {
      where.DateTaken = {};
      if (filters.startDate) where.DateTaken.gte = filters.startDate;
      if (filters.endDate) where.DateTaken.lte = filters.endDate;
    }

    const [rows, total] = await Promise.all([
      prisma.vitalsign.findMany({
        where,
        orderBy: [{ DateTaken: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.vitalsign.count({ where }),
    ]);

    const patientIds = rows
      .map((row) => row.PatNum)
      .filter((id): id is bigint => id !== null && id !== undefined);
    const patients = patientIds.length
      ? await prisma.patient.findMany({ where: { PatNum: { in: patientIds } } })
      : [];
    const patientMap = new Map(patients.map((patient) => [patient.PatNum.toString(), patient]));

    return {
      vitalSigns: rows.map((row) => {
        const doc = parseVitalsDoc(row.Documentation);
        const patient = row.PatNum ? patientMap.get(row.PatNum.toString()) : null;
        return {
          _id: row.VitalsignNum.toString(),
          patientId: row.PatNum?.toString() ?? null,
          appointmentId: doc.appointmentId ?? null,
          bloodPressureSystolic: row.BpSystolic ?? null,
          bloodPressureDiastolic: row.BpDiastolic ?? null,
          temperature: doc.temperature ?? null,
          weight: row.Weight ?? null,
          height: row.Height ?? null,
          heartRate: row.Pulse ?? null,
          respiratoryRate: doc.respiratoryRate ?? null,
          oxygenSaturation: doc.oxygenSaturation ?? null,
          bmi: this.calculateBMI(row.Weight ?? undefined, row.Height ?? undefined),
          recordedDate: row.DateTaken ?? null,
          recordedTime: doc.recordedTime ?? null,
          recordedBy: doc.recordedBy ?? null,
          notes: doc.notes ?? null,
          patient: patient ? mapPatientToApi(patient) : null,
          appointment: null,
          recordedByUser: null,
        };
      }),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getVitalSignById(vitalSignId: string) {
    const vitalSign = await prisma.vitalsign.findUnique({
      where: { VitalsignNum: BigInt(vitalSignId) },
    });

    if (!vitalSign) {
      throw new NotFoundError('Vital sign record not found');
    }

    const doc = parseVitalsDoc(vitalSign.Documentation);
    const patient = vitalSign.PatNum
      ? await prisma.patient.findUnique({ where: { PatNum: vitalSign.PatNum } })
      : null;

    return {
      _id: vitalSign.VitalsignNum.toString(),
      patientId: vitalSign.PatNum?.toString() ?? null,
      appointmentId: doc.appointmentId ?? null,
      bloodPressureSystolic: vitalSign.BpSystolic ?? null,
      bloodPressureDiastolic: vitalSign.BpDiastolic ?? null,
      temperature: doc.temperature ?? null,
      weight: vitalSign.Weight ?? null,
      height: vitalSign.Height ?? null,
      heartRate: vitalSign.Pulse ?? null,
      respiratoryRate: doc.respiratoryRate ?? null,
      oxygenSaturation: doc.oxygenSaturation ?? null,
      bmi: this.calculateBMI(vitalSign.Weight ?? undefined, vitalSign.Height ?? undefined),
      recordedDate: vitalSign.DateTaken ?? null,
      recordedTime: doc.recordedTime ?? null,
      recordedBy: doc.recordedBy ?? null,
      notes: doc.notes ?? null,
      patient: patient ? mapPatientToApi(patient) : null,
      appointment: null,
      recordedByUser: null,
    };
  }

  async getVitalSignsByPatient(patientId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const patient = await prisma.patient.findUnique({
      where: { PatNum: BigInt(patientId) },
    });
    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    const [rows, total] = await Promise.all([
      prisma.vitalsign.findMany({
        where: { PatNum: BigInt(patientId) },
        orderBy: [{ DateTaken: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.vitalsign.count({ where: { PatNum: BigInt(patientId) } }),
    ]);

    return {
      vitalSigns: rows.map((row) => {
        const doc = parseVitalsDoc(row.Documentation);
        return {
          _id: row.VitalsignNum.toString(),
          patientId: row.PatNum?.toString() ?? null,
          appointmentId: doc.appointmentId ?? null,
          bloodPressureSystolic: row.BpSystolic ?? null,
          bloodPressureDiastolic: row.BpDiastolic ?? null,
          temperature: doc.temperature ?? null,
          weight: row.Weight ?? null,
          height: row.Height ?? null,
          heartRate: row.Pulse ?? null,
          respiratoryRate: doc.respiratoryRate ?? null,
          oxygenSaturation: doc.oxygenSaturation ?? null,
          bmi: this.calculateBMI(row.Weight ?? undefined, row.Height ?? undefined),
          recordedDate: row.DateTaken ?? null,
          recordedTime: doc.recordedTime ?? null,
          recordedBy: doc.recordedBy ?? null,
          notes: doc.notes ?? null,
        };
      }),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getVitalSignByAppointment(appointmentId: string) {
    const vitalSign = await prisma.vitalsign.findFirst({
      where: { Documentation: { contains: `"appointmentId":"${appointmentId}"` } },
      orderBy: { DateTaken: 'desc' },
    });
    if (!vitalSign) return null;
    const doc = parseVitalsDoc(vitalSign.Documentation);
    return {
      _id: vitalSign.VitalsignNum.toString(),
      patientId: vitalSign.PatNum?.toString() ?? null,
      appointmentId: doc.appointmentId ?? null,
      bloodPressureSystolic: vitalSign.BpSystolic ?? null,
      bloodPressureDiastolic: vitalSign.BpDiastolic ?? null,
      temperature: doc.temperature ?? null,
      weight: vitalSign.Weight ?? null,
      height: vitalSign.Height ?? null,
      heartRate: vitalSign.Pulse ?? null,
      respiratoryRate: doc.respiratoryRate ?? null,
      oxygenSaturation: doc.oxygenSaturation ?? null,
      bmi: this.calculateBMI(vitalSign.Weight ?? undefined, vitalSign.Height ?? undefined),
      recordedDate: vitalSign.DateTaken ?? null,
      recordedTime: doc.recordedTime ?? null,
      recordedBy: doc.recordedBy ?? null,
      notes: doc.notes ?? null,
    };
  }

  async getLatestVitalsByPatient(patientId: string) {
    const latest = await prisma.vitalsign.findFirst({
      where: { PatNum: BigInt(patientId) },
      orderBy: { DateTaken: 'desc' },
    });
    if (!latest) return null;
    const doc = parseVitalsDoc(latest.Documentation);
    return {
      _id: latest.VitalsignNum.toString(),
      patientId: latest.PatNum?.toString() ?? null,
      appointmentId: doc.appointmentId ?? null,
      bloodPressureSystolic: latest.BpSystolic ?? null,
      bloodPressureDiastolic: latest.BpDiastolic ?? null,
      temperature: doc.temperature ?? null,
      weight: latest.Weight ?? null,
      height: latest.Height ?? null,
      heartRate: latest.Pulse ?? null,
      respiratoryRate: doc.respiratoryRate ?? null,
      oxygenSaturation: doc.oxygenSaturation ?? null,
      bmi: this.calculateBMI(latest.Weight ?? undefined, latest.Height ?? undefined),
      recordedDate: latest.DateTaken ?? null,
      recordedTime: doc.recordedTime ?? null,
      recordedBy: doc.recordedBy ?? null,
      notes: doc.notes ?? null,
    };
  }

  private calculateBMI(weight?: number, height?: number): number | undefined {
    if (!weight || !height || height === 0) return undefined;
    const heightInMeters = height * 0.0254;
    const weightInKg = weight * 0.453592;
    return Math.round((weightInKg / (heightInMeters * heightInMeters)) * 10) / 10;
  }

  async createVitalSign(
    data: {
      patientId: string;
      appointmentId: string;
      bloodPressureSystolic?: number;
      bloodPressureDiastolic?: number;
      temperature?: number;
      weight?: number;
      height?: number;
      heartRate?: number;
      respiratoryRate?: number;
      oxygenSaturation?: number;
      recordedDate: Date;
      recordedTime: string;
      notes?: string;
    },
    userId: string
  ) {
    const patient = await prisma.patient.findUnique({
      where: { PatNum: BigInt(data.patientId) },
    });
    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    const appointment = await prisma.appointment.findUnique({
      where: { AptNum: BigInt(data.appointmentId) },
    });
    if (!appointment) {
      throw new NotFoundError('Appointment not found');
    }

    const existingVitalSign = await prisma.vitalsign.findFirst({
      where: { Documentation: { contains: `"appointmentId":"${data.appointmentId}"` } },
    });

    if (existingVitalSign) {
      throw new ConflictError('Vital signs already recorded for this appointment');
    }

    const bmi = this.calculateBMI(data.weight, data.height);

    const vitalsNum = await getNextId('vitalsign', 'VitalsignNum');
    const documentation = buildVitalsDoc({
      appointmentId: data.appointmentId,
      recordedTime: data.recordedTime,
      recordedBy: userId,
      temperature: data.temperature,
      respiratoryRate: data.respiratoryRate,
      oxygenSaturation: data.oxygenSaturation,
      notes: data.notes,
    });

    const vitalSign = await prisma.vitalsign.create({
      data: {
        VitalsignNum: vitalsNum,
        PatNum: BigInt(data.patientId),
        DateTaken: data.recordedDate,
        BpSystolic: data.bloodPressureSystolic ?? null,
        BpDiastolic: data.bloodPressureDiastolic ?? null,
        Height: data.height ?? null,
        Weight: data.weight ?? null,
        Pulse: data.heartRate ?? null,
        Documentation: documentation,
      },
    });

    await logActivity(
      userId,
      'created',
      'vital_signs',
      vitalSign.VitalsignNum.toString(),
      undefined,
      {
        _id: vitalSign.VitalsignNum.toString(),
        patientId: data.patientId,
        appointmentId: data.appointmentId,
        bloodPressureSystolic: data.bloodPressureSystolic ?? null,
        bloodPressureDiastolic: data.bloodPressureDiastolic ?? null,
        temperature: data.temperature ?? null,
        weight: data.weight ?? null,
        height: data.height ?? null,
        heartRate: data.heartRate ?? null,
        respiratoryRate: data.respiratoryRate ?? null,
        oxygenSaturation: data.oxygenSaturation ?? null,
        bmi,
        recordedDate: data.recordedDate,
        recordedTime: data.recordedTime,
        recordedBy: userId,
        notes: data.notes ?? null,
      },
      undefined,
      undefined,
      'medium'
    );

    return {
      _id: vitalSign.VitalsignNum.toString(),
      patientId: data.patientId,
      appointmentId: data.appointmentId,
      bloodPressureSystolic: data.bloodPressureSystolic ?? null,
      bloodPressureDiastolic: data.bloodPressureDiastolic ?? null,
      temperature: data.temperature ?? null,
      weight: data.weight ?? null,
      height: data.height ?? null,
      heartRate: data.heartRate ?? null,
      respiratoryRate: data.respiratoryRate ?? null,
      oxygenSaturation: data.oxygenSaturation ?? null,
      bmi,
      recordedDate: data.recordedDate,
      recordedTime: data.recordedTime,
      recordedBy: userId,
      notes: data.notes ?? null,
    };
  }

  async updateVitalSign(
    vitalSignId: string,
    updates: {
      bloodPressureSystolic?: number;
      bloodPressureDiastolic?: number;
      temperature?: number;
      weight?: number;
      height?: number;
      heartRate?: number;
      respiratoryRate?: number;
      oxygenSaturation?: number;
      recordedDate?: Date;
      recordedTime?: string;
      notes?: string;
    },
    userId: string
  ) {
    const vitalSign = await prisma.vitalsign.findUnique({
      where: { VitalsignNum: BigInt(vitalSignId) },
    });
    if (!vitalSign) {
      throw new NotFoundError('Vital sign record not found');
    }

    const doc = parseVitalsDoc(vitalSign.Documentation);
    const oldData = {
      _id: vitalSign.VitalsignNum.toString(),
      patientId: vitalSign.PatNum?.toString() ?? null,
      appointmentId: doc.appointmentId ?? null,
      bloodPressureSystolic: vitalSign.BpSystolic ?? null,
      bloodPressureDiastolic: vitalSign.BpDiastolic ?? null,
      temperature: doc.temperature ?? null,
      weight: vitalSign.Weight ?? null,
      height: vitalSign.Height ?? null,
      heartRate: vitalSign.Pulse ?? null,
      respiratoryRate: doc.respiratoryRate ?? null,
      oxygenSaturation: doc.oxygenSaturation ?? null,
      bmi: this.calculateBMI(vitalSign.Weight ?? undefined, vitalSign.Height ?? undefined),
      recordedDate: vitalSign.DateTaken ?? null,
      recordedTime: doc.recordedTime ?? null,
      recordedBy: doc.recordedBy ?? null,
      notes: doc.notes ?? null,
    };

    const newWeight = updates.weight ?? vitalSign.Weight ?? undefined;
    const newHeight = updates.height ?? vitalSign.Height ?? undefined;
    const bmi = this.calculateBMI(newWeight, newHeight);
    const nextDoc = buildVitalsDoc({
      appointmentId: doc.appointmentId,
      recordedTime: updates.recordedTime ?? doc.recordedTime,
      recordedBy: doc.recordedBy ?? userId,
      temperature: updates.temperature ?? doc.temperature,
      respiratoryRate: updates.respiratoryRate ?? doc.respiratoryRate,
      oxygenSaturation: updates.oxygenSaturation ?? doc.oxygenSaturation,
      notes: updates.notes ?? doc.notes,
    });

    const updated = await prisma.vitalsign.update({
      where: { VitalsignNum: BigInt(vitalSignId) },
      data: {
        DateTaken: updates.recordedDate ?? undefined,
        BpSystolic: updates.bloodPressureSystolic ?? undefined,
        BpDiastolic: updates.bloodPressureDiastolic ?? undefined,
        Height: updates.height ?? undefined,
        Weight: updates.weight ?? undefined,
        Pulse: updates.heartRate ?? undefined,
        Documentation: nextDoc,
      },
    });

    await logActivity(
      userId,
      'updated',
      'vital_signs',
      vitalSignId,
      oldData,
      {
        _id: updated.VitalsignNum.toString(),
        patientId: updated.PatNum?.toString() ?? null,
        appointmentId: doc.appointmentId ?? null,
        bloodPressureSystolic: updated.BpSystolic ?? null,
        bloodPressureDiastolic: updated.BpDiastolic ?? null,
        temperature: updates.temperature ?? doc.temperature ?? null,
        weight: updated.Weight ?? null,
        height: updated.Height ?? null,
        heartRate: updated.Pulse ?? null,
        respiratoryRate: updates.respiratoryRate ?? doc.respiratoryRate ?? null,
        oxygenSaturation: updates.oxygenSaturation ?? doc.oxygenSaturation ?? null,
        bmi,
        recordedDate: updated.DateTaken ?? null,
        recordedTime: updates.recordedTime ?? doc.recordedTime ?? null,
        recordedBy: doc.recordedBy ?? userId,
        notes: updates.notes ?? doc.notes ?? null,
      },
      undefined,
      undefined,
      'medium'
    );

    return {
      _id: updated.VitalsignNum.toString(),
      patientId: updated.PatNum?.toString() ?? null,
      appointmentId: doc.appointmentId ?? null,
      bloodPressureSystolic: updated.BpSystolic ?? null,
      bloodPressureDiastolic: updated.BpDiastolic ?? null,
      temperature: updates.temperature ?? doc.temperature ?? null,
      weight: updated.Weight ?? null,
      height: updated.Height ?? null,
      heartRate: updated.Pulse ?? null,
      respiratoryRate: updates.respiratoryRate ?? doc.respiratoryRate ?? null,
      oxygenSaturation: updates.oxygenSaturation ?? doc.oxygenSaturation ?? null,
      bmi,
      recordedDate: updated.DateTaken ?? null,
      recordedTime: updates.recordedTime ?? doc.recordedTime ?? null,
      recordedBy: doc.recordedBy ?? userId,
      notes: updates.notes ?? doc.notes ?? null,
    };
  }

  async deleteVitalSign(vitalSignId: string, userId: string) {
    const vitalSign = await prisma.vitalsign.findUnique({
      where: { VitalsignNum: BigInt(vitalSignId) },
    });
    if (!vitalSign) {
      throw new NotFoundError('Vital sign record not found');
    }

    const doc = parseVitalsDoc(vitalSign.Documentation);
    const oldData = {
      _id: vitalSign.VitalsignNum.toString(),
      patientId: vitalSign.PatNum?.toString() ?? null,
      appointmentId: doc.appointmentId ?? null,
      bloodPressureSystolic: vitalSign.BpSystolic ?? null,
      bloodPressureDiastolic: vitalSign.BpDiastolic ?? null,
      temperature: doc.temperature ?? null,
      weight: vitalSign.Weight ?? null,
      height: vitalSign.Height ?? null,
      heartRate: vitalSign.Pulse ?? null,
      respiratoryRate: doc.respiratoryRate ?? null,
      oxygenSaturation: doc.oxygenSaturation ?? null,
      bmi: this.calculateBMI(vitalSign.Weight ?? undefined, vitalSign.Height ?? undefined),
      recordedDate: vitalSign.DateTaken ?? null,
      recordedTime: doc.recordedTime ?? null,
      recordedBy: doc.recordedBy ?? null,
      notes: doc.notes ?? null,
    };

    await prisma.vitalsign.delete({ where: { VitalsignNum: BigInt(vitalSignId) } });

    await logActivity(
      userId,
      'deleted',
      'vital_signs',
      vitalSignId,
      oldData,
      undefined,
      undefined,
      undefined,
      'medium'
    );

    return { message: 'Vital sign record deleted successfully' };
  }

  async getVitalsTrend(patientId: string, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const vitals = await prisma.vitalsign.findMany({
      where: {
        PatNum: BigInt(patientId),
        DateTaken: { gte: startDate },
      },
      orderBy: [{ DateTaken: 'asc' }],
    });

    return vitals.map((row) => {
      const doc = parseVitalsDoc(row.Documentation);
      return {
        _id: row.VitalsignNum.toString(),
        patientId: row.PatNum?.toString() ?? null,
        appointmentId: doc.appointmentId ?? null,
        bloodPressureSystolic: row.BpSystolic ?? null,
        bloodPressureDiastolic: row.BpDiastolic ?? null,
        temperature: doc.temperature ?? null,
        weight: row.Weight ?? null,
        height: row.Height ?? null,
        heartRate: row.Pulse ?? null,
        respiratoryRate: doc.respiratoryRate ?? null,
        oxygenSaturation: doc.oxygenSaturation ?? null,
        bmi: this.calculateBMI(row.Weight ?? undefined, row.Height ?? undefined),
        recordedDate: row.DateTaken ?? null,
        recordedTime: doc.recordedTime ?? null,
        recordedBy: doc.recordedBy ?? null,
        notes: doc.notes ?? null,
      };
    });
  }
}

export const vitalSignService = new VitalSignService();
