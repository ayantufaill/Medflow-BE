import mongoose, { Schema, model } from 'mongoose';
import type { Model, InferSchemaType } from 'mongoose';
import { stringId, defaultSchemaOptions } from './base';

const EmailVerificationSchema = new Schema(
  {
    _id: stringId(),
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    code: {
      type: String,
      required: false,
    },
    token: {
      type: String,
      required: false,
      index: true,
    },
    registrationData: {
      type: Schema.Types.Mixed,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 }, // Auto-delete expired documents
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxAttempts: {
      type: Number,
      default: 5,
    },
    verified: {
      type: Boolean,
      default: false,
    },
  },
  {
    ...defaultSchemaOptions,
    collection: 'email_verifications',
  }
);

EmailVerificationSchema.index({ email: 1, verified: 1 });
EmailVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const EmailVerificationModel = model<InferSchemaType<typeof EmailVerificationSchema>>(
  'EmailVerification',
  EmailVerificationSchema
);

export type EmailVerification = InferSchemaType<typeof EmailVerificationSchema>;

