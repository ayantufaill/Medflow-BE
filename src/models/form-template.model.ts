import mongoose, { Schema, model } from 'mongoose';
import type { Model, InferSchemaType } from 'mongoose';
import { defaultSchemaOptions, stringId } from './base';

const FormTemplateSchema = new Schema(
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
    },
    formStructure: {
      type: Schema.Types.Mixed,
      required: true,
    },
    validationRules: {
      type: Schema.Types.Mixed,
    },
    isRequired: {
      type: Boolean,
      default: false,
    },
    appointmentTypes: {
      type: [String],
      default: [],
    },
    specialty: {
      type: String,
    },
    version: {
      type: Number,
      default: 1,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: String,
      ref: 'User',
    },
  },
  {
    ...defaultSchemaOptions,
    collection: 'form_templates',
  },
);

export type FormTemplate = InferSchemaType<typeof FormTemplateSchema>;

export const FormTemplateModel: Model<FormTemplate> =
  mongoose.models.FormTemplate ?? model<FormTemplate>('FormTemplate', FormTemplateSchema);

