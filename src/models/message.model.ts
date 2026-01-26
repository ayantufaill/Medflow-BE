import mongoose, { Schema, model } from 'mongoose';
import type { Model, InferSchemaType } from 'mongoose';
import { defaultSchemaOptions, stringId } from './base';

const MessageSchema = new Schema(
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
    parentMessageId: {
      type: String,
      ref: 'Message',
    },
    subject: {
      type: String,
      required: true,
    },
    messageContent: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['unread', 'read', 'archived'],
      default: 'unread',
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal',
    },
    isFromPatient: {
      type: Boolean,
      required: true,
    },
    sentAt: {
      type: Date,
      required: true,
    },
    readAt: {
      type: Date,
    },
    archivedAt: {
      type: Date,
    },
  },
  {
    ...defaultSchemaOptions,
    collection: 'messages',
  },
);

MessageSchema.index({ providerId: 1, status: 1 });

export type Message = InferSchemaType<typeof MessageSchema>;

export const MessageModel: Model<Message> =
  mongoose.models.Message ?? model<Message>('Message', MessageSchema);

