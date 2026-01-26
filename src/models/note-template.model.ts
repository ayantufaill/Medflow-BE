import mongoose, { Schema, model } from 'mongoose';
import type { Model, InferSchemaType } from 'mongoose';
import { defaultSchemaOptions, stringId } from './base';

const NoteTemplateSchema = new Schema(
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
    templateStructure: {
      type: Schema.Types.Mixed,
      required: true,
    },
    defaultContent: {
      type: Schema.Types.Mixed,
    },
    specialty: {
      type: String,
      trim: true,
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
    collection: 'note_templates',
  },
);

export type NoteTemplate = InferSchemaType<typeof NoteTemplateSchema>;

export const NoteTemplateModel: Model<NoteTemplate> =
  mongoose.models.NoteTemplate ?? model<NoteTemplate>('NoteTemplate', NoteTemplateSchema);

