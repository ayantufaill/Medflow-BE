import mongoose, { Schema, model } from 'mongoose';
import type { Model, InferSchemaType } from 'mongoose';
import { defaultSchemaOptions, stringId } from './base';

const SecurityEventSchema = new Schema(
  {
    _id: stringId(),
    userId: {
      type: String,
      ref: 'User',
    },
    eventType: {
      type: String,
      enum: ['login_success', 'login_failure', 'password_change', 'password_reset', 'session_end'],
      required: true,
    },
    ipAddress: {
      type: String,
    },
    description: {
      type: String,
      required: true,
    },
    riskLevel: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'low',
    },
    isResolved: {
      type: Boolean,
      default: false,
    },
    resolvedBy: {
      type: String,
      ref: 'User',
    },
    resolutionNotes: {
      type: String,
    },
    occurredAt: {
      type: Date,
      required: true,
    },
  },
  {
    ...defaultSchemaOptions,
    collection: 'security_events',
  },
);

SecurityEventSchema.index({ occurredAt: -1, riskLevel: 1 });
SecurityEventSchema.index({ userId: 1, eventType: 1 });

export type SecurityEvent = InferSchemaType<typeof SecurityEventSchema>;

export const SecurityEventModel: Model<SecurityEvent> =
  mongoose.models.SecurityEvent ?? model<SecurityEvent>('SecurityEvent', SecurityEventSchema);

