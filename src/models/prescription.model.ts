import mongoose, { Schema, model } from 'mongoose';
import type { Model, InferSchemaType } from 'mongoose';
import { defaultSchemaOptions, stringId } from './base';

const PrescriptionSchema = new Schema(
  {
    _id: stringId(),
    patientId: {
      type: String,
      ref: 'Patient',
      required: true,
      index: true,
    },
    providerId: {
      type: String,
      ref: 'Provider',
      required: true,
      index: true,
    },
    appointmentId: {
      type: String,
      ref: 'Appointment',
    },
    medicationId: {
      type: String,
      ref: 'Medication',
      required: true,
    },
    dosage: {
      type: String,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    refillsAllowed: {
      type: Number,
      default: 0,
      min: 0,
    },
    refillsRemaining: {
      type: Number,
      min: 0,
    },
    prescribedDate: {
      type: Date,
      required: true,
    },
    expirationDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'cancelled', 'expired'],
      default: 'active',
    },
    instructions: {
      type: String,
    },
    pharmacyName: {
      type: String,
    },
    pharmacyPhone: {
      type: String,
    },
    isElectronic: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: String,
      ref: 'User',
      required: true,
    },
  },
  {
    ...defaultSchemaOptions,
    collection: 'prescriptions',
  },
);

PrescriptionSchema.index({ patientId: 1, prescribedDate: -1 });

export type Prescription = InferSchemaType<typeof PrescriptionSchema>;

export const PrescriptionModel: Model<Prescription> =
  mongoose.models.Prescription ?? model<Prescription>('Prescription', PrescriptionSchema);

