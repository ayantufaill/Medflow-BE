import mongoose, { Schema, model } from 'mongoose';
import type { Model, InferSchemaType } from 'mongoose';
import { defaultSchemaOptions, stringId } from './base';

const InvoiceSchema = new Schema(
  {
    _id: stringId(),
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    patientId: {
      type: String,
      ref: 'Patient',
      required: true,
      index: true,
    },
    appointmentId: {
      type: String,
      ref: 'Appointment',
      required: true,
      index: true,
    },
    insuranceCompanyId: {
      type: String,
      ref: 'InsuranceCompany',
    },
    providerId: {
      type: String,
      ref: 'Provider',
    },
    invoiceDate: {
      type: Date,
      required: true,
    },
    dueDate: {
      type: Date,
      required: true,
    },
    totalAmount: {
      type: Number,
      min: 0,
      required: true,
    },
    insurancePortion: {
      type: Number,
      min: 0,
      default: 0,
    },
    patientPortion: {
      type: Number,
      min: 0,
      default: 0,
    },
    copayAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    paidAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    balanceDue: {
      type: Number,
      min: 0,
      default: 0,
    },
    taxAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    discountAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    status: {
      type: String,
      enum: ['draft', 'submitted', 'partially_paid', 'paid', 'denied', 'void'],
      default: 'draft',
      index: true,
    },
    claimNumber: {
      type: String,
      trim: true,
    },
    claimSubmissionDate: {
      type: Date,
    },
    submissionMethod: {
      type: String,
      enum: ['electronic', 'paper', 'portal', 'other'],
    },
    createdBy: {
      type: String,
      ref: 'User',
      required: true,
    },
    notes: {
      type: String,
    },
  },
  {
    ...defaultSchemaOptions,
    collection: 'invoices',
  },
);

InvoiceSchema.index({ invoiceNumber: 1 }, { unique: true });
InvoiceSchema.index({ status: 1, dueDate: 1 });
InvoiceSchema.index({ patientId: 1, invoiceDate: -1 });

export type Invoice = InferSchemaType<typeof InvoiceSchema>;

export const InvoiceModel: Model<Invoice> =
  mongoose.models.Invoice ?? model<Invoice>('Invoice', InvoiceSchema);

