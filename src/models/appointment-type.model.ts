import mongoose, { Schema, model } from 'mongoose';
import type { Model, InferSchemaType } from 'mongoose';
import { defaultSchemaOptions, stringId } from './base';

const AppointmentTypeSchema = new Schema(
  {
    _id: stringId(),
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
    },
    defaultDuration: {
      type: Number,
      required: true,
      min: 5,
    },
    defaultPrice: {
      type: Number,
      min: 0,
    },
    colorCode: {
      type: String,
      trim: true,
    },
    requiresAuthorization: {
      type: Boolean,
      default: false,
    },
    bufferBefore: {
      type: Number,
      min: 0,
      default: 0,
    },
    bufferAfter: {
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
    collection: 'appointment_types',
  },
);

export type AppointmentType = InferSchemaType<typeof AppointmentTypeSchema>;

export const AppointmentTypeModel: Model<AppointmentType> =
  mongoose.models.AppointmentType ?? model<AppointmentType>('AppointmentType', AppointmentTypeSchema);

