import mongoose, { Schema, model } from 'mongoose';
import type { Model, InferSchemaType } from 'mongoose';
import { defaultSchemaOptions, stringId } from './base';

const InvoiceItemSchema = new Schema(
  {
    _id: stringId(),
    invoiceId: {
      type: String,
      ref: 'Invoice',
      required: true,
      index: true,
    },
    serviceId: {
      type: String,
      ref: 'Service',
      required: false, // Optional - invoice items can come from appointment types without a service
    },
    cptCode: {
      type: String,
      uppercase: true,
      trim: true,
    },
    description: {
      type: String,
    },
    quantity: {
      type: Number,
      min: 1,
      default: 1,
    },
    unitPrice: {
      type: Number,
      min: 0,
      required: true,
    },
    totalPrice: {
      type: Number,
      min: 0,
      required: true,
    },
  },
  {
    ...defaultSchemaOptions,
    collection: 'invoice_items',
  },
);

InvoiceItemSchema.index({ invoiceId: 1 });

export type InvoiceItem = InferSchemaType<typeof InvoiceItemSchema>;

export const InvoiceItemModel: Model<InvoiceItem> =
  mongoose.models.InvoiceItem ?? model<InvoiceItem>('InvoiceItem', InvoiceItemSchema);

