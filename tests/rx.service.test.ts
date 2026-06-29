import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RxService } from '../src/services/rx.service';
import { NotFoundError } from '../src/utils/error.util';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../src/config/db', () => ({
  prisma: {
    rxpat: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    provider: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    medication: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    patient: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../src/utils/opendental-ids.util', () => ({
  getNextId: vi.fn(),
}));

vi.mock('../src/utils/opendental-auth.util', () => ({
  getRxsMeta: vi.fn(),
  setRxMeta: vi.fn(),
}));

import { prisma } from '../src/config/db';
import { getNextId } from '../src/utils/opendental-ids.util';
import { getRxsMeta, setRxMeta } from '../src/utils/opendental-auth.util';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeRxRow = (overrides = {}) => ({
  RxNum: BigInt(501),
  PatNum: BigInt(1),
  ProvNum: BigInt(10),
  Drug: 'Amoxicillin 500mg',
  RxCui: null,
  RxDate: new Date('2025-08-01'),
  Disp: '30',
  Refills: '1',
  Sig: 'Take twice daily',
  PatientInstruction: 'Take twice daily',
  Notes: '',
  ...overrides,
});

const makeProvider = (overrides = {}) => ({
  ProvNum: BigInt(10),
  FName: 'Sarah',
  LName: 'Mitchell',
  ...overrides,
});

const makeMedication = (overrides = {}) => ({
  MedicationNum: BigInt(42),
  MedName: 'Amoxicillin',
  RxCui: BigInt(723),
  ...overrides,
});

// ---------------------------------------------------------------------------
// RxService — getPrescriptions
// ---------------------------------------------------------------------------

describe('RxService.getPrescriptions', () => {
  let service: RxService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new RxService();
  });

  it('returns paginated prescriptions with default page and limit', async () => {
    const row = makeRxRow();
    vi.mocked(prisma.rxpat.findMany).mockResolvedValue([row] as any);
    vi.mocked(prisma.rxpat.count).mockResolvedValue(1);
    vi.mocked(prisma.provider.findMany).mockResolvedValue([makeProvider()] as any);
    vi.mocked(prisma.medication.findMany).mockResolvedValue([]);
    vi.mocked(getRxsMeta).mockResolvedValue({});

    const result = await service.getPrescriptions();

    expect(result.prescriptions).toHaveLength(1);
    expect(result.pagination).toMatchObject({ page: 1, limit: 25, total: 1 });
  });

  it('filters by patientId when provided', async () => {
    vi.mocked(prisma.rxpat.findMany).mockResolvedValue([]);
    vi.mocked(prisma.rxpat.count).mockResolvedValue(0);
    vi.mocked(prisma.provider.findMany).mockResolvedValue([]);
    vi.mocked(prisma.medication.findMany).mockResolvedValue([]);
    vi.mocked(getRxsMeta).mockResolvedValue({});

    await service.getPrescriptions('1');

    expect(prisma.rxpat.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { PatNum: BigInt('1') },
      })
    );
  });

  it('maps prescription fields correctly', async () => {
    const row = makeRxRow();
    vi.mocked(prisma.rxpat.findMany).mockResolvedValue([row] as any);
    vi.mocked(prisma.rxpat.count).mockResolvedValue(1);
    vi.mocked(prisma.provider.findMany).mockResolvedValue([makeProvider()] as any);
    vi.mocked(prisma.medication.findMany).mockResolvedValue([]);
    vi.mocked(getRxsMeta).mockResolvedValue({
      '501': { duration: '7 days', longTerm: 'No', prints: '2' },
    });

    const result = await service.getPrescriptions();
    const rx = result.prescriptions[0];

    expect(rx.id).toBe('501');
    expect(rx.rxNum).toBe('501');
    expect(rx.description).toBe('Amoxicillin 500mg');
    expect(rx.startDate).toBe('2025-08-01');
    expect(rx.duration).toBe('7 days');
    expect(rx.longTerm).toBe('No');
    expect(rx.prints).toBe('2');
    expect(rx.refills).toBe('1');
    expect(rx.dose).toBe('30');
    expect(rx.notes).toBe('Take twice daily');
    expect(rx.provider).toBe('Sarah Mitchell');
  });

  it('resolves medicationName via RxCui when available', async () => {
    const row = makeRxRow({ RxCui: BigInt(723) });
    vi.mocked(prisma.rxpat.findMany).mockResolvedValue([row] as any);
    vi.mocked(prisma.rxpat.count).mockResolvedValue(1);
    vi.mocked(prisma.provider.findMany).mockResolvedValue([makeProvider()] as any);
    vi.mocked(prisma.medication.findMany).mockResolvedValue([makeMedication()] as any);
    vi.mocked(getRxsMeta).mockResolvedValue({});

    const result = await service.getPrescriptions();

    expect(result.prescriptions[0].medicationName).toBe('Amoxicillin');
  });

  it('falls back to Drug text when no RxCui match', async () => {
    const row = makeRxRow({ RxCui: null });
    vi.mocked(prisma.rxpat.findMany).mockResolvedValue([row] as any);
    vi.mocked(prisma.rxpat.count).mockResolvedValue(1);
    vi.mocked(prisma.provider.findMany).mockResolvedValue([]);
    vi.mocked(prisma.medication.findMany).mockResolvedValue([]);
    vi.mocked(getRxsMeta).mockResolvedValue({});

    const result = await service.getPrescriptions();

    expect(result.prescriptions[0].medicationName).toBe('Amoxicillin 500mg');
  });

  it('shows Unknown Provider when ProvNum is null', async () => {
    const row = makeRxRow({ ProvNum: null });
    vi.mocked(prisma.rxpat.findMany).mockResolvedValue([row] as any);
    vi.mocked(prisma.rxpat.count).mockResolvedValue(1);
    vi.mocked(prisma.provider.findMany).mockResolvedValue([]);
    vi.mocked(prisma.medication.findMany).mockResolvedValue([]);
    vi.mocked(getRxsMeta).mockResolvedValue({});

    const result = await service.getPrescriptions();

    expect(result.prescriptions[0].provider).toBe('Unknown Provider');
  });

  it('calculates pagination correctly', async () => {
    vi.mocked(prisma.rxpat.findMany).mockResolvedValue([]);
    vi.mocked(prisma.rxpat.count).mockResolvedValue(100);
    vi.mocked(prisma.provider.findMany).mockResolvedValue([]);
    vi.mocked(prisma.medication.findMany).mockResolvedValue([]);
    vi.mocked(getRxsMeta).mockResolvedValue({});

    const result = await service.getPrescriptions(undefined, 2, 25);

    expect(result.pagination).toMatchObject({
      page: 2,
      limit: 25,
      total: 100,
      pages: 4,
    });
  });

  it('applies skip correctly for pagination', async () => {
    vi.mocked(prisma.rxpat.findMany).mockResolvedValue([]);
    vi.mocked(prisma.rxpat.count).mockResolvedValue(0);
    vi.mocked(prisma.provider.findMany).mockResolvedValue([]);
    vi.mocked(prisma.medication.findMany).mockResolvedValue([]);
    vi.mocked(getRxsMeta).mockResolvedValue({});

    await service.getPrescriptions(undefined, 3, 10);

    expect(prisma.rxpat.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 })
    );
  });

  it('returns empty prescriptions array when no records found', async () => {
    vi.mocked(prisma.rxpat.findMany).mockResolvedValue([]);
    vi.mocked(prisma.rxpat.count).mockResolvedValue(0);
    vi.mocked(prisma.provider.findMany).mockResolvedValue([]);
    vi.mocked(prisma.medication.findMany).mockResolvedValue([]);
    vi.mocked(getRxsMeta).mockResolvedValue({});

    const result = await service.getPrescriptions();

    expect(result.prescriptions).toHaveLength(0);
    expect(result.pagination.total).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// RxService — createPrescription
// ---------------------------------------------------------------------------

describe('RxService.createPrescription', () => {
  let service: RxService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new RxService();

    vi.mocked(getNextId).mockResolvedValue(BigInt(502));
    vi.mocked(setRxMeta).mockResolvedValue(undefined as any);
    vi.mocked(prisma.rxpat.create).mockResolvedValue({
      RxNum: BigInt(502),
      PatNum: BigInt(1),
      ProvNum: BigInt(10),
      Drug: 'Amoxicillin 500mg',
      RxCui: null,
      RxDate: new Date('2025-08-01'),
      Disp: '30',
      Refills: '1',
      Sig: 'Take twice daily',
      PatientInstruction: 'Take twice daily',
      Notes: '',
    } as any);
    vi.mocked(prisma.provider.findUnique).mockResolvedValue(makeProvider() as any);
  });

  it('creates a prescription with free-text description', async () => {
    const result = await service.createPrescription({
      patientId: '1',
      description: 'Amoxicillin 500mg',
      dose: '30',
      refills: '1',
      notes: 'Take twice daily',
    });

    expect(prisma.rxpat.create).toHaveBeenCalledTimes(1);
    expect(result.id).toBe('502');
    expect(result.rxNum).toBe('502');
  });

  it('calls getNextId to get the next RxNum', async () => {
    await service.createPrescription({
      patientId: '1',
      description: 'Test drug',
    });

    expect(getNextId).toHaveBeenCalledWith('rxpat', 'RxNum');
  });

  it('passes patientId as BigInt to prisma.rxpat.create', async () => {
    await service.createPrescription({
      patientId: '42',
      description: 'Test drug',
    });

    expect(prisma.rxpat.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          PatNum: BigInt(42),
        }),
      })
    );
  });

  it('saves duration, longTerm, prints via setRxMeta', async () => {
    await service.createPrescription({
      patientId: '1',
      description: 'Test drug',
      duration: '10 days',
      longTerm: 'No',
      prints: '2',
    });

    expect(setRxMeta).toHaveBeenCalledWith(BigInt(502), {
      duration: '10 days',
      longTerm: 'No',
      prints: '2',
    });
  });

  it('uses current date when startDate is not provided', async () => {
    const before = new Date();
    await service.createPrescription({
      patientId: '1',
      description: 'Test drug',
    });
    const after = new Date();

    const createCall = vi.mocked(prisma.rxpat.create).mock.calls[0][0];
    const rxDate = createCall.data.RxDate as Date;
    expect(rxDate.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(rxDate.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('uses provided startDate when given', async () => {
    await service.createPrescription({
      patientId: '1',
      description: 'Test drug',
      startDate: '2025-09-15',
    });

    const createCall = vi.mocked(prisma.rxpat.create).mock.calls[0][0];
    const rxDate = createCall.data.RxDate as Date;
    expect(rxDate.toISOString().split('T')[0]).toBe('2025-09-15');
  });

  it('links medication via medicationId and sets RxCui', async () => {
    vi.mocked(prisma.medication.findUnique).mockResolvedValue(makeMedication() as any);

    await service.createPrescription({
      patientId: '1',
      medicationId: '42',
      description: 'Amoxicillin 500mg',
    });

    expect(prisma.medication.findUnique).toHaveBeenCalledWith({
      where: { MedicationNum: BigInt(42) },
    });

    expect(prisma.rxpat.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          RxCui: BigInt(723),
        }),
      })
    );
  });

  it('throws NotFoundError when medicationId does not exist', async () => {
    vi.mocked(prisma.medication.findUnique).mockResolvedValue(null);

    await expect(
      service.createPrescription({
        patientId: '1',
        medicationId: '999',
      })
    ).rejects.toThrow(NotFoundError);

    await expect(
      service.createPrescription({
        patientId: '1',
        medicationId: '999',
      })
    ).rejects.toThrow('Medication not found');
  });

  it('returns correct response shape', async () => {
    const result = await service.createPrescription({
      patientId: '1',
      description: 'Amoxicillin 500mg',
      dose: '30',
      refills: '1',
      duration: '7 days',
      longTerm: 'No',
      prints: '1',
      notes: 'Take with food',
    });

    expect(result).toMatchObject({
      id: expect.any(String),
      rxNum: expect.any(String),
      description: expect.any(String),
      startDate: expect.any(String),
      duration: '7 days',
      longTerm: 'No',
      prints: '1',
      refills: expect.any(String),
      dose: expect.any(String),
      provider: expect.any(String),
      notes: expect.any(String),
    });
  });

  it('resolves provider name from DB', async () => {
    vi.mocked(prisma.provider.findUnique).mockResolvedValue(makeProvider() as any);

    const result = await service.createPrescription({
      patientId: '1',
      providerId: '10',
      description: 'Test drug',
    });

    expect(result.provider).toBe('Sarah Mitchell');
  });

  it('sets provider to Unknown Provider when not found', async () => {
    vi.mocked(prisma.provider.findUnique).mockResolvedValue(null);

    const result = await service.createPrescription({
      patientId: '1',
      providerId: '999',
      description: 'Test drug',
    });

    expect(result.provider).toBe('Unknown Provider');
  });

  it('defaults prints to 0 when not provided', async () => {
    await service.createPrescription({
      patientId: '1',
      description: 'Test drug',
    });

    expect(setRxMeta).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ prints: '0' })
    );
  });
});

// ---------------------------------------------------------------------------
// RxService — getPrescriptionPrintData
// ---------------------------------------------------------------------------

describe('RxService.getPrescriptionPrintData', () => {
  let service: RxService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new RxService();
  });

  it('throws NotFoundError when prescription does not exist', async () => {
    vi.mocked(prisma.rxpat.findUnique).mockResolvedValue(null);

    await expect(service.getPrescriptionPrintData('999')).rejects.toThrow(
      NotFoundError
    );
    await expect(service.getPrescriptionPrintData('999')).rejects.toThrow(
      'Prescription not found'
    );
  });

  it('returns structured print data for a valid prescription', async () => {
    const row = makeRxRow();
    vi.mocked(prisma.rxpat.findUnique).mockResolvedValue(row as any);
    vi.mocked(prisma.patient.findUnique).mockResolvedValue({
      PatNum: BigInt(1),
      FName: 'John',
      LName: 'Smith',
      Birthdate: new Date('1985-01-15'),
      Address: '123 Main St',
      Address2: '',
      City: 'Springfield',
      State: 'IL',
      Zip: '62701',
      WirelessPhone: '555-1234',
      HmPhone: '',
      WkPhone: '',
    } as any);
    vi.mocked(prisma.provider.findUnique).mockResolvedValue(makeProvider() as any);
    vi.mocked(prisma.medication.findFirst).mockResolvedValue(null);
    vi.mocked(getRxsMeta).mockResolvedValue({
      '501': { duration: '7 days', longTerm: 'No', prints: '1' },
    });

    const result = await service.getPrescriptionPrintData('501');

    expect(result.id).toBe('501');
    expect(result.patient?.name).toBe('John Smith');
    expect(result.provider?.name).toBe('Sarah Mitchell');
    expect(result.duration).toBe('7 days');
    expect(result.printedAt).toBeDefined();
  });
});