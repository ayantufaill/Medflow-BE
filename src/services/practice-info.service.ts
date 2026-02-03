import { prisma } from '../config/db';
import { NotFoundError, ConflictError } from '../utils/error.util';
import { getNextId } from '../utils/opendental-ids.util';

export class PracticeInfoService {
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

    return {
      practiceInfo: rows.map((row) => ({
        _id: row.ClinicNum.toString(),
        practiceName: row.Description ?? '',
        taxId: null,
        npiNumber: null,
        phone: row.Phone ?? '',
        fax: row.Fax ?? null,
        email: null,
        website: null,
        address: {
          line1: row.Address ?? null,
          line2: row.Address2 ?? null,
          city: row.City ?? null,
          state: row.State ?? null,
          postalCode: row.Zip ?? null,
        },
        logoPath: null,
        businessHours: {},
        timezone: row.TimeZone ?? 'UTC',
        appointmentBufferMinutes: 0,
        billingContactEmail: null,
      })),
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
    return {
      _id: row.ClinicNum.toString(),
      practiceName: row.Description ?? '',
      taxId: null,
      npiNumber: null,
      phone: row.Phone ?? '',
      fax: row.Fax ?? null,
      email: null,
      website: null,
      address: {
        line1: row.Address ?? null,
        line2: row.Address2 ?? null,
        city: row.City ?? null,
        state: row.State ?? null,
        postalCode: row.Zip ?? null,
      },
      logoPath: null,
      businessHours: {},
      timezone: row.TimeZone ?? 'UTC',
      appointmentBufferMinutes: 0,
      billingContactEmail: null,
    };
  }

  async getPracticeInfo() {
    const row = await prisma.clinic.findFirst({
      orderBy: { ClinicNum: 'desc' },
    });
    if (!row) return null;
    return {
      _id: row.ClinicNum.toString(),
      practiceName: row.Description ?? '',
      taxId: null,
      npiNumber: null,
      phone: row.Phone ?? '',
      fax: row.Fax ?? null,
      email: null,
      website: null,
      address: {
        line1: row.Address ?? null,
        line2: row.Address2 ?? null,
        city: row.City ?? null,
        state: row.State ?? null,
        postalCode: row.Zip ?? null,
      },
      logoPath: null,
      businessHours: {},
      timezone: row.TimeZone ?? 'UTC',
      appointmentBufferMinutes: 0,
      billingContactEmail: null,
    };
  }

  async createPracticeInfo(data: {
    practiceName: string;
    taxId?: string;
    npiNumber?: string;
    phone: string;
    fax?: string;
    email: string;
    website?: string;
    address: {
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      postalCode?: string;
    };
    logoPath?: string;
    businessHours?: Map<string, any> | Record<string, any>;
    timezone?: string;
    appointmentBufferMinutes?: number;
    billingContactEmail?: string;
  }) {
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
      },
    });

    return {
      _id: clinic.ClinicNum.toString(),
      practiceName: clinic.Description ?? '',
      taxId: null,
      npiNumber: null,
      phone: clinic.Phone ?? '',
      fax: clinic.Fax ?? null,
      email: null,
      website: null,
      address: {
        line1: clinic.Address ?? null,
        line2: clinic.Address2 ?? null,
        city: clinic.City ?? null,
        state: clinic.State ?? null,
        postalCode: clinic.Zip ?? null,
      },
      logoPath: null,
      businessHours: {},
      timezone: clinic.TimeZone ?? 'UTC',
      appointmentBufferMinutes: 0,
      billingContactEmail: null,
    };
  }

  async updatePracticeInfo(practiceInfoId: string, updates: {
    practiceName?: string;
    taxId?: string;
    npiNumber?: string;
    phone?: string;
    fax?: string;
    email?: string;
    website?: string;
    address?: {
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      postalCode?: string;
    };
    logoPath?: string;
    businessHours?: Map<string, any> | Record<string, any>;
    timezone?: string;
    appointmentBufferMinutes?: number;
    billingContactEmail?: string;
  }) {
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
      },
    });

    return {
      _id: updated.ClinicNum.toString(),
      practiceName: updated.Description ?? '',
      taxId: null,
      npiNumber: null,
      phone: updated.Phone ?? '',
      fax: updated.Fax ?? null,
      email: null,
      website: null,
      address: {
        line1: updated.Address ?? null,
        line2: updated.Address2 ?? null,
        city: updated.City ?? null,
        state: updated.State ?? null,
        postalCode: updated.Zip ?? null,
      },
      logoPath: null,
      businessHours: {},
      timezone: updated.TimeZone ?? 'UTC',
      appointmentBufferMinutes: 0,
      billingContactEmail: null,
    };
  }

  async deletePracticeInfo(practiceInfoId: string): Promise<void> {
    const clinic = await prisma.clinic.findUnique({
      where: { ClinicNum: BigInt(practiceInfoId) },
    });
    if (!clinic) {
      throw new NotFoundError('Practice info not found');
    }

    await prisma.clinic.delete({ where: { ClinicNum: clinic.ClinicNum } });
  }
}

export const practiceInfoService = new PracticeInfoService();
