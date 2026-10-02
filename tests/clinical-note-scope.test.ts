import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  patient: { findFirst: vi.fn(), findMany: vi.fn() },
  commlog: { findMany: vi.fn() },
  provider: { findMany: vi.fn() },
  userod: { findMany: vi.fn() },
}));
vi.mock('../src/config/db', () => ({ prisma: prismaMock }));

import { clinicalNoteService } from '../src/services/clinical-note.service';

describe('clinical notes by patient: patient scope', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    prismaMock.commlog.findMany.mockResolvedValue([]);
    // Enrichment looks up providers/users; not what this test is about.
    vi.spyOn(clinicalNoteService as any, 'enrichClinicalNotes').mockResolvedValue([]);
  });

  it('returns 404 when the patient is outside the caller\'s scope (RLS hides it)', async () => {
    prismaMock.patient.findFirst.mockResolvedValue(null);
    await expect(clinicalNoteService.getClinicalNotesByPatient('58')).rejects.toMatchObject({ message: 'Patient not found', statusCode: 404 });
    expect(prismaMock.commlog.findMany).not.toHaveBeenCalled();
  });

  it('lists notes when the patient is visible', async () => {
    prismaMock.patient.findFirst.mockResolvedValue({ PatNum: 57n });
    const result = await clinicalNoteService.getClinicalNotesByPatient('57');
    expect(result.pagination.total).toBe(0);
    expect(prismaMock.commlog.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { PatNum: 57n } }));
  });
});
