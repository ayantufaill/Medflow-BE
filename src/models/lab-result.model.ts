import mongoose, { Schema, model } from 'mongoose';
import type { Model, InferSchemaType } from 'mongoose';
import { defaultSchemaOptions, stringId } from './base';

const LabResultSchema = new Schema(
  {
    _id: stringId(),
    labOrderId: {
      type: String,
      ref: 'LabOrder',
      required: true,
      index: true,
    },
    patientId: {
      type: String,
      ref: 'Patient',
      required: true,
      index: true,
    },
    testName: {
      type: String,
      required: true,
    },
    resultValue: {
      type: String,
      required: true,
    },
    normalRange: {
      type: String,
    },
    units: {
      type: String,
    },
    status: {
      type: String,
      enum: ['normal', 'abnormal', 'critical'],
      required: true,
    },
    resultDate: {
      type: Date,
      required: true,
    },
    providerNotes: {
      type: String,
    },
    patientNotified: {
      type: Boolean,
      default: false,
    },
    notificationDate: {
      type: Date,
    },
    reviewedBy: {
      type: String,
      ref: 'Provider',
    },
    reviewedDate: {
      type: Date,
    },
  },
  {
    ...defaultSchemaOptions,
    collection: 'lab_results',
  },
);

LabResultSchema.index({ patientId: 1, resultDate: -1 });

export type LabResult = InferSchemaType<typeof LabResultSchema>;

export const LabResultModel: Model<LabResult> =
  mongoose.models.LabResult ?? model<LabResult>('LabResult', LabResultSchema);

