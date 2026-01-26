import mongoose, { Schema, model } from 'mongoose';
import type { Model, InferSchemaType } from 'mongoose';
import { defaultSchemaOptions, stringId } from './base';

const LabOrderSchema = new Schema(
  {
    _id: stringId(),
    patientId: {
      type: String,
      ref: 'Patient',
      required: true,
      index: true,
    },
    providerId: {
      type: String,
      ref: 'Provider',
      required: true,
      index: true,
    },
    appointmentId: {
      type: String,
      ref: 'Appointment',
    },
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    orderType: {
      type: String,
      required: true,
    },
    testsRequested: {
      type: [String],
      required: true,
    },
    priority: {
      type: String,
      enum: ['routine', 'urgent', 'stat'],
      default: 'routine',
    },
    status: {
      type: String,
      enum: ['ordered', 'collected', 'pending', 'completed', 'cancelled'],
      default: 'ordered',
    },
    orderedDate: {
      type: Date,
      required: true,
    },
    dueDate: {
      type: Date,
    },
    collectionDate: {
      type: Date,
    },
    labFacility: {
      type: String,
    },
    instructions: {
      type: String,
    },
    fastingRequired: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: String,
      ref: 'User',
      required: true,
    },
  },
  {
    ...defaultSchemaOptions,
    collection: 'lab_orders',
  },
);

LabOrderSchema.index({ patientId: 1, orderedDate: -1 });

export type LabOrder = InferSchemaType<typeof LabOrderSchema>;

export const LabOrderModel: Model<LabOrder> =
  mongoose.models.LabOrder ?? model<LabOrder>('LabOrder', LabOrderSchema);

