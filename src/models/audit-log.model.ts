import mongoose, { Schema, model } from 'mongoose';
import type { Model, InferSchemaType } from 'mongoose';
import { defaultSchemaOptions, stringId } from './base';

const AuditLogSchema = new Schema(
  {
    _id: stringId(),
    userId: {
      type: String,
      ref: 'User',
      index: true,
    },
    action: {
      type: String,
      enum: ['created', 'updated', 'deleted', 'viewed'],
      required: true,
    },
    tableName: {
      type: String,
      required: true,
    },
    recordId: {
      type: String,
      required: true,
    },
    oldValues: {
      type: Schema.Types.Mixed,
    },
    newValues: {
      type: Schema.Types.Mixed,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    sessionId: {
      type: String,
    },
    riskLevel: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'low',
    },
  },
  {
    ...defaultSchemaOptions,
    collection: 'audit_logs',
  },
);

AuditLogSchema.index({ tableName: 1, recordId: 1 });

export type AuditLog = InferSchemaType<typeof AuditLogSchema>;

export const AuditLogModel: Model<AuditLog> =
  mongoose.models.AuditLog ?? model<AuditLog>('AuditLog', AuditLogSchema);

