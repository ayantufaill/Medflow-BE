import mongoose, { Schema, model } from 'mongoose';
import type { Model, InferSchemaType } from 'mongoose';
import { defaultSchemaOptions, stringId } from './base';

const AuthorizationSchema = new Schema(
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
    serviceId: {
      type: String,
      ref: 'Service',
      required: true,
      index: true,
    },
    authorizationNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    requestedDate: {
      type: Date,
      required: true,
    },
    approvedDate: {
      type: Date,
    },
    expirationDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'denied', 'expired'],
      default: 'pending',
    },
    unitsAuthorized: {
      type: Number,
      min: 0,
    },
    unitsUsed: {
      type: Number,
      min: 0,
      default: 0,
    },
    notes: {
      type: String,
    },
    requestedBy: {
      type: String,
      ref: 'User',
    },
  },
  {
    ...defaultSchemaOptions,
    collection: 'authorizations',
  },
);

AuthorizationSchema.index({ patientId: 1, serviceId: 1, status: 1 });

export type Authorization = InferSchemaType<typeof AuthorizationSchema>;

export const AuthorizationModel: Model<Authorization> =
  mongoose.models.Authorization ?? model<Authorization>('Authorization', AuthorizationSchema);

