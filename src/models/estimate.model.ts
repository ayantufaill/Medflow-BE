import mongoose, { Schema, model } from 'mongoose';
import type { Model, InferSchemaType } from 'mongoose';
import { defaultSchemaOptions, stringId } from './base';

const EstimateSchema = new Schema(
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
    },
    estimateNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    estimatedAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    insurancePortion: {
      type: Number,
      min: 0,
      default: 0,
    },
    patientPortion: {
      type: Number,
      min: 0,
      default: 0,
    },
    status: {
      type: String,
      enum: ['draft', 'sent', 'approved', 'converted', 'expired'],
      default: 'draft',
    },
    createdDate: {
      type: Date,
      required: true,
    },
    expirationDate: {
      type: Date,
      required: true,
    },
    approvedDate: {
      type: Date,
    },
    patientResponseToken: {
      type: String,
      trim: true,
      sparse: true,
    },
    patientResponseTokenExpiresAt: {
      type: Date,
    },
    convertedToInvoiceId: {
      type: String,
      ref: 'Invoice',
    },
    createdBy: {
      type: String,
      ref: 'User',
      required: true,
    },
  },
  {
    ...defaultSchemaOptions,
    collection: 'estimates',
  },
);

EstimateSchema.index({ patientId: 1, createdDate: -1 });

export type Estimate = InferSchemaType<typeof EstimateSchema>;

export const EstimateModel: Model<Estimate> =
  mongoose.models.Estimate ?? model<Estimate>('Estimate', EstimateSchema);

