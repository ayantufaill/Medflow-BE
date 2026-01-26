import mongoose, { Schema, model } from 'mongoose';
import type { Model, InferSchemaType } from 'mongoose';
import { defaultSchemaOptions, stringId } from './base';

const TreatmentPlanSchema = new Schema(
  {
    _id: stringId(),
    patientId: {
      type: String,
      ref: 'Patient',
      required: true,
      index: true,
    },
    providerId: {
      type: String,
      ref: 'Provider',
      required: true,
    },
    diagnosis: {
      type: String,
      required: true,
    },
    icd10Codes: {
      type: [String],
      default: [],
    },
    treatmentGoals: {
      type: String,
      required: true,
    },
    interventions: {
      type: String,
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    targetCompletionDate: {
      type: Date,
    },
    actualCompletionDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'modified', 'cancelled'],
      default: 'active',
    },
    progressNotes: {
      type: String,
    },
    outcomeMeasures: {
      type: Schema.Types.Mixed,
    },
    createdBy: {
      type: String,
      ref: 'User',
      required: true,
    },
  },
  {
    ...defaultSchemaOptions,
    collection: 'treatment_plans',
  },
);

TreatmentPlanSchema.index({ patientId: 1, status: 1 });

export type TreatmentPlan = InferSchemaType<typeof TreatmentPlanSchema>;

export const TreatmentPlanModel: Model<TreatmentPlan> =
  mongoose.models.TreatmentPlan ?? model<TreatmentPlan>('TreatmentPlan', TreatmentPlanSchema);

