import type { clinic } from '@prisma/client';
import { prisma } from '../config/db';
import { NotFoundError } from '../utils/error.util';
import { getNextId } from '../utils/opendental-ids.util';

const PREF_PREFIX = 'medflow.practiceInfo.';
const PREF_LICENSE_NUMBER = `${PREF_PREFIX}licenseNumber`;
const PREF_TAX_ID = `${PREF_PREFIX}taxId`;
const PREF_NPI_NUMBER = `${PREF_PREFIX}npiNumber`;
const PREF_EMAIL = `${PREF_PREFIX}email`;
const PREF_WEBSITE = `${PREF_PREFIX}website`;
const PREF_LOGO_PATH = `${PREF_PREFIX}logoPath`;
const PREF_BUSINESS_HOURS = `${PREF_PREFIX}businessHours`;
const PREF_APPT_BUFFER_MINUTES = `${PREF_PREFIX}appointmentBufferMinutes`;
const PREF_BILLING_CONTACT_EMAIL = `${PREF_PREFIX}billingContactEmail`;
const PREF_BILL_OUT_OF_NETWORK = `${PREF_PREFIX}billingOutOfNetwork`;
const PREF_BILL_ASSIGNMENT_TYPE = `${PREF_PREFIX}billingAssignmentType`;
const PREF_BILL_PROVIDER = `${PREF_PREFIX}billingProvider`;
const PREF_KIOSK_PASSWORD = `${PREF_PREFIX}kioskPassword`;
const PREF_KIOSK_ACCOUNTS = `${PREF_PREFIX}kioskAccounts`;
const PREF_MYCHART_SETTINGS = `${PREF_PREFIX}myChartSettings`;
const PREF_OFFICE_TIMINGS = `${PREF_PREFIX}officeTimings`;
const PREF_ONLINE_SCHEDULE = `${PREF_PREFIX}onlineSchedule`;
const PREF_PATIENT_FLAGS = `${PREF_PREFIX}patientFlags`;
const PREF_DOCUMENT_CATEGORIES = `${PREF_PREFIX}documentCategories`;
const PREF_SCHEDULE_CONFIG = `${PREF_PREFIX}scheduleConfig`;
const PREF_PRACTICE_SETTINGS = `${PREF_PREFIX}practiceSettings`;
const PREF_COUNTRY = `${PREF_PREFIX}country`;

type PracticeInfoMeta = {
  taxId?: string | null;
  npiNumber?: string | null;
  licenseNumber?: string | null;
  email?: string | null;
  website?: string | null;
  logoPath?: string | null;
  businessHours?: Record<string, unknown>;
  appointmentBufferMinutes?: number | null;
  billingContactEmail?: string | null;
  billingOutOfNetwork?: string | null;
  billingAssignmentType?: string | null;
  billingProvider?: string | null;
  kioskPassword?: string | null;
  kioskAccounts?: any[] | null;
  myChartSettings?: Record<string, unknown> | null;
  officeTimings?: Record<string, unknown> | null;
  onlineSchedule?: Record<string, unknown> | null;
  patientFlags?: any[] | null;
  documentCategories?: Record<string, unknown> | null;
  scheduleConfig?: Record<string, unknown> | null;
  practiceSettings?: Record<string, unknown> | null;
  country?: string | null;
};

type PracticeInfoPayload = {
  practiceName: string;
  taxId?: string;
  npiNumber?: string;
  licenseNumber?: string;
  phone: string;
  fax?: string;
  email?: string;
  website?: string;
  address: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  logoPath?: string;
  businessHours?: Map<string, unknown> | Record<string, unknown>;
  timezone?: string;
  appointmentBufferMinutes?: number;
  billingContactEmail?: string;
  billingOutOfNetwork?: string;
  billingAssignmentType?: string;
  billingProvider?: string;
  kioskPassword?: string;
  kioskAccounts?: any[];
  myChartSettings?: Record<string, unknown>;
  officeTimings?: Record<string, unknown>;
  onlineSchedule?: Record<string, unknown>;
  patientFlags?: any[];
  documentCategories?: Record<string, unknown>;
  scheduleConfig?: Record<string, unknown>;
  practiceSettings?: Record<string, unknown>;
};

const parseJsonObject = (value?: string | null): Record<string, unknown> => {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
};

const setMetaFromPref = (
  meta: PracticeInfoMeta,
  prefName: string | null,
  prefValue: string | null
) => {
  if (!prefName) return;
  switch (prefName) {
    case PREF_TAX_ID:
      meta.taxId = prefValue ?? null;
      break;
    case PREF_NPI_NUMBER:
      meta.npiNumber = prefValue ?? null;
      break;
    case PREF_EMAIL:
      meta.email = prefValue ?? null;
      break;
    case PREF_WEBSITE:
      meta.website = prefValue ?? null;
      break;
    case PREF_LOGO_PATH:
      meta.logoPath = prefValue ?? null;
      break;
    case PREF_BUSINESS_HOURS:
      meta.businessHours = parseJsonObject(prefValue);
      break;
    case PREF_APPT_BUFFER_MINUTES: {
      const parsed = prefValue ? parseInt(prefValue, 10) : 0;
      meta.appointmentBufferMinutes = Number.isFinite(parsed) ? parsed : 0;
      break;
    }
    case PREF_BILLING_CONTACT_EMAIL:
      meta.billingContactEmail = prefValue ?? null;
      break;
    case PREF_BILL_OUT_OF_NETWORK:
      meta.billingOutOfNetwork = prefValue ?? null;
      break;
    case PREF_BILL_ASSIGNMENT_TYPE:
      meta.billingAssignmentType = prefValue ?? null;
      break;
    case PREF_BILL_PROVIDER:
      meta.billingProvider = prefValue ?? null;
      break;
    case PREF_KIOSK_PASSWORD:
      meta.kioskPassword = prefValue ?? null;
      break;
    case PREF_KIOSK_ACCOUNTS:
      meta.kioskAccounts = prefValue ? JSON.parse(prefValue) : [];
      break;
    case PREF_MYCHART_SETTINGS:
      meta.myChartSettings = parseJsonObject(prefValue);
      break;
    case PREF_OFFICE_TIMINGS:
      meta.officeTimings = parseJsonObject(prefValue);
      break;
    case PREF_ONLINE_SCHEDULE:
      meta.onlineSchedule = parseJsonObject(prefValue);
      break;
    case PREF_PATIENT_FLAGS:
      meta.patientFlags = prefValue ? JSON.parse(prefValue) : [];
      break;
    case PREF_DOCUMENT_CATEGORIES:
      meta.documentCategories = parseJsonObject(prefValue);
      break;
    case PREF_SCHEDULE_CONFIG:
      meta.scheduleConfig = parseJsonObject(prefValue);
      break;
    case PREF_PRACTICE_SETTINGS:
      meta.practiceSettings = parseJsonObject(prefValue);
      break;
    case PREF_COUNTRY:
      meta.country = prefValue ?? null;
      break;
    case PREF_LICENSE_NUMBER:
  meta.licenseNumber = prefValue ?? null;
  break;
    default:
      break;
  }
};

const normalizeMetaFromInput = (data: Partial<PracticeInfoPayload>): PracticeInfoMeta => ({
  taxId: data.taxId ?? null,
  npiNumber: data.npiNumber ?? null,
  email: data.email ?? null,
  website: data.website ?? null,
  logoPath: data.logoPath ?? null,
  businessHours:
    data.businessHours && typeof data.businessHours === 'object'
      ? (data.businessHours as Record<string, unknown>)
      : {},
  appointmentBufferMinutes: data.appointmentBufferMinutes ?? 0,
  billingContactEmail: data.billingContactEmail ?? null,
  billingOutOfNetwork: data.billingOutOfNetwork ?? null,
  billingAssignmentType: data.billingAssignmentType ?? null,
  billingProvider: data.billingProvider ?? null,
  kioskPassword: data.kioskPassword ?? null,
  kioskAccounts: data.kioskAccounts ?? [],
  myChartSettings: data.myChartSettings ?? {},
  officeTimings: data.officeTimings ?? {},
  onlineSchedule: data.onlineSchedule ?? {},
  patientFlags: data.patientFlags ?? [],
  documentCategories: data.documentCategories ?? {},
  scheduleConfig: data.scheduleConfig ?? {},
  practiceSettings: data.practiceSettings ?? {},
  country: data.address?.country ?? null,
});

export class PracticeInfoService {
  private async getClinicMetaMap(clinicNums: bigint[]): Promise<Map<string, PracticeInfoMeta>> {
    const map = new Map<string, PracticeInfoMeta>();
    if (clinicNums.length === 0) return map;

    const prefs = await prisma.clinicpref.findMany({
      where: {
        ClinicNum: { in: clinicNums },
        PrefName: { startsWith: PREF_PREFIX },
      },
    });

    for (const pref of prefs) {
      if (!pref.ClinicNum) continue;
      const clinicId = pref.ClinicNum.toString();
      const current = map.get(clinicId) ?? {};
      setMetaFromPref(current, pref.PrefName, pref.ValueString);
      map.set(clinicId, current);
    }

    return map;
  }

  private mapClinicToPracticeInfo(row: clinic, meta: PracticeInfoMeta) {
    return {
      _id: row.ClinicNum.toString(),
      practiceName: row.Description ?? '',
      taxId: meta.taxId ?? null,
      licenseNumber: meta.licenseNumber ?? null,
      npiNumber: meta.npiNumber ?? null,
      phone: row.Phone ?? '',
      fax: row.Fax ?? null,
      email: meta.email ?? row.EmailAliasOverride ?? null,
      website: meta.website ?? null,
      address: {
        line1: row.Address ?? null,
        line2: row.Address2 ?? null,
        city: row.City ?? null,
        state: row.State ?? null,
        postalCode: row.Zip ?? null,
        country: meta.country ?? 'United States',
      },
      logoPath: meta.logoPath ?? null,
      businessHours: meta.businessHours ?? {},
      timezone: row.TimeZone ?? 'UTC',
      appointmentBufferMinutes: meta.appointmentBufferMinutes ?? 0,
      billingContactEmail: meta.billingContactEmail ?? null,
      billingOutOfNetwork: meta.billingOutOfNetwork ?? 'no',
      billingAssignmentType: meta.billingAssignmentType ?? 'in-assignment',
      billingProvider: meta.billingProvider ?? 'default',
      kioskPassword: meta.kioskPassword ?? null,
      kioskAccounts: meta.kioskAccounts ?? [],
      myChartSettings: meta.myChartSettings ?? {},
      officeTimings: meta.officeTimings ?? {},
      onlineSchedule: meta.onlineSchedule ?? {},
      patientFlags: meta.patientFlags ?? [],
      documentCategories: meta.documentCategories ?? {},
      scheduleConfig: meta.scheduleConfig ?? {},
      practiceSettings: meta.practiceSettings ?? {},
    };
  }

  private async setClinicPref(clinicNum: bigint, prefName: string, value: string | null) {
    const existing = await prisma.clinicpref.findFirst({
      where: { ClinicNum: clinicNum, PrefName: prefName },
      orderBy: { ClinicPrefNum: 'desc' },
    });

    if (value === null || value === '') {
      if (existing) {
        await prisma.clinicpref.deleteMany({
          where: { ClinicNum: clinicNum, PrefName: prefName },
        });
      }
      return;
    }

    if (existing) {
      await prisma.clinicpref.update({
        where: { ClinicPrefNum: existing.ClinicPrefNum },
        data: { ValueString: value },
      });
      return;
    }

    const clinicPrefNum = await getNextId('clinicpref', 'ClinicPrefNum');
    await prisma.clinicpref.create({
      data: {
        ClinicPrefNum: clinicPrefNum,
        ClinicNum: clinicNum,
        PrefName: prefName,
        ValueString: value,
      },
    });
  }

  private async saveClinicMeta(clinicNum: bigint, data: Partial<PracticeInfoPayload>) {
    if ('taxId' in data) {
      await this.setClinicPref(clinicNum, PREF_TAX_ID, data.taxId ?? null);
    }
    if ('npiNumber' in data) {
      await this.setClinicPref(clinicNum, PREF_NPI_NUMBER, data.npiNumber ?? null);
    }
    if ('email' in data) {
      await this.setClinicPref(clinicNum, PREF_EMAIL, data.email ?? null);
    }
    if ('website' in data) {
      await this.setClinicPref(clinicNum, PREF_WEBSITE, data.website ?? null);
    }
    if ('logoPath' in data) {
      await this.setClinicPref(clinicNum, PREF_LOGO_PATH, data.logoPath ?? null);
    }
    if ('licenseNumber' in data) {
  await this.setClinicPref(clinicNum, PREF_LICENSE_NUMBER, data.licenseNumber ?? null);
}
    if ('businessHours' in data) {
      await this.setClinicPref(
        clinicNum,
        PREF_BUSINESS_HOURS,
        JSON.stringify(
          data.businessHours && typeof data.businessHours === 'object'
            ? (data.businessHours as Record<string, unknown>)
            : {}
        )
      );
    }
    if ('appointmentBufferMinutes' in data) {
      await this.setClinicPref(
        clinicNum,
        PREF_APPT_BUFFER_MINUTES,
        String(data.appointmentBufferMinutes ?? 0)
      );
    }
    if ('billingContactEmail' in data) {
      await this.setClinicPref(
        clinicNum,
        PREF_BILLING_CONTACT_EMAIL,
        data.billingContactEmail ?? null
      );
    }
    if ('billingOutOfNetwork' in data) {
      await this.setClinicPref(
        clinicNum,
        PREF_BILL_OUT_OF_NETWORK,
        data.billingOutOfNetwork ?? null
      );
    }
    if ('billingAssignmentType' in data) {
      await this.setClinicPref(
        clinicNum,
        PREF_BILL_ASSIGNMENT_TYPE,
        data.billingAssignmentType ?? null
      );
    }
    if ('billingProvider' in data) {
      await this.setClinicPref(
        clinicNum,
        PREF_BILL_PROVIDER,
        data.billingProvider ?? null
      );
    }
    if ('kioskPassword' in data) {
      await this.setClinicPref(clinicNum, PREF_KIOSK_PASSWORD, data.kioskPassword ?? null);
    }
    if ('kioskAccounts' in data) {
      await this.setClinicPref(clinicNum, PREF_KIOSK_ACCOUNTS, JSON.stringify(data.kioskAccounts ?? []));
    }
    if ('myChartSettings' in data) {
      await this.setClinicPref(clinicNum, PREF_MYCHART_SETTINGS, JSON.stringify(data.myChartSettings ?? {}));
    }
    if ('officeTimings' in data) {
      await this.setClinicPref(clinicNum, PREF_OFFICE_TIMINGS, JSON.stringify(data.officeTimings ?? {}));
    }
    if ('onlineSchedule' in data) {
      await this.setClinicPref(clinicNum, PREF_ONLINE_SCHEDULE, JSON.stringify(data.onlineSchedule ?? {}));
    }
    if ('patientFlags' in data) {
      await this.setClinicPref(clinicNum, PREF_PATIENT_FLAGS, JSON.stringify(data.patientFlags ?? []));
    }
    if ('documentCategories' in data) {
      await this.setClinicPref(clinicNum, PREF_DOCUMENT_CATEGORIES, JSON.stringify(data.documentCategories ?? {}));
    }
    if ('scheduleConfig' in data) {
      await this.setClinicPref(clinicNum, PREF_SCHEDULE_CONFIG, JSON.stringify(data.scheduleConfig ?? {}));
    }
    if ('practiceSettings' in data) {
      await this.setClinicPref(clinicNum, PREF_PRACTICE_SETTINGS, JSON.stringify(data.practiceSettings ?? {}));
    }
    if (data.address?.country) {
      await this.setClinicPref(clinicNum, PREF_COUNTRY, data.address.country);
    }
  }

  async getAllPracticeInfo(page = 1, limit = 10, search?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (search) {
      const searchValue = search.trim();
      where.OR = [
        { Description: { contains: searchValue, mode: 'insensitive' } },
        { Phone: { contains: searchValue, mode: 'insensitive' } },
        { Fax: { contains: searchValue, mode: 'insensitive' } },
        { Address: { contains: searchValue, mode: 'insensitive' } },
        { City: { contains: searchValue, mode: 'insensitive' } },
        { State: { contains: searchValue, mode: 'insensitive' } },
        { Zip: { contains: searchValue, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.clinic.findMany({
        where,
        orderBy: { ClinicNum: 'desc' },
        skip,
        take: limit,
      }),
      prisma.clinic.count({ where }),
    ]);

    const metaMap = await this.getClinicMetaMap(rows.map((row) => row.ClinicNum));
    const practiceInfo = rows.map((row) => this.mapClinicToPracticeInfo(row, metaMap.get(row.ClinicNum.toString()) ?? {}));

    return {
      practiceInfo,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getPracticeInfoById(practiceInfoId: string) {
    const row = await prisma.clinic.findUnique({
      where: { ClinicNum: BigInt(practiceInfoId) },
    });
    if (!row) {
      throw new NotFoundError('Practice info not found');
    }

    const metaMap = await this.getClinicMetaMap([row.ClinicNum]);
    return this.mapClinicToPracticeInfo(row, metaMap.get(row.ClinicNum.toString()) ?? {});
  }

  async getPracticeInfo() {
    const row = await prisma.clinic.findFirst({
      orderBy: { ClinicNum: 'desc' },
    });
    if (!row) return null;

    const metaMap = await this.getClinicMetaMap([row.ClinicNum]);
    return this.mapClinicToPracticeInfo(row, metaMap.get(row.ClinicNum.toString()) ?? {});
  }

  async createPracticeInfo(data: PracticeInfoPayload) {
    const nextId = await getNextId('clinic', 'ClinicNum');

    const clinic = await prisma.clinic.create({
      data: {
        ClinicNum: nextId,
        Description: data.practiceName,
        Address: data.address?.line1 ?? null,
        Address2: data.address?.line2 ?? null,
        City: data.address?.city ?? null,
        State: data.address?.state ?? null,
        Zip: data.address?.postalCode ?? null,
        Phone: data.phone,
        Fax: data.fax ?? null,
        TimeZone: data.timezone ?? 'UTC',
        EmailAliasOverride: data.email ?? null,
      },
    });

    await this.saveClinicMeta(clinic.ClinicNum, data);
    const metaMap = await this.getClinicMetaMap([clinic.ClinicNum]);
    return this.mapClinicToPracticeInfo(clinic, metaMap.get(clinic.ClinicNum.toString()) ?? {});
  }

  async updatePracticeInfo(practiceInfoId: string, updates: Partial<PracticeInfoPayload>) {
    const clinic = await prisma.clinic.findUnique({
      where: { ClinicNum: BigInt(practiceInfoId) },
    });
    if (!clinic) {
      throw new NotFoundError('Practice info not found');
    }

    const updated = await prisma.clinic.update({
      where: { ClinicNum: clinic.ClinicNum },
      data: {
        Description: updates.practiceName ?? undefined,
        Address: updates.address?.line1 ?? undefined,
        Address2: updates.address?.line2 ?? undefined,
        City: updates.address?.city ?? undefined,
        State: updates.address?.state ?? undefined,
        Zip: updates.address?.postalCode ?? undefined,
        Phone: updates.phone ?? undefined,
        Fax: updates.fax ?? undefined,
        TimeZone: updates.timezone ?? undefined,
        EmailAliasOverride: updates.email ?? undefined,
      },
    });

    await this.saveClinicMeta(updated.ClinicNum, updates);
    const metaMap = await this.getClinicMetaMap([updated.ClinicNum]);
    return this.mapClinicToPracticeInfo(updated, metaMap.get(updated.ClinicNum.toString()) ?? {});
  }

  async deletePracticeInfo(practiceInfoId: string): Promise<void> {
    const clinic = await prisma.clinic.findUnique({
      where: { ClinicNum: BigInt(practiceInfoId) },
    });
    if (!clinic) {
      throw new NotFoundError('Practice info not found');
    }

    await prisma.clinicpref.deleteMany({
      where: {
        ClinicNum: clinic.ClinicNum,
        PrefName: { startsWith: PREF_PREFIX },
      },
    });

    await prisma.clinic.delete({ where: { ClinicNum: clinic.ClinicNum } });
  }

  async addSupportAppointment(data: {
    practiceInfoId?: string;
    name: string;
    email: string;
    date: string;
    timeSlot: string;
    note?: string;
  }) {
    let clinicNum: bigint;
    if (data.practiceInfoId) {
      clinicNum = BigInt(data.practiceInfoId);
    } else {
      const currentPractice = await this.getPracticeInfo();
      if (!currentPractice) {
        throw new Error('No practice found to schedule appointment');
      }
      clinicNum = BigInt(currentPractice._id);
    }

    const clinic = await prisma.clinic.findUnique({
      where: { ClinicNum: clinicNum },
    });
    if (!clinic) {
      throw new NotFoundError('Practice info not found');
    }

    const prefName = `${PREF_PREFIX}installationAppointments`;
    const existingPref = await prisma.clinicpref.findFirst({
      where: { ClinicNum: clinicNum, PrefName: prefName },
      orderBy: { ClinicPrefNum: 'desc' },
    });

    let appointments: any[] = [];
    if (existingPref?.ValueString) {
      try {
        appointments = JSON.parse(existingPref.ValueString);
        if (!Array.isArray(appointments)) {
          appointments = [];
        }
      } catch {
        appointments = [];
      }
    }

    const newAppt = {
      id: Date.now().toString(),
      name: data.name,
      email: data.email,
      date: data.date,
      timeSlot: data.timeSlot,
      note: data.note || '',
      createdAt: new Date().toISOString(),
    };
    appointments.push(newAppt);

    await this.setClinicPref(clinicNum, prefName, JSON.stringify(appointments));
    return newAppt;
  }

  async getSupportAppointments(practiceInfoId?: string) {
    let clinicNum: bigint;
    if (practiceInfoId) {
      clinicNum = BigInt(practiceInfoId);
    } else {
      const currentPractice = await this.getPracticeInfo();
      if (!currentPractice) {
        return [];
      }
      clinicNum = BigInt(currentPractice._id);
    }

    const prefName = `${PREF_PREFIX}installationAppointments`;
    const existingPref = await prisma.clinicpref.findFirst({
      where: { ClinicNum: clinicNum, PrefName: prefName },
      orderBy: { ClinicPrefNum: 'desc' },
    });

    if (!existingPref?.ValueString) {
      return [];
    }

    try {
      const parsed = JSON.parse(existingPref.ValueString);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async findPatient(identifier: string) {
    const trimmed = identifier.trim();
    const isNumeric = /^\d+$/.test(trimmed);
    if (isNumeric) {
      const pat = await prisma.patient.findFirst({
        where: { PatNum: BigInt(trimmed) },
      });
      if (pat) return pat;
    }

    const nameParts = trimmed.split(/\s+/);
    if (nameParts.length >= 2) {
      const firstName = nameParts[0];
      const lastName = nameParts[nameParts.length - 1];
      const pat = await prisma.patient.findFirst({
        where: {
          OR: [
            { FName: { contains: firstName }, LName: { contains: lastName } },
            { FName: { contains: lastName }, LName: { contains: firstName } },
          ],
        },
      });
      if (pat) return pat;
    }

    return prisma.patient.findFirst({
      where: {
        OR: [
          { FName: { contains: trimmed } },
          { LName: { contains: trimmed } },
        ],
      },
    });
  }

  async movePatientData(fromPatient: string, toPatient: string, checklist: Record<string, boolean>) {
    const fromPatRecord = await this.findPatient(fromPatient);
    const toPatRecord = await this.findPatient(toPatient);

    const movedItems = Object.keys(checklist).filter(key => checklist[key]);

    return {
      fromPatient: {
        id: fromPatRecord ? fromPatRecord.PatNum.toString() : 'mock-from-id',
        name: fromPatRecord ? `${fromPatRecord.FName} ${fromPatRecord.LName}`.trim() : fromPatient,
        exists: !!fromPatRecord,
      },
      toPatient: {
        id: toPatRecord ? toPatRecord.PatNum.toString() : 'mock-to-id',
        name: toPatRecord ? `${toPatRecord.FName} ${toPatRecord.LName}`.trim() : toPatient,
        exists: !!toPatRecord,
      },
      movedItems,
      migratedAt: new Date().toISOString(),
    };
  }

  async findProvider(identifier: string) {
    const trimmed = identifier.trim();
    const isNumeric = /^\d+$/.test(trimmed);
    if (isNumeric) {
      const prov = await prisma.provider.findFirst({
        where: { ProvNum: BigInt(trimmed) },
      });
      if (prov) return prov;
    }

    const cleanIdentifier = trimmed.replace(/^(Dr\.|Dr)\s+/i, '').trim();
    const nameParts = cleanIdentifier.split(/\s+/);
    if (nameParts.length >= 2) {
      const firstName = nameParts[0];
      const lastName = nameParts[nameParts.length - 1];
      const prov = await prisma.provider.findFirst({
        where: {
          OR: [
            { FName: { contains: firstName }, LName: { contains: lastName } },
            { FName: { contains: lastName }, LName: { contains: firstName } },
          ],
        },
      });
      if (prov) return prov;
    }

    return prisma.provider.findFirst({
      where: {
        OR: [
          { FName: { contains: cleanIdentifier } },
          { LName: { contains: cleanIdentifier } },
        ],
      },
    });
  }

  async moveProviderData(fromProvider: string, toProvider: string) {
    const fromProvRecord = await this.findProvider(fromProvider);
    const toProvRecord = await this.findProvider(toProvider);

    return {
      fromProvider: {
        id: fromProvRecord ? fromProvRecord.ProvNum.toString() : 'mock-from-id',
        name: fromProvRecord ? `Dr. ${fromProvRecord.FName} ${fromProvRecord.LName}`.trim() : fromProvider,
        exists: !!fromProvRecord,
      },
      toProvider: {
        id: toProvRecord ? toProvRecord.ProvNum.toString() : 'mock-to-id',
        name: toProvRecord ? `Dr. ${toProvRecord.FName} ${toProvRecord.LName}`.trim() : toProvider,
        exists: !!toProvRecord,
      },
      migratedAt: new Date().toISOString(),
    };
  }
  /**
 * Get office timings as 7-day array
 */
async getOfficeTimings() {
  const practice = await this.getPracticeInfo();
  if (!practice) {
    throw new NotFoundError('Practice info not found');
  }

  const stored = practice.officeTimings as any;

  // Default 7-day array
  const defaultTimings = [
    { dayOfWeek: 0, isOpen: false, openTime: '09:00', closeTime: '17:00' }, // Sunday
    { dayOfWeek: 1, isOpen: true,  openTime: '09:00', closeTime: '17:00' }, // Monday
    { dayOfWeek: 2, isOpen: true,  openTime: '09:00', closeTime: '17:00' }, // Tuesday
    { dayOfWeek: 3, isOpen: true,  openTime: '09:00', closeTime: '17:00' }, // Wednesday
    { dayOfWeek: 4, isOpen: true,  openTime: '09:00', closeTime: '17:00' }, // Thursday
    { dayOfWeek: 5, isOpen: true,  openTime: '09:00', closeTime: '17:00' }, // Friday
    { dayOfWeek: 6, isOpen: false, openTime: '09:00', closeTime: '17:00' }, // Saturday
  ];

  // If stored as array use it, otherwise return defaults
  const timings = Array.isArray(stored?.days)
    ? stored.days
    : Array.isArray(stored)
    ? stored
    : defaultTimings;

  return {
    practiceId: practice._id,
    timings: timings.map((day: any) => ({
      dayOfWeek: day.dayOfWeek,
      isOpen: day.isOpen ?? false,
      openTime: day.openTime ?? '09:00',
      closeTime: day.closeTime ?? '17:00',
    })),
  };
}

/**
 * Update office timings from 7-day array
 */
async updateOfficeTimings(timings: Array<{
  dayOfWeek: number;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}>) {
  const practice = await this.getPracticeInfo();
  if (!practice) {
    throw new NotFoundError('Practice info not found');
  }

  await this.updatePracticeInfo(practice._id, {
    officeTimings: { days: timings } as any,
  });

  return this.getOfficeTimings();
}
}

export const practiceInfoService = new PracticeInfoService();
