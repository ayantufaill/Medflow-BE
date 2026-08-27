import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/config/db', () => ({
  prisma: {
    formpat: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    commlog: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('../src/utils/opendental-ids.util', () => ({
  getNextId: vi.fn(),
}));

import { prisma } from '../src/config/db';
import { getNextId } from '../src/utils/opendental-ids.util';
import { PatientFormService } from '../src/services/patient-form.service';

const SIGNATURE_SNAPSHOT = [
  { key: 'consentToTreatment', label: 'I consent to treatment', type: 'boolean', required: true, options: null, order: 0 },
  { key: 'signatureName', label: 'Full Name (Digital Signature)', type: 'signature', required: true, options: null, order: 1 },
];

const NON_SIGNATURE_SNAPSHOT = [
  { key: 'preferredName', label: 'Preferred Name', type: 'text', required: false, options: null, order: 0 },
];

const commlogRow = (note: Record<string, unknown>, overrides: Record<string, unknown> = {}) => ({
  CommlogNum: BigInt(500),
  PatNum: BigInt(10),
  CommDateTime: new Date('2026-08-20T12:00:00Z'),
  Note: JSON.stringify(note),
  ...overrides,
});

describe('PatientFormService.createForm — audit trail', () => {
  let service: PatientFormService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PatientFormService();
    vi.mocked(getNextId)
      .mockResolvedValueOnce(BigInt(1)) // formpat
      .mockResolvedValueOnce(BigInt(500)); // commlog
    vi.mocked(prisma.formpat.create).mockResolvedValue({} as any);
    vi.mocked(prisma.commlog.create).mockResolvedValue({} as any);
  });

  it('stores ipAddress, userAgent, and templateFieldsSnapshot in the commlog Note blob', async () => {
    await service.createForm({
      patientId: '10',
      formData: { consentToTreatment: true, signatureName: 'data:image/png;base64,abc123' },
      templateId: 'consent-acknowledgement',
      submittedByRole: 'patient',
      ipAddress: '203.0.113.5',
      userAgent: 'Mozilla/5.0 (test)',
      templateFieldsSnapshot: SIGNATURE_SNAPSHOT as any,
    });

    expect(prisma.commlog.create).toHaveBeenCalledTimes(1);
    const createCall = vi.mocked(prisma.commlog.create).mock.calls[0][0] as any;
    const storedNote = JSON.parse(createCall.data.Note);

    expect(storedNote.ipAddress).toBe('203.0.113.5');
    expect(storedNote.userAgent).toBe('Mozilla/5.0 (test)');
    expect(storedNote.templateFieldsSnapshot).toEqual(SIGNATURE_SNAPSHOT);
  });

  it('defaults audit fields to null when not provided', async () => {
    await service.createForm({
      patientId: '10',
      formData: { preferredName: 'Jane' },
      templateId: 'demographics-update',
      submittedByRole: 'patient',
    });

    const createCall = vi.mocked(prisma.commlog.create).mock.calls[0][0] as any;
    const storedNote = JSON.parse(createCall.data.Note);

    expect(storedNote.ipAddress).toBeNull();
    expect(storedNote.userAgent).toBeNull();
    expect(storedNote.templateFieldsSnapshot).toBeNull();
  });
});

describe('PatientFormService.updateForm — consent lock', () => {
  let service: PatientFormService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PatientFormService();
  });

  it('rejects PUT when the submitted form is consent-bearing (signature field in snapshot)', async () => {
    const row = commlogRow({
      type: 'patient_form',
      formPatNum: '1',
      templateId: 'consent-acknowledgement',
      formData: { consentToTreatment: true },
      status: 'submitted',
      templateFieldsSnapshot: SIGNATURE_SNAPSHOT,
    });
    vi.mocked(prisma.commlog.findFirst).mockResolvedValue(row as any);

    // Matched on message, not `instanceof` — see form-template.service.test.ts for why.
    await expect(
      service.updateForm('1', { formData: { consentToTreatment: false } })
    ).rejects.toThrow(/already been submitted/);

    expect(prisma.commlog.update).not.toHaveBeenCalled();
  });

  it('allows PUT when the submitted form is not consent-bearing (no signature field in snapshot)', async () => {
    const row = commlogRow({
      type: 'patient_form',
      formPatNum: '2',
      templateId: 'demographics-update',
      formData: { preferredName: 'Jane' },
      status: 'submitted',
      templateFieldsSnapshot: NON_SIGNATURE_SNAPSHOT,
    });
    vi.mocked(prisma.commlog.findFirst).mockResolvedValue(row as any);
    vi.mocked(prisma.commlog.update).mockResolvedValue({} as any);

    const result = await service.updateForm('2', { formData: { preferredName: 'Janet' } });

    expect(prisma.commlog.update).toHaveBeenCalledTimes(1);
    expect(result.formData).toEqual({ preferredName: 'Janet' });
  });

  it('allows PUT when there is no templateFieldsSnapshot at all (pre-audit-trail submissions)', async () => {
    const row = commlogRow({
      type: 'patient_form',
      formPatNum: '3',
      templateId: 'medical-history-update',
      formData: { allergies: 'none' },
      status: 'submitted',
    });
    vi.mocked(prisma.commlog.findFirst).mockResolvedValue(row as any);
    vi.mocked(prisma.commlog.update).mockResolvedValue({} as any);

    await expect(
      service.updateForm('3', { formData: { allergies: 'peanuts' } })
    ).resolves.toBeDefined();
    expect(prisma.commlog.update).toHaveBeenCalledTimes(1);
  });
});
