import mongoose, { Schema, model } from 'mongoose';
import type { Model, InferSchemaType } from 'mongoose';
import { stringId, defaultSchemaOptions } from './base';

const UserSchema = new Schema(
  {
    _id: stringId(),
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    preferredLanguage: {
      type: String,
      default: 'en',
      trim: true,
      lowercase: true,
    },
    failedLoginAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    accountLockedUntil: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastLoginAt: {
      type: Date,
    },
    tokenVersion: {
      type: Number,
      default: 0,
    },
  },
  {
    ...defaultSchemaOptions,
    collection: 'users',
  },
);

UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ lastName: 1, firstName: 1 });
UserSchema.index({ isActive: 1, preferredLanguage: 1 });

export type User = InferSchemaType<typeof UserSchema>;

export const UserModel: Model<User> = mongoose.models.User ?? model<User>('User', UserSchema);

