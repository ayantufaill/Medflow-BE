import mongoose, { Schema, model } from 'mongoose';
import type { Model, InferSchemaType } from 'mongoose';
import { defaultSchemaOptions, stringId } from './base';

const ClaimSchema = new Schema(
  {
    _id: stringId(),
    invoiceId: {
      type: String,
      ref: 'Invoice',
      required: true,
      index: true,
    },
    insuranceCompanyId: {
      type: String,
      ref: 'InsuranceCompany',
      required: true,
    },
    claimNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    submissionDate: {
      type: Date,
      required: true,
    },
    submittedAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    paidAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    patientResponsibility: {
      type: Number,
      min: 0,
      default: 0,
    },
    status: {
      type: String,
      enum: ['draft', 'submitted', 'accepted', 'denied', 'partially_paid', 'paid'],
      default: 'draft',
    },
    denialReason: {
      type: String,
    },
    denialCode: {
      type: String,
    },
    resubmissionCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    payerType: {
      type: String,
      enum: ['primary', 'secondary', 'tertiary'],
      default: 'primary',
      index: true,
    },
    clearinghouse: {
      type: String,
    },
    claimData: {
      type: Schema.Types.Mixed,
    },
    createdBy: {
      type: String,
      ref: 'User',
      required: true,
    },
  },
  {
    ...defaultSchemaOptions,
    collection: 'claims',
  },
);

ClaimSchema.index({ insuranceCompanyId: 1, status: 1 });

export type Claim = InferSchemaType<typeof ClaimSchema>;

export const ClaimModel: Model<Claim> = mongoose.models.Claim ?? model<Claim>('Claim', ClaimSchema);

