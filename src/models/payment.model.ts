import mongoose, { Schema, model } from 'mongoose';
import type { Model, InferSchemaType } from 'mongoose';
import { defaultSchemaOptions, stringId } from './base';

const PaymentSchema = new Schema(
  {
    _id: stringId(),
    paymentCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    invoiceId: {
      type: String,
      ref: 'Invoice',
      required: true,
      index: true,
    },
    patientId: {
      type: String,
      ref: 'Patient',
      required: true,
      index: true,
    },
    insuranceCompanyId: {
      type: String,
      ref: 'InsuranceCompany',
    },
    amount: {
      type: Number,
      min: 0,
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'check', 'card', 'ach', 'insurance', 'payment_plan'],
      required: true,
    },
    paymentSource: {
      type: String,
      enum: ['patient', 'insurance_company', 'other'],
      default: 'patient',
    },
    paymentDate: {
      type: Date,
      required: true,
    },
    referenceNumber: {
      type: String,
      trim: true,
    },
    processorFee: {
      type: Number,
      min: 0,
      default: 0,
    },
    netAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    notes: {
      type: String,
    },
    createdBy: {
      type: String,
      ref: 'User',
      required: true,
    },
    appliedAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    unappliedAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  {
    ...defaultSchemaOptions,
    collection: 'payments',
  },
);

PaymentSchema.index({ paymentCode: 1 }, { unique: true });
PaymentSchema.index({ paymentDate: -1, paymentMethod: 1 });

export type Payment = InferSchemaType<typeof PaymentSchema>;

export const PaymentModel: Model<Payment> =
  mongoose.models.Payment ?? model<Payment>('Payment', PaymentSchema);

