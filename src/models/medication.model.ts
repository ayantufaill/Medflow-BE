import mongoose, { Schema, model } from 'mongoose';
import type { Model, InferSchemaType } from 'mongoose';
import { defaultSchemaOptions, stringId } from './base';

const MedicationSchema = new Schema(
  {
    _id: stringId(),
    drugName: {
      type: String,
      required: true,
      trim: true,
    },
    genericName: {
      type: String,
      trim: true,
    },
    dosageForms: {
      type: [String],
      default: [],
    },
    strengths: {
      type: [String],
      default: [],
    },
    ndcNumber: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    isControlled: {
      type: Boolean,
      default: false,
    },
    deaSchedule: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    ...defaultSchemaOptions,
    collection: 'medications',
  },
);

MedicationSchema.index({ drugName: 1 });

export type Medication = InferSchemaType<typeof MedicationSchema>;

export const MedicationModel: Model<Medication> =
  mongoose.models.Medication ?? model<Medication>('Medication', MedicationSchema);

