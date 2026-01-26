import mongoose, { Schema, model } from 'mongoose';
import type { Model, InferSchemaType } from 'mongoose';
import { defaultSchemaOptions, stringId } from './base';

const InsuranceCompanySchema = new Schema(
  {
    _id: stringId(),
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    payerId: {
      type: String,
      trim: true,
      uppercase: true,
      unique: true,
      sparse: true,
    },
    phone: { type: String, trim: true },
    addressLine1: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    zipCode: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    ...defaultSchemaOptions,
    collection: 'insurance_companies',
  },
);

InsuranceCompanySchema.index({ name: 1 }, { unique: true });
InsuranceCompanySchema.index({ payerId: 1 }, { unique: true, sparse: true });

export type InsuranceCompany = InferSchemaType<typeof InsuranceCompanySchema>;

export const InsuranceCompanyModel: Model<InsuranceCompany> =
  mongoose.models.InsuranceCompany ?? model<InsuranceCompany>('InsuranceCompany', InsuranceCompanySchema);

