import type {
  appointmenttype,
  appointment,
  patient,
  provider,
  userod,
  operatory,
  procedurecode,
} from '@prisma/client';

const formatTime = (date: Date): string => {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const parseDurationMinutes = (pattern?: string | null): number => {
  if (!pattern) return 30;
  const parsed = Number.parseInt(pattern, 10);
  return Number.isFinite(parsed) ? parsed : 30;
};

const parseProcTimeToMinutes = (value?: string | null): number => {
  if (!value) return 30;
  const trimmed = value.trim();
  if (!trimmed) return 30;
  if (trimmed.includes(':')) {
    const [hoursRaw, minutesRaw] = trimmed.split(':');
    const hours = Number.parseInt(hoursRaw || '0', 10);
    const minutes = Number.parseInt(minutesRaw || '0', 10);
    if (Number.isFinite(hours) && Number.isFinite(minutes)) {
      return Math.max(0, hours * 60 + minutes);
    }
  }
  const asNumber = Number.parseInt(trimmed, 10);
  return Number.isFinite(asNumber) ? Math.max(0, asNumber) : 30;
};

const parseTaxRate = (value?: string | null): number => {
  if (!value) return 0;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const mapGenderFromDb = (gender?: number | null): string => {
  switch (gender) {
    case 1:
      return 'male';
    case 2:
      return 'female';
    default:
      return 'unknown';
  }
};

export const mapGenderToDb = (gender?: string | null): number | null => {
  switch (gender) {
    case 'male':
      return 1;
    case 'female':
      return 2;
    default:
      return 0;
  }
};

export const mapContactPreferenceFromDb = (value?: number | null): string => {
  switch (value) {
    case 1:
      return 'email';
    case 2:
      return 'sms';
    case 3:
      return 'portal';
    default:
      return 'phone';
  }
};

export const mapContactPreferenceToDb = (value?: string | null): number => {
  switch (value) {
    case 'email':
      return 1;
    case 'sms':
      return 2;
    case 'portal':
      return 3;
    default:
      return 0;
  }
};

export const mapAppointmentTypeToApi = (row: appointmenttype) => ({
  _id: row.AppointmentTypeNum.toString(),
  name: row.AppointmentTypeName ?? '',
  description: null,
  defaultDuration: 0,
  defaultPrice: 0,
  colorCode: row.AppointmentTypeColor !== null && row.AppointmentTypeColor !== undefined
    ? String(row.AppointmentTypeColor)
    : null,
  requiresAuthorization: Boolean(row.RequiredProcCodesNeeded),
  bufferBefore: 0,
  bufferAfter: 0,
  isActive: !row.IsHidden,
});

export const mapRoomToApi = (row: operatory) => ({
  _id: row.OperatoryNum.toString(),
  name: row.OpName ?? row.Abbrev ?? '',
  isActive: !row.IsHidden,
});

export const mapServiceToApi = (
  row: procedurecode,
  options?: {
    feeAmount?: number | null;
    categoryName?: string | null;
  }
) => ({
  _id: row.CodeNum?.toString() ?? row.ProcCode,
  cptCode: row.ProcCode,
  name: row.Descript ?? row.AbbrDesc ?? row.LaymanTerm ?? '',
  description: row.DefaultNote ?? row.DefaultTPNote ?? null,
  defaultPrice: options?.feeAmount ?? 0,
  durationMinutes: parseProcTimeToMinutes(row.ProcTime),
  category: options?.categoryName ?? null,
  requiresAuthorization: Boolean(row.PreExisting),
  isBillable: row.NoBillIns ? false : true,
  taxRate: parseTaxRate(row.TaxCode),
  isActive: row.BypassGlobalLock ? false : true,
});

export const mapPatientToApi = (row: patient) => ({
  _id: row.PatNum.toString(),
  patientCode: row.ChartNumber ?? `PAT${row.PatNum.toString()}`,
  userAccountId: null,
  firstName: row.FName ?? '',
  middleName: row.MiddleI ?? null,
  lastName: row.LName ?? '',
  preferredName: row.Preferred ?? null,
  dateOfBirth: row.Birthdate ?? null,
  gender: mapGenderFromDb(row.Gender),
  ssn: row.SSN ?? null,
  phonePrimary: row.WirelessPhone ?? row.HmPhone ?? null,
  phoneSecondary: row.WkPhone ?? null,
  email: row.Email ?? null,
  address: {
    line1: row.Address ?? null,
    line2: row.Address2 ?? null,
    city: row.City ?? null,
    state: row.State ?? null,
    postalCode: row.Zip ?? null,
  },
  emergencyContact: null,
  isActive: row.PatStatus === null ? true : row.PatStatus !== 2,
  preferredLanguage: row.Language ?? 'en',
  communicationPreference: mapContactPreferenceFromDb(row.PreferContactMethod),
  portalAccessEnabled: false,
  lastVisitDate: row.DateFirstVisit ?? null,
  referralSource: null,
  notes: row.AddrNote ?? null,
  customFields: {},
});

export const mapProviderToApi = (
  row: provider,
  options?: {
    specialtyName?: string | null;
    userId?: string | null;
  }
) => ({
  _id: row.ProvNum.toString(),
  providerCode: row.Abbr ?? null,
  specialty: options?.specialtyName ? [options.specialtyName] : [],
  title: row.Suffix ?? null,
  userId: options?.userId
    ? {
        _id: options.userId,
        firstName: row.FName ?? '',
        lastName: row.LName ?? '',
        email: null,
      }
    : {
        _id: row.ProvNum.toString(),
        firstName: row.FName ?? '',
        lastName: row.LName ?? '',
        email: null,
      },
  appointmentBufferMinutes: 0,
  workingHours: [],
  maxDailyAppointments: null,
  isActive: !row.IsHidden,
});

export const mapUserToApi = (row: userod) => ({
  _id: row.UserNum.toString(),
  firstName: row.UserName ?? '',
  lastName: '',
  email: null,
});

export const mapAppointmentStatusFromDb = (status?: number | null): string => {
  switch (status) {
    case 1:
      return 'completed';
    case 3:
      return 'no_show';
    case 4:
      return 'cancelled';
    default:
      return 'scheduled';
  }
};

export const mapAppointmentStatusToDb = (status?: string | null): number => {
  switch (status) {
    case 'completed':
      return 1;
    case 'no_show':
      return 3;
    case 'cancelled':
      return 4;
    case 'checked_in':
    case 'confirmed':
    case 'scheduled':
    default:
      return 0;
  }
};

export const mapInsuranceTypeToOrdinal = (value?: string | null): number => {
  switch ((value || '').toLowerCase()) {
    case 'primary':
      return 1;
    case 'secondary':
      return 2;
    case 'tertiary':
      return 3;
    default:
      return 1;
  }
};

export const mapOrdinalToInsuranceType = (value?: number | null): string => {
  switch (value) {
    case 1:
      return 'primary';
    case 2:
      return 'secondary';
    case 3:
      return 'tertiary';
    default:
      return 'primary';
  }
};

export const mapRelationshipToDb = (value?: string | null): number => {
  switch ((value || '').toLowerCase()) {
    case 'self':
      return 0;
    case 'spouse':
      return 1;
    case 'child':
      return 2;
    case 'parent':
      return 3;
    default:
      return 4;
  }
};

export const mapRelationshipFromDb = (value?: number | null): string => {
  switch (value) {
    case 0:
      return 'self';
    case 1:
      return 'spouse';
    case 2:
      return 'child';
    case 3:
      return 'parent';
    default:
      return 'other';
  }
};

export const mapAppointmentToApi = (
  row: appointment,
  options?: {
    patient?: patient | null;
    provider?: provider | null;
    appointmentType?: appointmenttype | null;
    createdBy?: userod | null;
  }
) => {
  const startDateTime = row.AptDateTime ? new Date(row.AptDateTime) : null;
  const durationMinutes = parseDurationMinutes(row.Pattern);
  const startTime = startDateTime ? formatTime(startDateTime) : null;
  const endTime = startDateTime
    ? formatTime(new Date(startDateTime.getTime() + durationMinutes * 60000))
    : null;

  return {
    _id: row.AptNum.toString(),
    appointmentCode: `APT${row.AptNum.toString()}`,
    patientId: options?.patient ? mapPatientToApi(options.patient) : row.PatNum?.toString() ?? null,
    providerId: options?.provider ? mapProviderToApi(options.provider) : row.ProvNum?.toString() ?? null,
    appointmentTypeId: options?.appointmentType
      ? mapAppointmentTypeToApi(options.appointmentType)
      : row.AppointmentTypeNum?.toString() ?? null,
    appointmentDate: startDateTime,
    startTime,
    endTime,
    durationMinutes,
    appointmentType: 'consultation',
    roomId: row.Op?.toString() ?? null,
    createdBy: options?.createdBy ? mapUserToApi(options.createdBy) : row.SecUserNumEntry?.toString() ?? null,
    status: mapAppointmentStatusFromDb(row.AptStatus),
    chiefComplaint: row.ProcDescript ?? null,
    notes: row.Note ?? null,
    insuranceVerified: Boolean(row.InsPlan1 || row.InsPlan2),
    copayCollected: 0,
    requiresInterpreter: false,
    interpreterLanguage: null,
    reminderSent: false,
    customFields: {},
    cancellationReason: null,
    checkInAt: row.DateTimeArrived ?? null,
    completedAt: row.DateTimeDismissed ?? null,
    parentAppointmentId: row.NextAptNum?.toString() ?? null,
    patient: undefined,
    provider: undefined,
    appointmentTypeData: undefined,
    createdByUser: undefined,
  };
};
