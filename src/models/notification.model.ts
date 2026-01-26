import mongoose, { Schema, model } from 'mongoose';
import type { Model, InferSchemaType } from 'mongoose';
import { defaultSchemaOptions, stringId } from './base';

const NotificationSchema = new Schema(
  {
    _id: stringId(),
    patientId: {
      type: String,
      ref: 'Patient',
      index: true,
    },
    appointmentId: {
      type: String,
      ref: 'Appointment',
    },
    type: {
      type: String,
      enum: ['appointment_reminder', 'payment_due', 'lab_result', 'custom'],
      required: true,
    },
    method: {
      type: String,
      enum: ['sms', 'email', 'portal', 'call'],
      required: true,
    },
    recipient: {
      type: String,
      required: true,
    },
    messageContent: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'sent', 'failed', 'delivered'],
      default: 'pending',
    },
    scheduledFor: {
      type: Date,
      required: true,
    },
    sentAt: {
      type: Date,
    },
    deliveryStatus: {
      type: String,
    },
    errorMessage: {
      type: String,
    },
    createdBy: {
      type: String,
      ref: 'User',
    },
  },
  {
    ...defaultSchemaOptions,
    collection: 'notifications',
  },
);

NotificationSchema.index({ scheduledFor: 1, status: 1 });

export type Notification = InferSchemaType<typeof NotificationSchema>;

export const NotificationModel: Model<Notification> =
  mongoose.models.Notification ?? model<Notification>('Notification', NotificationSchema);

