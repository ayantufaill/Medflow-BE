import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LabCaseService } from '../src/services/lab-case.service';
import { NotFoundError } from '../src/utils/error.util';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../src/config/db', () => ({
  prisma: {
    labcase: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    laboratory: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock('../src/utils/opendental-ids.util', () => ({
  getNextId: vi.fn(),
}));

import { prisma } from '../src/config/db';
import { getNextId } from '../src/utils/opendental-ids.util';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeLabCase = (overrides = {}) => ({
  LabCaseNum: BigInt(1),
  PatNum: BigInt(10),
  LaboratoryNum: BigInt(5),
  AptNum: null,
  DateTimeDue: new Date('2025-09-01'),
  DateTimeCreated: new Date('2025-08-01'),
  DateTimeSent: null,
  DateTimeRecd: null,
  DateTimeChecked: null,
  Instructions: 'Handle with care',
  LabFee: 150.0,
  InvoiceNum: null,
  ProvNum: BigInt(20),
  patient: { PatNum: BigInt(10), FName: 'Jane', LName: 'Doe' },
  laboratory: { LaboratoryNum: BigInt(5), Description: 'City Lab' },
  appointment_labcase_AptNumToappointment: null,
  provider: { ProvNum: BigInt(20), FName: 'Dr', LName: 'Smith' },
  ...overrides,
});

const makeLaboratory = (overrides = {}) => ({
  LaboratoryNum: BigInt(5),
  Description: 'City Lab',
  Phone: '555-0100',
  Email: 'lab@city.com',
  Address: '100 Lab St',
  City: 'Springfield',
  State: 'IL',
  Zip: '62701',
  IsHidden: 0,
  labturnaround: [],
  ...overrides,
});

// ---------------------------------------------------------------------------
// LabCaseService — getAllLabCases
// ---------------------------------------------------------------------------

describe('LabCaseService.getAllLabCases', () => {
  let service: LabCaseService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LabCaseService();
  });

  it('returns paginated lab cases with default params', async () => {
    vi.mocked(prisma.labcase.findMany).mockResolvedValue([makeLabCase()] as any);
    vi.mocked(prisma.labcase.count).mockResolvedValue(1);

    const result = await service.getAllLabCases();

    expect(result.labCases).toHaveLength(1);
    expect(result.pagination).toMatchObject({ page: 1, limit: 25, total: 1 });
  });

  it('filters by patientId when provided', async () => {
    vi.mocked(prisma.labcase.findMany).mockResolvedValue([]);
    vi.mocked(prisma.labcase.count).mockResolvedValue(0);

    await service.getAllLabCases(1, 25, '10');

    expect(prisma.labcase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ PatNum: BigInt('10') }),
      })
    );
  });

  it('filters Active tab by DateTimeChecked = null', async () => {
    vi.mocked(prisma.labcase.findMany).mockResolvedValue([]);
    vi.mocked(prisma.labcase.count).mockResolvedValue(0);

    await service.getAllLabCases(1, 25, undefined, 'Active');

    expect(prisma.labcase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ DateTimeChecked: null }),
      })
    );
  });

  it('filters Completed tab by DateTimeChecked not null', async () => {
    vi.mocked(prisma.labcase.findMany).mockResolvedValue([]);
    vi.mocked(prisma.labcase.count).mockResolvedValue(0);

    await service.getAllLabCases(1, 25, undefined, 'Completed');

    expect(prisma.labcase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ DateTimeChecked: { not: null } }),
      })
    );
  });

  it('filters by date range when startDate and endDate provided', async () => {
    vi.mocked(prisma.labcase.findMany).mockResolvedValue([]);
    vi.mocked(prisma.labcase.count).mockResolvedValue(0);

    await service.getAllLabCases(1, 25, undefined, undefined, undefined, undefined, undefined, '2025-08-01', '2025-08-31');

    expect(prisma.labcase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          DateTimeDue: {
            gte: new Date('2025-08-01'),
            lte: new Date('2025-08-31'),
          },
        }),
      })
    );
  });

  it('maps lab case fields correctly', async () => {
    vi.mocked(prisma.labcase.findMany).mockResolvedValue([makeLabCase()] as any);
    vi.mocked(prisma.labcase.count).mockResolvedValue(1);

    const result = await service.getAllLabCases();
    const lc = result.labCases[0];

    expect(lc._id).toBe('1');
    expect(lc.patient).toEqual({ id: '10', name: 'Jane Doe' });
    expect(lc.laboratory).toEqual({ id: '5', name: 'City Lab' });
    expect(lc.provider).toEqual({ id: '20', name: 'Dr Smith' });
    expect(lc.instructions).toBe('Handle with care');
    expect(lc.labFee).toBe(150.0);
  });

  it('derives status as New when no dates are set', async () => {
    const lc = makeLabCase({
      DateTimeSent: null,
      DateTimeRecd: null,
      DateTimeChecked: null,
    });
    vi.mocked(prisma.labcase.findMany).mockResolvedValue([lc] as any);
    vi.mocked(prisma.labcase.count).mockResolvedValue(1);

    const result = await service.getAllLabCases();
    expect(result.labCases[0].status).toBe('New');
  });

  it('derives status as Sent when DateTimeSent is set', async () => {
    const lc = makeLabCase({ DateTimeSent: new Date(), DateTimeRecd: null, DateTimeChecked: null });
    vi.mocked(prisma.labcase.findMany).mockResolvedValue([lc] as any);
    vi.mocked(prisma.labcase.count).mockResolvedValue(1);

    const result = await service.getAllLabCases();
    expect(result.labCases[0].status).toBe('Sent');
  });

  it('derives status as Received when DateTimeRecd is set', async () => {
    const lc = makeLabCase({ DateTimeRecd: new Date(), DateTimeChecked: null });
    vi.mocked(prisma.labcase.findMany).mockResolvedValue([lc] as any);
    vi.mocked(prisma.labcase.count).mockResolvedValue(1);

    const result = await service.getAllLabCases();
    expect(result.labCases[0].status).toBe('Received');
  });

  it('derives status as Quality Checked when DateTimeChecked is set', async () => {
    const lc = makeLabCase({ DateTimeChecked: new Date() });
    vi.mocked(prisma.labcase.findMany).mockResolvedValue([lc] as any);
    vi.mocked(prisma.labcase.count).mockResolvedValue(1);

    const result = await service.getAllLabCases();
    expect(result.labCases[0].status).toBe('Quality Checked');
  });

  it('filters by status post-query', async () => {
    const sent = makeLabCase({ LabCaseNum: BigInt(1), DateTimeSent: new Date(), DateTimeRecd: null, DateTimeChecked: null });
    const newCase = makeLabCase({ LabCaseNum: BigInt(2), DateTimeSent: null, DateTimeRecd: null, DateTimeChecked: null });
    vi.mocked(prisma.labcase.findMany).mockResolvedValue([sent, newCase] as any);
    vi.mocked(prisma.labcase.count).mockResolvedValue(2);

    const result = await service.getAllLabCases(1, 25, undefined, undefined, 'Sent');

    expect(result.labCases).toHaveLength(1);
    expect(result.labCases[0].status).toBe('Sent');
  });

  it('sorts by patient name ascending', async () => {
    const alice = makeLabCase({ LabCaseNum: BigInt(1), patient: { PatNum: BigInt(1), FName: 'Alice', LName: 'Smith' } });
    const bob = makeLabCase({ LabCaseNum: BigInt(2), patient: { PatNum: BigInt(2), FName: 'Bob', LName: 'Jones' } });
    vi.mocked(prisma.labcase.findMany).mockResolvedValue([bob, alice] as any);
    vi.mocked(prisma.labcase.count).mockResolvedValue(2);

    const result = await service.getAllLabCases(1, 25, undefined, undefined, undefined, 'patient', 'asc');

    expect(result.labCases[0].patient?.name).toBe('Alice Smith');
    expect(result.labCases[1].patient?.name).toBe('Bob Jones');
  });

  it('sorts by patient name descending', async () => {
    const alice = makeLabCase({ LabCaseNum: BigInt(1), patient: { PatNum: BigInt(1), FName: 'Alice', LName: 'Smith' } });
    const bob = makeLabCase({ LabCaseNum: BigInt(2), patient: { PatNum: BigInt(2), FName: 'Bob', LName: 'Jones' } });
    vi.mocked(prisma.labcase.findMany).mockResolvedValue([alice, bob] as any);
    vi.mocked(prisma.labcase.count).mockResolvedValue(2);

    const result = await service.getAllLabCases(1, 25, undefined, undefined, undefined, 'patient', 'desc');

    expect(result.labCases[0].patient?.name).toBe('Bob Jones');
    expect(result.labCases[1].patient?.name).toBe('Alice Smith');
  });

  it('applies skip correctly for pagination', async () => {
    vi.mocked(prisma.labcase.findMany).mockResolvedValue([]);
    vi.mocked(prisma.labcase.count).mockResolvedValue(0);

    await service.getAllLabCases(3, 10);

    expect(prisma.labcase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 })
    );
  });

  it('returns empty array when no lab cases found', async () => {
    vi.mocked(prisma.labcase.findMany).mockResolvedValue([]);
    vi.mocked(prisma.labcase.count).mockResolvedValue(0);

    const result = await service.getAllLabCases();

    expect(result.labCases).toHaveLength(0);
    expect(result.pagination.total).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// LabCaseService — getLabCaseById
// ---------------------------------------------------------------------------

describe('LabCaseService.getLabCaseById', () => {
  let service: LabCaseService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LabCaseService();
  });

  it('returns a lab case by ID', async () => {
    vi.mocked(prisma.labcase.findUnique).mockResolvedValue(makeLabCase() as any);

    const result = await service.getLabCaseById('1');

    expect(result._id).toBe('1');
    expect(result.patient?.name).toBe('Jane Doe');
  });

  it('throws NotFoundError when lab case does not exist', async () => {
    vi.mocked(prisma.labcase.findUnique).mockResolvedValue(null);

    await expect(service.getLabCaseById('999')).rejects.toThrow(NotFoundError);
    await expect(service.getLabCaseById('999')).rejects.toThrow('Lab case not found');
  });
});

// ---------------------------------------------------------------------------
// LabCaseService — createLabCase
// ---------------------------------------------------------------------------

describe('LabCaseService.createLabCase', () => {
  let service: LabCaseService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LabCaseService();
    vi.mocked(getNextId).mockResolvedValue(BigInt(99));
    vi.mocked(prisma.labcase.create).mockResolvedValue({ LabCaseNum: BigInt(99) } as any);
    vi.mocked(prisma.labcase.findUnique).mockResolvedValue(makeLabCase({ LabCaseNum: BigInt(99) }) as any);
  });

  it('calls getNextId with correct table and column', async () => {
    await service.createLabCase({ patientId: '10', laboratoryId: '5' });
    expect(getNextId).toHaveBeenCalledWith('labcase', 'LabCaseNum');
  });

  it('creates a lab case with required fields', async () => {
    await service.createLabCase({ patientId: '10', laboratoryId: '5' });

    expect(prisma.labcase.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          PatNum: BigInt('10'),
          LaboratoryNum: BigInt('5'),
        }),
      })
    );
  });

  it('sets optional dueDate when provided', async () => {
    await service.createLabCase({
      patientId: '10',
      laboratoryId: '5',
      dueDate: '2025-09-01',
    });

    expect(prisma.labcase.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          DateTimeDue: new Date('2025-09-01'),
        }),
      })
    );
  });

  it('sets DateTimeSent when sharedOn is provided', async () => {
    await service.createLabCase({
      patientId: '10',
      laboratoryId: '5',
      sharedOn: '2025-08-15',
    });

    expect(prisma.labcase.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          DateTimeSent: new Date('2025-08-15'),
        }),
      })
    );
  });

  it('returns the created lab case via getLabCaseById', async () => {
    const result = await service.createLabCase({ patientId: '10', laboratoryId: '5' });
    expect(result._id).toBeDefined();
    expect(result.patient).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// LabCaseService — updateLabCase
// ---------------------------------------------------------------------------

describe('LabCaseService.updateLabCase', () => {
  let service: LabCaseService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LabCaseService();
  });

  it('throws NotFoundError when lab case does not exist', async () => {
    vi.mocked(prisma.labcase.findUnique).mockResolvedValue(null);

    await expect(service.updateLabCase('999', {})).rejects.toThrow(NotFoundError);
  });

  it('updates instructions correctly', async () => {
    const lc = makeLabCase();
    vi.mocked(prisma.labcase.findUnique).mockResolvedValue(lc as any);
    vi.mocked(prisma.labcase.update).mockResolvedValue({ LabCaseNum: BigInt(1) } as any);
    // findUnique called again inside getLabCaseById
    vi.mocked(prisma.labcase.findUnique)
      .mockResolvedValueOnce(lc as any)  // first call — existence check
      .mockResolvedValueOnce(makeLabCase({ Instructions: 'New instructions' }) as any); // second — getLabCaseById

    const result = await service.updateLabCase('1', { instructions: 'New instructions' });
    expect(prisma.labcase.update).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// LabCaseService — updateLabCaseStatus
// ---------------------------------------------------------------------------

describe('LabCaseService.updateLabCaseStatus', () => {
  let service: LabCaseService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LabCaseService();
  });

  it('throws NotFoundError when lab case does not exist', async () => {
    vi.mocked(prisma.labcase.findUnique).mockResolvedValue(null);
    await expect(service.updateLabCaseStatus('999', 'Sent')).rejects.toThrow(NotFoundError);
  });

  it('sets DateTimeSent when status is Sent', async () => {
    const lc = makeLabCase();
    vi.mocked(prisma.labcase.findUnique)
      .mockResolvedValueOnce(lc as any)
      .mockResolvedValueOnce(makeLabCase({ DateTimeSent: new Date() }) as any);
    vi.mocked(prisma.labcase.update).mockResolvedValue({ LabCaseNum: BigInt(1) } as any);

    await service.updateLabCaseStatus('1', 'Sent');

    expect(prisma.labcase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ DateTimeSent: expect.any(Date) }),
      })
    );
  });

  it('sets DateTimeRecd when status is Received', async () => {
    const lc = makeLabCase();
    vi.mocked(prisma.labcase.findUnique)
      .mockResolvedValueOnce(lc as any)
      .mockResolvedValueOnce(makeLabCase({ DateTimeRecd: new Date() }) as any);
    vi.mocked(prisma.labcase.update).mockResolvedValue({ LabCaseNum: BigInt(1) } as any);

    await service.updateLabCaseStatus('1', 'Received');

    expect(prisma.labcase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ DateTimeRecd: expect.any(Date) }),
      })
    );
  });

  it('sets DateTimeChecked when status is Quality Checked', async () => {
    const lc = makeLabCase();
    vi.mocked(prisma.labcase.findUnique)
      .mockResolvedValueOnce(lc as any)
      .mockResolvedValueOnce(makeLabCase({ DateTimeChecked: new Date() }) as any);
    vi.mocked(prisma.labcase.update).mockResolvedValue({ LabCaseNum: BigInt(1) } as any);

    await service.updateLabCaseStatus('1', 'Quality Checked');

    expect(prisma.labcase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ DateTimeChecked: expect.any(Date) }),
      })
    );
  });
});

// ---------------------------------------------------------------------------
// LabCaseService — deleteLabCase
// ---------------------------------------------------------------------------

describe('LabCaseService.deleteLabCase', () => {
  let service: LabCaseService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LabCaseService();
  });

  it('throws NotFoundError when lab case does not exist', async () => {
    vi.mocked(prisma.labcase.findUnique).mockResolvedValue(null);
    await expect(service.deleteLabCase('999')).rejects.toThrow(NotFoundError);
  });

  it('deletes the lab case and returns success message', async () => {
    vi.mocked(prisma.labcase.findUnique).mockResolvedValue(makeLabCase() as any);
    vi.mocked(prisma.labcase.delete).mockResolvedValue({} as any);

    const result = await service.deleteLabCase('1');
    expect(result.message).toBe('Lab case deleted successfully');
    expect(prisma.labcase.delete).toHaveBeenCalledWith({
      where: { LabCaseNum: BigInt(1) },
    });
  });
});

// ---------------------------------------------------------------------------
// LabCaseService — getAllLaboratories
// ---------------------------------------------------------------------------

describe('LabCaseService.getAllLaboratories', () => {
  let service: LabCaseService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LabCaseService();
  });

  it('returns paginated laboratories', async () => {
    vi.mocked(prisma.laboratory.findMany).mockResolvedValue([makeLaboratory()] as any);
    vi.mocked(prisma.laboratory.count).mockResolvedValue(1);

    const result = await service.getAllLaboratories();

    expect(result.laboratories).toHaveLength(1);
    expect(result.pagination).toMatchObject({ page: 1, limit: 25, total: 1 });
  });

  it('excludes hidden laboratories by default', async () => {
    vi.mocked(prisma.laboratory.findMany).mockResolvedValue([]);
    vi.mocked(prisma.laboratory.count).mockResolvedValue(0);

    await service.getAllLaboratories();

    expect(prisma.laboratory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { IsHidden: 0 },
      })
    );
  });

  it('includes hidden laboratories when includeHidden=true', async () => {
    vi.mocked(prisma.laboratory.findMany).mockResolvedValue([]);
    vi.mocked(prisma.laboratory.count).mockResolvedValue(0);

    await service.getAllLaboratories(1, 25, true);

    expect(prisma.laboratory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
      })
    );
  });

  it('maps laboratory fields correctly', async () => {
    vi.mocked(prisma.laboratory.findMany).mockResolvedValue([makeLaboratory()] as any);
    vi.mocked(prisma.laboratory.count).mockResolvedValue(1);

    const result = await service.getAllLaboratories();
    const lab = result.laboratories[0];

    expect(lab._id).toBe('5');
    expect(lab.name).toBe('City Lab');
    expect(lab.phone).toBe('555-0100');
    expect(lab.email).toBe('lab@city.com');
    expect(lab.isHidden).toBe(false);
    expect(lab.turnaroundTimes).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// LabCaseService — createLaboratory
// ---------------------------------------------------------------------------

describe('LabCaseService.createLaboratory', () => {
  let service: LabCaseService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LabCaseService();
    vi.mocked(getNextId).mockResolvedValue(BigInt(10));
    vi.mocked(prisma.laboratory.create).mockResolvedValue({
      LaboratoryNum: BigInt(10),
      Description: 'New Lab',
      Phone: '555-9999',
      Email: null,
      Address: null,
      City: null,
      State: null,
      Zip: null,
      IsHidden: 0,
      labturnaround: [],
    } as any);
  });

  it('calls getNextId with correct table and column', async () => {
    await service.createLaboratory({ description: 'New Lab' });
    expect(getNextId).toHaveBeenCalledWith('laboratory', 'LaboratoryNum');
  });

  it('creates laboratory with required description', async () => {
    await service.createLaboratory({ description: 'New Lab' });

    expect(prisma.laboratory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          Description: 'New Lab',
          IsHidden: 0,
        }),
      })
    );
  });

  it('returns correct response shape', async () => {
    const result = await service.createLaboratory({ description: 'New Lab', phone: '555-9999' });

    expect(result).toMatchObject({
      _id: '10',
      name: 'New Lab',
      isHidden: false,
      turnaroundTimes: [],
    });
  });
});