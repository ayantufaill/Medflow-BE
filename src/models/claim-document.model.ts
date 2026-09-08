import mongoose, { Schema, model } from 'mongoose';
import type { Model, InferSchemaType } from 'mongoose';
import { defaultSchemaOptions, stringId } from './base';

const ClaimDocumentSchema = new Schema(
  {
    _id: stringId(),
    claimId: {
      type: String,
      ref: 'Claim',
      required: true,
      index: true,
    },
    documentName: {
      type: String,
      required: true,
      trim: true,
    },
    documentType: {
      type: String,
      default: 'claim_attachment',
      trim: true,
    },
    storagePath: {
      type: String,
      trim: true,
    },
    fileSizeInBytes: {
      type: Number,
      min: 0,
    },
    mimeType: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
    },
    uploadedBy: {
      type: String,
      ref: 'User',
      required: true,
    },
  },
  {
    ...defaultSchemaOptions,
    collection: 'claim_documents',
  }
);

ClaimDocumentSchema.index({ claimId: 1 });

export type ClaimDocument = InferSchemaType<typeof ClaimDocumentSchema>;

export const ClaimDocumentModel: Model<ClaimDocument> =
  mongoose.models.ClaimDocument ?? model<ClaimDocument>('ClaimDocument', ClaimDocumentSchema);
