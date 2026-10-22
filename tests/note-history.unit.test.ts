import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  commlog: { findUnique: vi.fn() },
  patient: { findFirst: vi.fn() },
  securitylog: { findMany: vi.fn() },
  userod: { findMany: vi.fn() },
}));
vi.mock('../src/config/db', () => ({ prisma: db }));

import { getNoteHistory } from '../src/services/note-history.service';

const auditRow = (id: string, tableName: string) => ({
  SecurityLogNum: BigInt(id), UserNum: 7n, LogDateTime: new Date('2026-10-20T10:00:00Z'),
  LogText: JSON.stringify({ text: JSON.stringify({ type: 'activity', action: 'updated', tableName,
    recordId: id, oldValues: { content: 'Before' }, newValues: { content: 'After' } }) }),
});

describe('note history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.commlog.findUnique.mockResolvedValue({ PatNum: 42n, Note: JSON.stringify({ noteType: 'soap' }) });
    db.patient.findFirst.mockResolvedValue({ PatNum: 42n });
    db.securitylog.findMany.mockResolvedValue([
      auditRow('5', 'clinical_notes'), auditRow('5', 'other_table'), auditRow('15', 'clinical_notes'),
    ]);
    db.userod.findMany.mockResolvedValue([{ UserNum: 7n, UserName: 'Dr. Test' }]);
  });

  it('returns only the selected note and source after checking patient visibility', async () => {
    const history = await getNoteHistory('5', 'clinical_notes');
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ id: '5', actor: 'Dr. Test', action: 'updated' });
    expect(db.patient.findFirst).toHaveBeenCalledWith({ where: { PatNum: 42n }, select: { PatNum: true } });
    expect(db.securitylog.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { AND: [
        { LogText: { contains: 'recordId' } },
        { LogText: { contains: '5' } },
      ] },
    }));
  });

  it('does not read audit records for a patient outside scope', async () => {
    db.patient.findFirst.mockResolvedValue(null);
    await expect(getNoteHistory('5', 'clinical_notes')).rejects.toThrow('Note not found');
    expect(db.securitylog.findMany).not.toHaveBeenCalled();
  });

  it('does not return a clinical note through the general-note endpoint', async () => {
    await expect(getNoteHistory('5', 'progress_notes')).rejects.toThrow('Note not found');
    expect(db.securitylog.findMany).not.toHaveBeenCalled();
  });

  it('returns recorded changes for a general note', async () => {
    db.commlog.findUnique.mockResolvedValue({ PatNum: 42n, Note: JSON.stringify({ isProgressNote: true }) });
    db.securitylog.findMany.mockResolvedValue([auditRow('5', 'progress_notes')]);
    const history = await getNoteHistory('5', 'progress_notes');
    expect(history).toMatchObject([{ action: 'updated', actor: 'Dr. Test' }]);
  });
});
