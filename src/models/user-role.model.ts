import mongoose, { Schema, model } from 'mongoose';
import type { Model, InferSchemaType } from 'mongoose';
import { defaultSchemaOptions, stringId } from './base';

const UserRoleSchema = new Schema(
  {
    _id: stringId(),
    userId: {
      type: String,
      ref: 'User',
      required: true,
      index: true,
    },
    roleId: {
      type: String,
      ref: 'Role',
      required: true,
      index: true,
    },
    assignedBy: {
      type: String,
      ref: 'User',
    },
    assignedAt: {
      type: Date,
      default: () => new Date(),
    },
  },
  {
    ...defaultSchemaOptions,
    collection: 'user_roles',
  },
);

UserRoleSchema.index({ userId: 1, roleId: 1 }, { unique: true });

export type UserRole = InferSchemaType<typeof UserRoleSchema>;

export const UserRoleModel: Model<UserRole> =
  mongoose.models.UserRole ?? model<UserRole>('UserRole', UserRoleSchema);

