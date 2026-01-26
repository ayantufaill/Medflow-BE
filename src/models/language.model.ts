import mongoose, { Schema, model } from 'mongoose';
import type { Model, InferSchemaType } from 'mongoose';
import { defaultSchemaOptions, stringId } from './base';

const LanguageSchema = new Schema(
  {
    _id: stringId(),
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    nativeName: {
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
    collection: 'languages',
  },
);

LanguageSchema.index({ code: 1 }, { unique: true });
LanguageSchema.index({ name: 1 });

export type Language = InferSchemaType<typeof LanguageSchema>;

export const LanguageModel: Model<Language> =
  mongoose.models.Language ?? model<Language>('Language', LanguageSchema);
