import mongoose, { Schema, model } from 'mongoose';
import type { Model, InferSchemaType } from 'mongoose';
import { defaultSchemaOptions, stringId } from './base';

const PatientInsuranceSchema = new Schema(
  {
    _id: stringId(),
    patientId: {
      type: String,
      ref: 'Patient',
      required: true,
      index: true,
    },
    insuranceCompanyId: {
      type: String,
      ref: 'InsuranceCompany',
      required: true,
      index: true,
    },
    policyNumber: {
      type: String,
      required: true,
      trim: true,
    },
    groupNumber: {
      type: String,
      trim: true,
    },
    subscriberName: {
      type: String,
      trim: true,
      required: true,
    },
    subscriberDateOfBirth: {
      type: Date,
      required: true,
    },
    relationshipToPatient: {
      type: String,
      enum: ['self', 'spouse', 'child', 'parent', 'other'],
      default: 'self',
      required: true,
    },
    insuranceType: {
      type: String,
      enum: ['primary', 'secondary', 'tertiary'],
      default: 'primary',
      required: true,
    },
    effectiveDate: {
      type: Date,
      required: true,
    },
    expirationDate: {
      type: Date,
    },
    copayAmount: {
      type: Number,
      min: 0,
    },
    deductibleAmount: {
      type: Number,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    autoVerify: {
      type: Boolean,
      default: true,
    },
    verificationStatus: {
      type: String,
      enum: ['verified', 'pending', 'failed'],
      default: 'pending',
    },
    verificationDate: {
      type: Date,
    },
    verifiedBy: {
      type: String,
      ref: 'User',
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    ...defaultSchemaOptions,
    collection: 'patient_insurance',
  },
);

PatientInsuranceSchema.index({ patientId: 1, insuranceType: 1, isActive: 1 });
PatientInsuranceSchema.index(
  { patientId: 1, insuranceType: 1 },
  { unique: true, partialFilterExpression: { isActive: true } },
);

export type PatientInsurance = InferSchemaType<typeof PatientInsuranceSchema>;

export const PatientInsuranceModel: Model<PatientInsurance> =
  mongoose.models.PatientInsurance ?? model<PatientInsurance>('PatientInsurance', PatientInsuranceSchema);

