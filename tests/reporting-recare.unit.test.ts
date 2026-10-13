import { beforeEach, describe, expect, it, vi } from 'vitest';

const { db, patientMeta, appointmentMeta } = vi.hoisted(() => ({
  db: Object.fromEntries(['patient', 'recall', 'appointment', 'procedurelog', 'recalltype', 'commlog', 'smstomobile', 'smsfrommobile', 'emailmessage'].map(name => [name, { findMany: vi.fn() }])) as Record<string, any>,
  patientMeta: vi.fn(), appointmentMeta: vi.fn(),
}));
vi.mock('../src/config/db', () => ({ prisma: db }));
vi.mock('../src/utils/opendental-auth.util', () => ({ getPatientsMeta: patientMeta, getAppointmentsMeta: appointmentMeta }));
import { recarePatientRows } from '../src/services/recare-reporting.service';
import { calculateDueDate } from '../src/utils/recare-due-date.util';

const asOf = new Date('2026-10-13T12:00:00Z');
const patient = { PatNum: 1n, FName: 'Test', LName: 'Patient', PatStatus: 0, Birthdate: new Date('1990-10-14'), WirelessPhone: '555-0100' };
const procedure = (code: string, date: string, patientId = 1n) => ({ PatNum: patientId, CodeNum: BigInt(code.slice(1)), procedurecode_procedurelog_CodeNumToprocedurecode: { ProcCode: code }, ProcDate: new Date(date), DateComplete: null });
const recallType = (code: string, interval: number, offset = 0) => ({ RecallTypeNum: BigInt(code.slice(1)), Procedures: code, DefaultInterval: interval, OffsetDays: offset, recalltrigger: [{ CodeNum: BigInt(code.slice(1)) }] });

beforeEach(() => {
  for (const model of Object.values(db)) model.findMany?.mockReset().mockResolvedValue([]);
  db.clinicalrecareconfig = { findFirst: vi.fn().mockResolvedValue({ IntervalMonths: 6 }) };
  db.patient.findMany.mockResolvedValue([patient]);
  patientMeta.mockReset().mockResolvedValue({});
  appointmentMeta.mockReset().mockResolvedValue({});
});

describe('recare report saved sources', () => {
  it('shows completed clinical dates and calculates recall due dates using configured intervals', async () => {
    db.procedurelog.findMany.mockResolvedValue([
      procedure('D1110', '2026-08-31'), procedure('D1110', '2026-01-01'),
      procedure('D0120', '2026-09-01'), procedure('D4910', '2026-06-01'),
      procedure('D0120', '2027-01-01'), // Future completion must not become history.
    ]);
    db.recalltype.findMany.mockResolvedValue([recallType('D1110', 6, 1), recallType('D0120', 6), recallType('D4910', 3)]);
    const [row] = await recarePatientRows({ asOf });
    expect(row).toMatchObject({ lastExam: '2026-09-01', lastProphy: '2026-08-31', lastMaintenance: '2026-06-01', recallDate: '2026-09-01', categoryKey: 'lateUnder12mNoAppt' });
    expect(db.procedurelog.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { PatNum: { in: [1n] }, ProcStatus: 2 } }));
    expect(calculateDueDate('2026-08-31', 6, 1)).toBe('2027-03-01');
  });

  it('preserves a saved recall override and renders human notes instead of reminder JSON', async () => {
    db.recall.findMany.mockResolvedValue([{ PatNum: 1n, RecallNum: 1n, IsDisabled: 0, DateDue: new Date('2026-12-12'), Note: JSON.stringify({ text: 'Call after 5 pm', contactAgain: '2026-10-20', followUpDate: '2026-10-27', calculatedDueDate: '2026-11-01' }) }]);
    db.procedurelog.findMany.mockResolvedValue([procedure('D1110', '2026-01-01')]);
    expect((await recarePatientRows({ asOf }))[0]).toMatchObject({ recallDate: '2026-12-12', note: 'Call after 5 pm', contactAgain: '2026-10-20', followUp: '2026-10-27' });
  });

  it('recognizes saved recare metadata on existing appointments and excludes completed and treatment visits', async () => {
    db.appointment.findMany.mockResolvedValue([
      { PatNum: 1n, AptNum: 1n, AptStatus: 1, IsHygiene: 1, AptDateTime: new Date('2026-10-14') },
      { PatNum: 1n, AptNum: 2n, AptStatus: 0, IsHygiene: 1, AptDateTime: new Date('2026-10-15') },
      { PatNum: 1n, AptNum: 3n, AptStatus: 0, IsHygiene: null, AptDateTime: new Date('2026-10-20') },
    ]);
    appointmentMeta.mockResolvedValue({ '2': { customFields: { visitType: 'treatment' } }, '3': { status: 'confirmed', customFields: { visitType: 'recare' } } });
    expect((await recarePatientRows({ asOf }))[0].apptDate).toBe('2026-10-20');
    expect(appointmentMeta).toHaveBeenCalledWith([1n, 2n, 3n]);
  });

  it('keeps disabled and postponed recall types out of calculated due dates', async () => {
    db.procedurelog.findMany.mockResolvedValue([procedure('D1110', '2026-01-01'), procedure('D4910', '2026-01-01')]);
    db.recalltype.findMany.mockResolvedValue([recallType('D1110', 6), recallType('D4910', 3)]);
    db.recall.findMany.mockResolvedValue([
      { PatNum: 1n, RecallNum: 1n, RecallTypeNum: 1110n, IsDisabled: 1 },
      { PatNum: 1n, RecallNum: 2n, RecallTypeNum: 4910n, IsDisabled: 0, DisableUntilDate: new Date('2026-12-01') },
    ]);
    expect((await recarePatientRows({ asOf }))[0]).toMatchObject({ recallDate: null, categoryKey: 'flaggedNoRecare' });
  });

  it('counts recorded contacts, deduplicates linked SMS logs, and reads explicit clinical follow-up dates', async () => {
    db.commlog.findMany.mockResolvedValue([
      { PatNum: 1n, CommlogNum: 1n, CommDateTime: new Date('2026-10-13'), Note: JSON.stringify({ noteType: 'soap', requiresFollowUp: true, followUpDate: '2026-11-01' }) },
      { PatNum: 1n, CommlogNum: 2n, CommDateTime: new Date('2026-10-10'), Note: JSON.stringify({ type: 'portal_message', message: 'Please call' }) },
      { PatNum: 1n, CommlogNum: 3n, CommDateTime: new Date('2026-10-09'), Mode_: 1, SentOrReceived: 2, Note: 'Telephone call' },
      { PatNum: 1n, CommlogNum: 4n, CommDateTime: new Date('2026-10-09'), Mode_: 2, SentOrReceived: 1, Note: 'Incoming SMS' },
      { PatNum: 1n, CommlogNum: 5n, CommDateTime: new Date('2026-10-13'), Note: JSON.stringify({ noteType: 'account', text: 'Internal account note' }) },
    ]);
    db.smstomobile.findMany.mockResolvedValue([{ PatNum: 1n, DateTimeSent: new Date('2026-10-08') }]);
    db.smsfrommobile.findMany.mockResolvedValue([{ PatNum: 1n, CommlogNum: 4n, DateTimeReceived: new Date('2026-10-09') }]);
    db.emailmessage.findMany.mockResolvedValue([{ PatNum: 1n, MsgDateTime: new Date('2026-10-11') }]);
    db.recall.findMany.mockResolvedValue([{ PatNum: 1n, IsDisabled: 0, Note: JSON.stringify({ lastReminderSentAt: '2026-10-12', calculatedDueDate: '2026-09-01' }) }]);
    expect((await recarePatientRows({ asOf }))[0]).toMatchObject({ lastComm: '2026-10-12', contactCount: 6, followUp: '2026-11-01', note: null, contactAgain: null });
    expect(db.smstomobile.findMany.mock.calls[0][0].where).toMatchObject({ SmsStatus: 1, DateTimeSent: { lte: asOf } });
    expect(db.emailmessage.findMany.mock.calls[0][0].where).toMatchObject({ SentOrReceived: 1, OR: [{ FailReason: null }, { FailReason: '' }] });
  });

  it('does not invent dates or contacts for a new patient', async () => {
    expect((await recarePatientRows({ asOf }))[0]).toMatchObject({ recallDate: null, lastExam: null, lastProphy: null, lastMaintenance: null, lastComm: null, contactCount: 0, contactAgain: null, followUp: null, apptDate: null, age: 35 });
  });

  it('uses DateComplete and OldCode for legacy completed procedures with a sentinel procedure date', async () => {
    db.procedurelog.findMany.mockResolvedValue([{ PatNum: 1n, CodeNum: null, procedurecode_procedurelog_CodeNumToprocedurecode: null, OldCode: 'D1110', ProcDate: new Date('0001-01-01'), DateComplete: new Date('2026-10-01') }]);
    expect((await recarePatientRows({ asOf }))[0]).toMatchObject({ lastProphy: '2026-10-01', recallDate: '2027-04-01' });
  });

  it('keeps each patient separate and scopes source queries to eligible patients', async () => {
    db.patient.findMany.mockResolvedValue([patient, { ...patient, PatNum: 2n }]);
    db.procedurelog.findMany.mockResolvedValue([procedure('D1110', '2026-10-01', 2n)]);
    const rows = await recarePatientRows({ asOf, clinicIds: [9n] });
    expect(rows[0].lastProphy).toBeNull();
    expect(rows[1].lastProphy).toBe('2026-10-01');
    expect(db.patient.findMany.mock.calls[0][0].where).toMatchObject({ PatStatus: 0, ClinicNum: { in: [9n] } });
    for (const name of ['recall', 'appointment', 'procedurelog', 'commlog', 'smstomobile', 'smsfrommobile', 'emailmessage']) {
      expect(db[name].findMany.mock.calls[0][0].where.PatNum).toEqual({ in: [1n, 2n] });
    }
  });

  it('returns no rows without querying clinical history when the patient scope is empty', async () => {
    db.patient.findMany.mockResolvedValue([]);
    expect(await recarePatientRows({ asOf })).toEqual([]);
    expect(db.procedurelog.findMany).not.toHaveBeenCalled();
  });
});
