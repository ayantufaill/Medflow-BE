import mongoose, { Schema, model } from 'mongoose';
import type { Model, InferSchemaType } from 'mongoose';
import { defaultSchemaOptions, stringId } from './base';

const RoomSchema = new Schema(
  {
    _id: stringId(),
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    ...defaultSchemaOptions,
    collection: 'rooms',
  },
);

export type Room = InferSchemaType<typeof RoomSchema>;

export const RoomModel: Model<Room> =
  mongoose.models.Room ?? model<Room>('Room', RoomSchema);

