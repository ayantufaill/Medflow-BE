import mongoose, { Schema, model } from 'mongoose';
import type { Model, InferSchemaType } from 'mongoose';
import { defaultSchemaOptions, stringId } from './base';

const PaymentPlanSchema = new Schema(
  {
    _id: stringId(),
    patientId: {
      type: String,
      ref: 'Patient',
      required: true,
      index: true,
    },
    invoiceId: {
      type: String,
      ref: 'Invoice',
      required: true,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    monthlyAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    numberOfPayments: {
      type: Number,
      required: true,
      min: 1,
    },
    paymentsMade: {
      type: Number,
      min: 0,
      default: 0,
    },
    startDate: {
      type: Date,
      required: true,
    },
    nextDueDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'defaulted', 'cancelled'],
      default: 'active',
    },
    lateFee: {
      type: Number,
      min: 0,
      default: 0,
    },
    createdBy: {
      type: String,
      ref: 'User',
      required: true,
    },
  },
  {
    ...defaultSchemaOptions,
    collection: 'payment_plans',
  },
);

export type PaymentPlan = InferSchemaType<typeof PaymentPlanSchema>;

export const PaymentPlanModel: Model<PaymentPlan> =
  mongoose.models.PaymentPlan ?? model<PaymentPlan>('PaymentPlan', PaymentPlanSchema);

