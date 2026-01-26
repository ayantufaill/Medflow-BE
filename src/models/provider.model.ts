import mongoose, { Schema, model } from 'mongoose';
import type { Model, InferSchemaType } from 'mongoose';
import { defaultSchemaOptions, stringId } from './base';

const WorkingHoursSchema = new Schema(
  {
    dayOfWeek: { type: Number, min: 0, max: 6, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    isAvailable: { type: Boolean, default: true },
  },
  { _id: false },
);

const ProviderSchema = new Schema(
  {
    _id: stringId(),
    userId: {
      type: String,
      ref: 'User',
      required: true,
      unique: true,
    },
    providerCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    npiNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    licenseNumber: {
      type: String,
      trim: true,
    },
    specialty: {
      type: [{ type: String, trim: true }],
      default: [],
    },
    title: {
      type: String,
      enum: ['MD', 'DO', 'NP', 'PA', 'RN', 'LPN', 'Other'],
      default: 'MD',
    },
    appointmentBufferMinutes: {
      type: Number,
      min: 0,
      default: 15,
    },
    maxDailyAppointments: {
      type: Number,
      min: 0,
    },
    consultationFee: {
      type: Number,
      min: 0,
    },
    isAcceptingNewPatients: {
      type: Boolean,
      default: true,
    },
    workingHours: {
      type: [WorkingHoursSchema],
      default: [],
    },
    telehealthEnabled: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    ...defaultSchemaOptions,
    collection: 'providers',
  },
);

ProviderSchema.index({ specialty: 1, isActive: 1 });
ProviderSchema.index({ npiNumber: 1 }, { unique: true });

export type Provider = InferSchemaType<typeof ProviderSchema>;

export const ProviderModel: Model<Provider> =
  mongoose.models.Provider ?? model<Provider>('Provider', ProviderSchema);

