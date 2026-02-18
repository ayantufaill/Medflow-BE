import type { clinic } from '@prisma/client';
import { prisma } from '../config/db';
import { NotFoundError } from '../utils/error.util';
import { getNextId } from '../utils/opendental-ids.util';

const PREF_PREFIX = 'medflow.practiceInfo.';
const PREF_TAX_ID = `${PREF_PREFIX}taxId`;
const PREF_NPI_NUMBER = `${PREF_PREFIX}npiNumber`;
const PREF_EMAIL = `${PREF_PREFIX}email`;
const PREF_WEBSITE = `${PREF_PREFIX}website`;
const PREF_LOGO_PATH = `${PREF_PREFIX}logoPath`;
const PREF_BUSINESS_HOURS = `${PREF_PREFIX}businessHours`;
const PREF_APPT_BUFFER_MINUTES = `${PREF_PREFIX}appointmentBufferMinutes`;
const PREF_BILLING_CONTACT_EMAIL = `${PREF_PREFIX}billingContactEmail`;

type PracticeInfoMeta = {
  taxId?: string | null;
  npiNumber?: string | null;
  email?: string | null;
  website?: string | null;
  logoPath?: string | null;
  businessHours?: Record<string, unknown>;
  appointmentBufferMinutes?: number | null;
  billingContactEmail?: string | null;
};

type PracticeInfoPayload = {
  practiceName: string;
  taxId?: string;
  npiNumber?: string;
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
  };
  logoPath?: string;
  businessHours?: Map<string, unknown> | Record<string, unknown>;
  timezone?: string;
  appointmentBufferMinutes?: number;
  billingContactEmail?: string;
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
      },
      logoPath: meta.logoPath ?? null,
      businessHours: meta.businessHours ?? {},
      timezone: row.TimeZone ?? 'UTC',
      appointmentBufferMinutes: meta.appointmentBufferMinutes ?? 0,
      billingContactEmail: meta.billingContactEmail ?? null,
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
}

export const practiceInfoService = new PracticeInfoService();
