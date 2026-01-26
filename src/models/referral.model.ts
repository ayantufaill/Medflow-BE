import mongoose, { Schema, model } from 'mongoose';
import type { Model, InferSchemaType } from 'mongoose';
import { defaultSchemaOptions, stringId } from './base';

const ReferralSchema = new Schema(
  {
    _id: stringId(),
    patientId: {
      type: String,
      ref: 'Patient',
      required: true,
      index: true,
    },
    referringProviderId: {
      type: String,
      ref: 'Provider',
      required: true,
    },
    specialistName: {
      type: String,
      required: true,
    },
    specialistPhone: {
      type: String,
    },
    specialty: {
      type: String,
      required: true,
    },
    reasonForReferral: {
      type: String,
      required: true,
    },
    urgency: {
      type: String,
      enum: ['routine', 'urgent', 'stat'],
      default: 'routine',
    },
    referralDate: {
      type: Date,
      required: true,
    },
    appointmentDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['pending', 'scheduled', 'completed', 'cancelled'],
      default: 'pending',
    },
    notes: {
      type: String,
    },
    reportReceived: {
      type: Boolean,
      default: false,
    },
    reportDate: {
      type: Date,
    },
    createdBy: {
      type: String,
      ref: 'User',
      required: true,
    },
  },
  {
    ...defaultSchemaOptions,
    collection: 'referrals',
  },
);

ReferralSchema.index({ patientId: 1, status: 1 });

export type Referral = InferSchemaType<typeof ReferralSchema>;

export const ReferralModel: Model<Referral> =
  mongoose.models.Referral ?? model<Referral>('Referral', ReferralSchema);

