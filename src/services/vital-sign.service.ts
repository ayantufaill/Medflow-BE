import { VitalSignModel, VitalSign } from '../models/vital-sign.model';
import { PatientModel } from '../models/patient.model';
import { AppointmentModel } from '../models/appointment.model';
import { NotFoundError, ConflictError, BadRequestError } from '../utils/error.util';
import { logActivity } from '../utils/activity-logger.util';

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
    const query: any = {};

    if (filters.patientId) query.patientId = filters.patientId;
    if (filters.appointmentId) query.appointmentId = filters.appointmentId;

    if (filters.startDate || filters.endDate) {
      query.recordedDate = {};
      if (filters.startDate) query.recordedDate.$gte = filters.startDate;
      if (filters.endDate) query.recordedDate.$lte = filters.endDate;
    }

    const [vitalSigns, total] = await Promise.all([
      VitalSignModel.find(query)
        .sort({ recordedDate: -1, recordedTime: -1 })
        .skip(skip)
        .limit(limit)
        .populate('patientId', 'firstName lastName dateOfBirth')
        .populate('appointmentId', 'appointmentDate startTime')
        .populate('recordedBy', 'firstName lastName')
        .lean(),
      VitalSignModel.countDocuments(query),
    ]);

    return {
      vitalSigns,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getVitalSignById(vitalSignId: string) {
    const vitalSign = await VitalSignModel.findById(vitalSignId)
      .populate('patientId', 'firstName lastName dateOfBirth')
      .populate('appointmentId', 'appointmentDate startTime')
      .populate('recordedBy', 'firstName lastName')
      .lean();

    if (!vitalSign) {
      throw new NotFoundError('Vital sign record not found');
    }

    return vitalSign;
  }

  async getVitalSignsByPatient(patientId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const patient = await PatientModel.findById(patientId).lean();
    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    const [vitalSigns, total] = await Promise.all([
      VitalSignModel.find({ patientId })
        .sort({ recordedDate: -1, recordedTime: -1 })
        .skip(skip)
        .limit(limit)
        .populate('appointmentId', 'appointmentDate startTime')
        .populate('recordedBy', 'firstName lastName')
        .lean(),
      VitalSignModel.countDocuments({ patientId }),
    ]);

    return {
      vitalSigns,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getVitalSignByAppointment(appointmentId: string) {
    const vitalSign = await VitalSignModel.findOne({ appointmentId })
      .populate('patientId', 'firstName lastName dateOfBirth')
      .populate('recordedBy', 'firstName lastName')
      .lean();

    return vitalSign;
  }

  async getLatestVitalsByPatient(patientId: string) {
    const latestVitals = await VitalSignModel.findOne({ patientId })
      .sort({ recordedDate: -1, recordedTime: -1 })
      .populate('recordedBy', 'firstName lastName')
      .lean();

    return latestVitals;
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
    const patient = await PatientModel.findById(data.patientId).lean();
    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    const appointment = await AppointmentModel.findById(data.appointmentId).lean();
    if (!appointment) {
      throw new NotFoundError('Appointment not found');
    }

    const existingVitalSign = await VitalSignModel.findOne({
      appointmentId: data.appointmentId,
    }).lean();

    if (existingVitalSign) {
      throw new ConflictError('Vital signs already recorded for this appointment');
    }

    const bmi = this.calculateBMI(data.weight, data.height);

    const vitalSign = await VitalSignModel.create({
      ...data,
      bmi,
      recordedBy: userId,
    });

    await logActivity(
      userId,
      'created',
      'vital_signs',
      String(vitalSign._id),
      undefined,
      vitalSign.toObject(),
      undefined,
      undefined,
      'medium'
    );

    return vitalSign;
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
    const vitalSign = await VitalSignModel.findById(vitalSignId);
    if (!vitalSign) {
      throw new NotFoundError('Vital sign record not found');
    }

    const oldData = vitalSign.toObject();

    Object.assign(vitalSign, updates);

    const vitalObj = vitalSign.toObject() as any;
    const newWeight = updates.weight ?? vitalObj.weight;
    const newHeight = updates.height ?? vitalObj.height;
    const bmi = this.calculateBMI(newWeight, newHeight);
    if (bmi !== undefined) {
      (vitalSign as any).bmi = bmi;
    }

    await vitalSign.save();

    await logActivity(
      userId,
      'updated',
      'vital_signs',
      vitalSignId,
      oldData,
      vitalSign.toObject(),
      undefined,
      undefined,
      'medium'
    );

    return vitalSign;
  }

  async deleteVitalSign(vitalSignId: string, userId: string) {
    const vitalSign = await VitalSignModel.findById(vitalSignId);
    if (!vitalSign) {
      throw new NotFoundError('Vital sign record not found');
    }

    const oldData = vitalSign.toObject();

    await VitalSignModel.deleteOne({ _id: vitalSignId });

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

    const vitals = await VitalSignModel.find({
      patientId,
      recordedDate: { $gte: startDate },
    })
      .sort({ recordedDate: 1, recordedTime: 1 })
      .lean();

    return vitals;
  }
}

export const vitalSignService = new VitalSignService();
