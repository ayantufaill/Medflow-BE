import { randomUUID } from 'node:crypto';
import type { SchemaOptions, SchemaTypeOptions } from 'mongoose';

export const stringId = (): SchemaTypeOptions<string> => ({
  type: String,
  default: () => randomUUID(),
});

export const defaultSchemaOptions: SchemaOptions = {
  versionKey: false,
  timestamps: true,
};

