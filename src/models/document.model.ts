import mongoose, { Schema, model } from 'mongoose';
import type { Model, InferSchemaType } from 'mongoose';
import { defaultSchemaOptions, stringId } from './base';

const DocumentSchema = new Schema(
  {
    _id: stringId(),
    patientId: {
      type: String,
      ref: 'Patient',
      required: true,
      index: true,
    },
    appointmentId: {
      type: String,
      ref: 'Appointment',
    },
    documentName: {
      type: String,
      required: true,
      trim: true,
    },
    documentType: {
      type: String,
      enum: ['insurance_card', 'id', 'lab_result', 'imaging', 'consent_form', 'treatment_plan', 'referral', 'prescription', 'other'],
      required: true,
    },
    storagePath: {
      type: String,
      required: false,
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
    isConfidential: {
      type: Boolean,
      default: false,
    },
    expirationDate: {
      type: Date,
    },
    ocrText: {
      type: String,
    },
    uploadedBy: {
      type: String,
      ref: 'User',
      required: true,
    },
    checksum: {
      type: String,
      trim: true,
    },
    tags: {
      type: [String],
      default: [],
    },
  },
  {
    ...defaultSchemaOptions,
    collection: 'documents',
  },
);

DocumentSchema.index({ patientId: 1, documentType: 1 });
DocumentSchema.index({ appointmentId: 1 });

export type Document = InferSchemaType<typeof DocumentSchema>;

export const DocumentModel: Model<Document> =
  mongoose.models.Document ?? model<Document>('Document', DocumentSchema);

