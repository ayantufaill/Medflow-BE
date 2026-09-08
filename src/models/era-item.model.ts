import mongoose, { Schema, model } from 'mongoose';
import type { Model, InferSchemaType } from 'mongoose';
import { defaultSchemaOptions, stringId } from './base';

const EraItemSchema = new Schema(
  {
    _id: stringId(),
    eraId: {
      type: String,
      ref: 'ERA',
      required: true,
      index: true,
    },
    patientName: {
      type: String,
      trim: true,
    },
    claimNumber: {
      type: String,
      trim: true,
      index: true,
    },
    amount: {
      type: Number,
      min: 0,
      default: 0,
    },
    paymentDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['matched', 'unmatched'],
      default: 'unmatched',
      index: true,
    },
    claimId: {
      type: String,
      ref: 'Claim',
    },
    invoiceId: {
      type: String,
      ref: 'Invoice',
    },
    rawData: {
      type: Schema.Types.Mixed,
    },
  },
  {
    ...defaultSchemaOptions,
    collection: 'era_items',
  }
);

EraItemSchema.index({ eraId: 1, status: 1 });

export type ERAItem = InferSchemaType<typeof EraItemSchema>;

export const ERAItemModel: Model<ERAItem> =
  mongoose.models.ERAItem ?? model<ERAItem>('ERAItem', EraItemSchema);
