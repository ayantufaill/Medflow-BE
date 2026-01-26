import mongoose, { Schema, model } from 'mongoose';
import type { Model, InferSchemaType } from 'mongoose';
import { defaultSchemaOptions, stringId } from './base';

const ServiceSchema = new Schema(
  {
    _id: stringId(),
    cptCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
    },
    defaultPrice: {
      type: Number,
      min: 0,
      required: true,
    },
    durationMinutes: {
      type: Number,
      min: 5,
      default: 30,
    },
    category: {
      type: String,
      trim: true,
    },
    requiresAuthorization: {
      type: Boolean,
      default: false,
    },
    isBillable: {
      type: Boolean,
      default: true,
    },
    taxRate: {
      type: Number,
      min: 0,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    ...defaultSchemaOptions,
    collection: 'services',
  },
);

ServiceSchema.index({ cptCode: 1 }, { unique: true });
ServiceSchema.index({ category: 1, isActive: 1 });

export type Service = InferSchemaType<typeof ServiceSchema>;

export const ServiceModel: Model<Service> =
  mongoose.models.Service ?? model<Service>('Service', ServiceSchema);

