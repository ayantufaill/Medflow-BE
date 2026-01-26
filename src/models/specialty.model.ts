import mongoose, { Schema, model } from 'mongoose';
import type { Model, InferSchemaType } from 'mongoose';
import { defaultSchemaOptions, stringId } from './base';

const SpecialtySchema = new Schema(
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
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    ...defaultSchemaOptions,
    collection: 'specialties',
  },
);

SpecialtySchema.index({ name: 1 }, { unique: true });

export type Specialty = InferSchemaType<typeof SpecialtySchema>;

export const SpecialtyModel: Model<Specialty> =
  mongoose.models.Specialty ?? model<Specialty>('Specialty', SpecialtySchema);
