import mongoose, { Schema, model } from 'mongoose';
import type { Model, InferSchemaType } from 'mongoose';
import { defaultSchemaOptions, stringId } from './base';

const RecurringAppointmentSchema = new Schema(
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
    appointmentTypeId: {
      type: String,
      ref: 'AppointmentType',
    },
    frequency: {
      type: String,
      enum: ['weekly', 'monthly', 'quarterly'],
      required: true,
    },
    frequencyValue: {
      type: Number,
      required: true,
      min: 1,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
    },
    preferredTime: {
      type: String,
      required: true,
    },
    preferredDayOfWeek: {
      type: Number,
      min: 0,
      max: 6,
    },
    totalAppointments: {
      type: Number,
      min: 1,
    },
    appointmentsCreated: {
      type: Number,
      min: 0,
      default: 0,
    },
    isActive: {
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
    collection: 'recurring_appointments',
  },
);

export type RecurringAppointment = InferSchemaType<typeof RecurringAppointmentSchema>;

export const RecurringAppointmentModel: Model<RecurringAppointment> =
  mongoose.models.RecurringAppointment ??
  model<RecurringAppointment>('RecurringAppointment', RecurringAppointmentSchema);

