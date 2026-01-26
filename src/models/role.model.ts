import mongoose, { Schema, model } from 'mongoose';
import type { Model, InferSchemaType } from 'mongoose';
import { defaultSchemaOptions, stringId } from './base';

const RoleSchema = new Schema(
  {
    _id: stringId(),
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    permissions: {
      type: Schema.Types.Mixed,
      default: {},
    },
    isSystemRole: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    ...defaultSchemaOptions,
    collection: 'roles',
  },
);

RoleSchema.index({ name: 1 }, { unique: true });

export type Role = InferSchemaType<typeof RoleSchema>;

export const RoleModel: Model<Role> = mongoose.models.Role ?? model<Role>('Role', RoleSchema);

