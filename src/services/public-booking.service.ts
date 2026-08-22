import { prisma } from '../config/db';
import { NotFoundError, BadRequestError } from '../utils/error.util';
import { tenantContextStorage } from '../config/tenant-context';
import { appointmentService } from './appointment.service';
import { providerService } from './provider.service';
import { appointmentTypeService } from './appointment-type.service';
import { patientService } from './patient.service';
import { emailService } from './email.service';

/**
 * Resolves a validated provider + confirms it's actually assigned to the
 * given branch and currently accepting new patients — a public caller could
 * otherwise book an established specialist's calendar full of strangers, or
 * book into a branch the provider doesn't work at.
 */
async function assertProviderAcceptsAtBranch(providerId: string, branchId: string) {
  const provider = await providerService.getProviderById(providerId);
  if (!provider.isActive) {
    throw new NotFoundError('Provider not found');
  }
  if (!provider.branchIds?.includes(branchId)) {
    throw new BadRequestError('This provider does not see patients at the selected branch.');
  }
  if (provider.isAcceptingNewPatients === false) {
    throw new BadRequestError('This provider is not currently accepting new patients.');
  }
  return provider;
}

async function resolveDuration(appointmentTypeId: string): Promise<number> {
  const appointmentType = await appointmentTypeService.getAppointmentTypeById(appointmentTypeId);
  return appointmentType.defaultDuration && appointmentType.defaultDuration > 0
    ? appointmentType.defaultDuration
    : 30;
}

async function assertBranchExists(branchId: string) {
  const branch = await prisma.clinic.findUnique({ where: { ClinicNum: BigInt(branchId) } });
  if (!branch) {
    throw new NotFoundError('Branch not found');
  }
  return branch;
}

export class PublicBookingService {
  /**
   * clinic/appointmenttype/appointmentType lookups don't need it (not
   * RLS-scoped), but patient/provider-clinic/appointment reads inside
   * getAvailableSlots and createAppointment are — a public request has no
   * per-user tenant context, so without this RLS would silently hide the
   * real provider schedule (only unscoped rows would be visible). Scoped
   * narrowly to the caller's own requested branch, not '*' — a public,
   * unauthenticated caller shouldn't get the same everything-visible
   * bypass a trusted internal script does.
   */
  async getPublicAvailableSlots(branchId: string, providerId: string, appointmentTypeId: string, date: string) {
    await assertBranchExists(branchId);

    // Validation (providerclinic lookup) and the actual query both touch
    // RLS-scoped tables, so both must run inside the same tenant context —
    // splitting them was the exact bug this comment used to warn about.
    return tenantContextStorage.run({ clinicIds: [BigInt(branchId)] }, async () => {
      await assertProviderAcceptsAtBranch(providerId, branchId);
      const durationMinutes = await resolveDuration(appointmentTypeId);
      return appointmentService.getAvailableSlots(providerId, date, durationMinutes);
    });
  }

  async createGuestBooking(data: {
    branchId: string;
    providerId: string;
    appointmentTypeId: string;
    appointmentDate: string;
    startTime: string;
    chiefComplaint?: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    phone?: string;
    email?: string;
  }) {
    await assertBranchExists(data.branchId);

    // Validation, availability check, patient dedup/creation, and the
    // appointment write all touch RLS-scoped tables, so all of it runs
    // inside one tenant context — see getPublicAvailableSlots above for why
    // splitting this was a real bug, not just tidiness.
    return tenantContextStorage.run({ clinicIds: [BigInt(data.branchId)] }, async () => {
      await assertProviderAcceptsAtBranch(data.providerId, data.branchId);
      const durationMinutes = await resolveDuration(data.appointmentTypeId);

      const slots = await appointmentService.getAvailableSlots(data.providerId, data.appointmentDate, durationMinutes);
      if (!slots.availableSlots.includes(data.startTime)) {
        throw new BadRequestError('Selected time slot is no longer available. Please pick another time.');
      }

      // Reuse an existing chart if this looks like the same person (front
      // desk would search before opening a new one) — a public form retried
      // after a typo, or someone who's been seen before, shouldn't fork
      // into a duplicate patient record.
      const dob = new Date(data.dateOfBirth);
      const duplicates = await patientService.findDuplicatePatients({
        firstName: data.firstName,
        lastName: data.lastName,
        dateOfBirth: dob,
        ...(data.phone ? { phonePrimary: data.phone } : {}),
        ...(data.email ? { email: data.email } : {}),
      });

      let patientId: string;
      let isNewPatient: boolean;
      if (duplicates.length > 0) {
        patientId = duplicates[0]._id;
        isNewPatient = false;
      } else {
        const patient = await patientService.createPatient({
          firstName: data.firstName,
          lastName: data.lastName,
          dateOfBirth: dob,
          phonePrimary: data.phone,
          email: data.email,
          portalAccessEnabled: false,
          patientProfileType: 'adult',
          referralSource: 'Public booking widget',
          notes: 'Created via public guest booking — please verify identity and insurance before the visit.',
          branchId: data.branchId,
        });
        patientId = patient._id;
        isNewPatient = true;
      }

      const endTime = addMinutes(data.startTime, durationMinutes);

      // status: 'scheduled' (not 'pending') — 'pending' is excluded from the
      // conflict/availability check elsewhere in this codebase, so it would
      // NOT actually hold the slot. pendingStaffConfirmation in customFields
      // is what marks this as needing a human to confirm before the patient
      // is treated as a real booking; the slot itself is genuinely held.
      const appointment = await appointmentService.createAppointment(
        {
          patientId,
          providerId: data.providerId,
          appointmentTypeId: data.appointmentTypeId,
          appointmentDate: new Date(data.appointmentDate),
          startTime: data.startTime,
          endTime,
          durationMinutes,
          chiefComplaint: data.chiefComplaint,
          notes: 'Public guest booking — awaiting staff confirmation.',
          branchId: data.branchId,
          status: 'scheduled',
          customFields: {
            source: 'public_guest_booking',
            pendingStaffConfirmation: true,
            isNewPatient,
          },
        },
        // '' (falsy) -> SecUserNumEntry stored as null, not patientId: that
        // column is a real FK to userod (staff), a different ID space from
        // patient — there is no staff/system actor for a public request.
        ''
      );

      if (data.email) {
        try {
          await emailService.sendBulkEmail(
            data.email,
            "We've received your appointment request",
            `Hi ${data.firstName}, thanks for requesting an appointment for ` +
              `${data.appointmentDate} at ${data.startTime}. Our office will confirm your ` +
              `appointment shortly — please call us if you don't hear back within one business day.`
          );
        } catch (error) {
          console.error('Failed to send guest booking confirmation email:', error);
        }
      }

      // Deliberately trimmed response — a public caller gets back only what
      // they need to recognize their own request, not the full patient/
      // appointment object (SSN, internal notes, other stored PHI).
      return {
        confirmationCode: appointment.appointmentCode,
        status: 'pending_confirmation' as const,
        appointmentDate: data.appointmentDate,
        startTime: data.startTime,
        endTime,
        branchId: data.branchId,
        providerId: data.providerId,
      };
    });
  }
}

function addMinutes(time: string, minutesToAdd: number): string {
  const [hoursStr, minutesStr] = time.split(':');
  const totalMinutes = Number(hoursStr) * 60 + Number(minutesStr) + minutesToAdd;
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

export const publicBookingService = new PublicBookingService();
