import mongoose, { Schema, model } from 'mongoose';
import type { Model, InferSchemaType } from 'mongoose';
import { defaultSchemaOptions, stringId } from './base';

const VitalSignSchema = new Schema(
  {
    _id: stringId(),
    patientId: {
      type: String,
      ref: 'Patient',
      required: true,
      index: true,
    },
    appointmentId: {
      type: String,
      ref: 'Appointment',
      required: true,
      index: true,
    },
    bloodPressureSystolic: {
      type: Number,
    },
    bloodPressureDiastolic: {
      type: Number,
    },
    temperature: {
      type: Number,
    },
    weight: {
      type: Number,
    },
    height: {
      type: Number,
    },
    heartRate: {
      type: Number,
    },
    respiratoryRate: {
      type: Number,
    },
    oxygenSaturation: {
      type: Number,
    },
    bmi: {
      type: Number,
    },
    recordedDate: {
      type: Date,
      required: true,
    },
    recordedTime: {
      type: String,
      required: true,
    },
    recordedBy: {
      type: String,
      ref: 'User',
    },
    notes: {
      type: String,
    },
  },
  {
    ...defaultSchemaOptions,
    collection: 'vital_signs',
  },
);

VitalSignSchema.index({ patientId: 1, recordedDate: -1 });

export type VitalSign = InferSchemaType<typeof VitalSignSchema>;

export const VitalSignModel: Model<VitalSign> =
  mongoose.models.VitalSign ?? model<VitalSign>('VitalSign', VitalSignSchema);

