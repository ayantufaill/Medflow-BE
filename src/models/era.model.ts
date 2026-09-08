import mongoose, { Schema, model } from 'mongoose';
import type { Model, InferSchemaType } from 'mongoose';
import { defaultSchemaOptions, stringId } from './base';

const EraSchema = new Schema(
  {
    _id: stringId(),
    fileName: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['imported', 'processing', 'processed', 'failed'],
      default: 'imported',
    },
    totalRecords: {
      type: Number,
      min: 0,
      default: 0,
    },
    matchedCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    unmatchedCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    rawData: {
      type: Schema.Types.Mixed,
    },
    importedBy: {
      type: String,
      ref: 'User',
    },
  },
  {
    ...defaultSchemaOptions,
    collection: 'era',
  }
);

EraSchema.index({ status: 1, createdAt: -1 });

export type ERA = InferSchemaType<typeof EraSchema>;

export const ERAModel: Model<ERA> = mongoose.models.ERA ?? model<ERA>('ERA', EraSchema);
