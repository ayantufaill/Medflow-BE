import mongoose, { Schema, model } from 'mongoose';
import type { Model, InferSchemaType } from 'mongoose';
import { defaultSchemaOptions, stringId } from './base';

const ClinicalNoteSchema = new Schema(
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
      required: false,
      index: true,
    },
    providerId: {
      type: String,
      ref: 'Provider',
      required: true,
      index: true,
    },
    templateId: {
      type: String,
      ref: 'NoteTemplate',
    },
    noteType: {
      type: String,
      enum: ['soap', 'progress', 'consultation', 'treatment_plan', 'other'],
      default: 'soap',
    },
    chiefComplaint: {
      type: String,
      trim: true,
    },
    subjective: {
      type: String,
    },
    objective: {
      type: String,
    },
    assessment: {
      type: String,
    },
    plan: {
      type: String,
    },
    diagnosisCodes: {
      type: [String],
      default: [],
    },
    structuredData: {
      type: Schema.Types.Mixed,
    },
    historyOfPresentIllness: {
      type: String,
    },
    physicalExam: {
      type: String,
    },
    attachments: {
      type: [String],
      default: [],
    },
    requiresFollowUp: {
      type: Boolean,
      default: false,
    },
    followUpDate: {
      type: Date,
    },
    isSigned: {
      type: Boolean,
      default: false,
    },
    signedAt: {
      type: Date,
    },
    signedBy: {
      type: String,
      ref: 'User',
    },
    lastEditedBy: {
      type: String,
      ref: 'User',
    },
  },
  {
    ...defaultSchemaOptions,
    collection: 'clinical_notes',
  },
);

ClinicalNoteSchema.index({ providerId: 1, createdAt: -1 });

export type ClinicalNote = InferSchemaType<typeof ClinicalNoteSchema>;

export const ClinicalNoteModel: Model<ClinicalNote> =
  mongoose.models.ClinicalNote ?? model<ClinicalNote>('ClinicalNote', ClinicalNoteSchema);

