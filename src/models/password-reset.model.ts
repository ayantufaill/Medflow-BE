import mongoose, { Schema, model } from 'mongoose';
import type { Model, InferSchemaType } from 'mongoose';
import { stringId, defaultSchemaOptions } from './base';

const PasswordResetSchema = new Schema(
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
    used: {
      type: Boolean,
      default: false,
    },
  },
  {
    ...defaultSchemaOptions,
    collection: 'password_resets',
  }
);

PasswordResetSchema.index({ email: 1, used: 1 });
PasswordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PasswordResetModel = model<InferSchemaType<typeof PasswordResetSchema>>(
  'PasswordReset',
  PasswordResetSchema
);

export type PasswordReset = InferSchemaType<typeof PasswordResetSchema>;

