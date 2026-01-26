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

const EmergencyContactSchema = new Schema(
  {
    name: { type: String, trim: true },
    relationship: { type: String, trim: true },
    phone: { type: String, trim: true },
  },
  { _id: false },
);

const PatientSchema = new Schema(
  {
    _id: stringId(),
    patientCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    userAccountId: {
      type: String,
      ref: 'User',
      index: true,
    },
    firstName: { type: String, required: true, trim: true },
    middleName: { type: String, trim: true },
    lastName: { type: String, required: true, trim: true },
    preferredName: { type: String, trim: true },
    dateOfBirth: { type: Date, required: true },
    gender: {
      type: String,
      enum: ['male', 'female', 'non_binary', 'prefer_not_to_say', 'unknown'],
      default: 'unknown',
    },
    ssn: {
      type: String,
      trim: true,
    },
    phonePrimary: { type: String, trim: true },
    phoneSecondary: { type: String, trim: true },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    address: AddressSchema,
    emergencyContact: EmergencyContactSchema,
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    preferredLanguage: {
      type: String,
      trim: true,
      default: 'en',
      lowercase: true,
    },
    communicationPreference: {
      type: String,
      enum: ['phone', 'email', 'sms', 'portal'],
      default: 'phone',
    },
    portalAccessEnabled: {
      type: Boolean,
      default: false,
    },
    lastVisitDate: {
      type: Date,
    },
    referralSource: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    customFields: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    ...defaultSchemaOptions,
    collection: 'patients',
  },
);

PatientSchema.index({ lastName: 1, firstName: 1 });
PatientSchema.index({ email: 1 }, { partialFilterExpression: { email: { $exists: true } } });

export type Patient = InferSchemaType<typeof PatientSchema>;

export const PatientModel: Model<Patient> =
  mongoose.models.Patient ?? model<Patient>('Patient', PatientSchema);

