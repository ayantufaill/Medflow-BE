import mongoose, { Schema, model } from 'mongoose';
import type { Model, InferSchemaType } from 'mongoose';
import { defaultSchemaOptions, stringId } from './base';

const PatientFormSchema = new Schema(
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
    },
    formTemplateId: {
      type: String,
      ref: 'FormTemplate',
      required: true,
    },
    formData: {
      type: Schema.Types.Mixed,
      required: true,
    },
    status: {
      type: String,
      enum: ['incomplete', 'completed', 'reviewed'],
      default: 'incomplete',
    },
    completedDate: {
      type: Date,
    },
    ipAddress: {
      type: String,
    },
    completionTimeSeconds: {
      type: Number,
      min: 0,
    },
    reviewedBy: {
      type: String,
      ref: 'User',
    },
    reviewedDate: {
      type: Date,
    },
  },
  {
    ...defaultSchemaOptions,
    collection: 'patient_forms',
  },
);

PatientFormSchema.index({ patientId: 1, formTemplateId: 1, status: 1 });

export type PatientForm = InferSchemaType<typeof PatientFormSchema>;

export const PatientFormModel: Model<PatientForm> =
  mongoose.models.PatientForm ?? model<PatientForm>('PatientForm', PatientFormSchema);

