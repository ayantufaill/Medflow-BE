import mongoose, { Schema, model } from 'mongoose';
import type { Model, InferSchemaType } from 'mongoose';
import { defaultSchemaOptions, stringId } from './base';

const WaitlistEntrySchema = new Schema(
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
    appointmentTypeId: {
      type: String,
      ref: 'AppointmentType',
    },
    preferredDate: {
      type: Date,
    },
    preferredTimeStart: {
      type: String,
    },
    preferredTimeEnd: {
      type: String,
    },
    priority: {
      type: String,
      enum: ['urgent', 'normal', 'flexible'],
      default: 'normal',
    },
    status: {
      type: String,
      enum: ['active', 'called', 'scheduled', 'expired'],
      default: 'active',
    },
    notes: {
      type: String,
    },
    createdBy: {
      type: String,
      ref: 'User',
      required: true,
    },
  },
  {
    ...defaultSchemaOptions,
    collection: 'waitlist',
  },
);

WaitlistEntrySchema.index({ providerId: 1, status: 1 });

export type WaitlistEntry = InferSchemaType<typeof WaitlistEntrySchema>;

export const WaitlistEntryModel: Model<WaitlistEntry> =
  mongoose.models.WaitlistEntry ?? model<WaitlistEntry>('WaitlistEntry', WaitlistEntrySchema);

