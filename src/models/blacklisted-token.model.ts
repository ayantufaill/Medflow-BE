import mongoose, { Schema, model } from 'mongoose';
import type { Model, InferSchemaType } from 'mongoose';
import { defaultSchemaOptions, stringId } from './base';

const BlacklistedTokenSchema = new Schema(
  {
    _id: stringId(),
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: String,
      ref: 'User',
      required: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 }, // Auto-delete expired tokens
    },
    reason: {
      type: String,
      enum: ['logout', 'password_change', 'security'],
      default: 'logout',
    },
  },
  {
    ...defaultSchemaOptions,
    collection: 'blacklisted_tokens',
  },
);

BlacklistedTokenSchema.index({ userId: 1, expiresAt: 1 });

export type BlacklistedToken = InferSchemaType<typeof BlacklistedTokenSchema>;

export const BlacklistedTokenModel: Model<BlacklistedToken> =
  mongoose.models.BlacklistedToken ?? model<BlacklistedToken>('BlacklistedToken', BlacklistedTokenSchema);



















