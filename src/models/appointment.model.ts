import mongoose, { Schema, model } from 'mongoose';
import type { Model, InferSchemaType } from 'mongoose';
import { defaultSchemaOptions, stringId } from './base';

const AppointmentSchema = new Schema(
  {
    _id: stringId(),
    appointmentCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
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
    appointmentTypeId: {
      type: String,
      ref: 'AppointmentType',
      index: true,
    },
    appointmentDate: {
      type: Date,
      required: true,
    },
    startTime: {
      type: String,
      required: true,
    },
    endTime: {
      type: String,
      required: true,
    },
    durationMinutes: {
      type: Number,
      min: 5,
      default: 30,
    },
    appointmentType: {
      type: String,
      enum: ['consultation', 'follow_up', 'procedure', 'telehealth', 'other'],
      default: 'consultation',
    },
    roomId: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: String,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['scheduled', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show'],
      default: 'scheduled',
      index: true,
    },
    chiefComplaint: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    insuranceVerified: {
      type: Boolean,
      default: false,
    },
    copayCollected: {
      type: Number,
      min: 0,
      default: 0,
    },
    requiresInterpreter: {
      type: Boolean,
      default: false,
    },
    interpreterLanguage: {
      type: String,
      trim: true,
    },
    reminderSent: {
      type: Boolean,
      default: false,
    },
    customFields: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {},
    },
    cancellationReason: {
      type: String,
      trim: true,
    },
    checkInAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    parentAppointmentId: {
      type: String,
      ref: 'RecurringAppointment',
      index: true,
    },
  },
  {
    ...defaultSchemaOptions,
    collection: 'appointments',
  },
);

AppointmentSchema.index({ appointmentDate: 1, providerId: 1 });
AppointmentSchema.index({ patientId: 1, appointmentDate: -1 });
AppointmentSchema.index({ roomId: 1, appointmentDate: 1 }); // For room conflict checking
AppointmentSchema.index({ parentAppointmentId: 1 }); // For recurring appointment queries

export type Appointment = InferSchemaType<typeof AppointmentSchema>;

export const AppointmentModel: Model<Appointment> =
  mongoose.models.Appointment ?? model<Appointment>('Appointment', AppointmentSchema);

