import mongoose, { Schema, model } from 'mongoose';
import type { Model, InferSchemaType } from 'mongoose';
import { defaultSchemaOptions, stringId } from './base';

const AddressSchema = new Schema(
  {
    line1: { type: String, trim: true },
    line2: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    postalCode: { type: String, trim: true },
  },
  { _id: false },
);

const PracticeInfoSchema = new Schema(
  {
    _id: stringId(),
    practiceName: {
      type: String,
      required: true,
      trim: true,
    },
    taxId: {
      type: String,
      trim: true,
      unique: true,
    },
    npiNumber: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    phone: {
      type: String,
      trim: true,
      required: true,
    },
    fax: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      required: true,
    },
    website: {
      type: String,
      trim: true,
    },
    address: {
      type: AddressSchema,
      required: true,
    },
    logoPath: {
      type: String,
      trim: true,
    },
    businessHours: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {},
    },
    timezone: {
      type: String,
      default: 'UTC',
    },
    appointmentBufferMinutes: {
      type: Number,
      min: 0,
      default: 0,
    },
    billingContactEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    updatedBy: {
      type: String,
      ref: 'User',
    },
  },
  {
    ...defaultSchemaOptions,
    collection: 'practice_info',
  },
);

export type PracticeInfo = InferSchemaType<typeof PracticeInfoSchema>;

export const PracticeInfoModel: Model<PracticeInfo> =
  mongoose.models.PracticeInfo ?? model<PracticeInfo>('PracticeInfo', PracticeInfoSchema);

