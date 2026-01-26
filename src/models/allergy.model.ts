import mongoose, { Schema, model } from 'mongoose';
import type { Model, InferSchemaType } from 'mongoose';
import { defaultSchemaOptions, stringId } from './base';

const AllergySchema = new Schema(
  {
    _id: stringId(),
    patientId: {
      type: String,
      required: true,
      ref: 'Patient',
      index: true,
    },
    allergen: {
      type: String,
      required: true,
      trim: true,
    },
    reaction: {
      type: String,
      required: true,
      trim: true,
    },
    severity: {
      type: String,
      required: true,
      enum: ['mild', 'moderate', 'severe'],
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    documentedBy: {
      type: String,
      required: true,
      ref: 'User',
      index: true,
    },
    documentedDate: {
      type: Date,
      required: true,
    },
  },
  {
    ...defaultSchemaOptions,
    collection: 'allergies',
  },
);

AllergySchema.index({ patientId: 1, isActive: 1 });
AllergySchema.index({ documentedBy: 1 });

export type Allergy = InferSchemaType<typeof AllergySchema>;

export const AllergyModel: Model<Allergy> =
  mongoose.models.Allergy ?? model<Allergy>('Allergy', AllergySchema);
