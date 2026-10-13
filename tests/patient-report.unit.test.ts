import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  patient: vi.fn(), appointments: vi.fn(), appointment: vi.fn(), perio: vi.fn(),
  exam: vi.fn(), procedures: vi.fn(), meta: vi.fn(), allergies: vi.fn(),
}));
vi.mock('../src/config/db', () => ({ prisma: {
  patient: { findUnique: mocks.patient },
  appointment: { findMany: mocks.appointments, findFirst: mocks.appointment },
  examperiodontal: { findFirst: mocks.perio },
  procedurelog: { findMany: mocks.procedures },
} }));
vi.mock('../src/services/clinical-exam.service', () => ({ clinicalExamService: { getExamByAppointment: mocks.exam } }));
vi.mock('../src/services/allergy.service', () => ({ allergyService: { getAllergiesByPatient: mocks.allergies } }));
vi.mock('../src/utils/opendental-auth.util', () => ({ getPatientMeta: mocks.meta }));

import { buildPeriodontalHealth, PatientReportService } from '../src/services/patient-report.service';

const blank = () => ({ probe: ['', '', ''], recession: ['', '', ''], attachment: ['', '', ''],
  mobility: '', furcation: '', bleeding: [], pcs: [] });
const measured = () => ({ ...blank(), probe: ['3', '5', '6'], recession: ['0', '1', ''],
  bleeding: [0, 2], mobility: '2', furcation: '1', pcs: ['P'] });

describe('periodontal findings from saved chart data', () => {
  it.each([null, { examData: {} }, { examData: { chartData: { 1: { facial: blank() } } } }])(
    'does not report unrecorded data as healthy', exam => {
      expect(buildPeriodontalHealth(exam, null)).toMatchObject({ assessed: false, score: null, status: 'not_assessed' });
    });
  it('calculates findings and coverage from entered sites, preserving blanks and zero', () => {
    const result = buildPeriodontalHealth({ examData: { chartData: { 1: { facial: measured() } } } }, null);
    expect(result).toMatchObject({ assessed: true, summary: {
      measuredSites: 3, totalSites: 192, bleedingSites: 2, recessionSites: 1, deepPocketSites: 2, maxProbingDepth: 6,
    }, measurements: [{ tooth: '1', probe: [3, 5, 6], recession: [0, 1, null] }] });
    expect(result.issues).toEqual(expect.arrayContaining(['Bleeding on probing: teeth 1', 'Tooth mobility: teeth 1', 'Furcation involvement: teeth 1', 'Plaque: teeth 1']));
  });
  it('excludes missing teeth from findings, preview and the available site count', () => {
    const result = buildPeriodontalHealth({ examData: { missingTeeth: [1], chartData: {
      1: { facial: measured() }, 2: { facial: { ...blank(), probe: ['3', '', ''] } },
    } } }, null);
    expect(result).toMatchObject({ summary: { measuredSites: 1, totalSites: 186, bleedingSites: 0 },
      measurements: [{ tooth: '2' }] });
    expect(result.issues).toEqual(['Missing teeth: 1']);
  });
  it('supports legacy charts and their radiographic missing teeth', () => {
    const result = buildPeriodontalHealth({ examData: { 1: { facial: measured() } } }, { examData: { missingTeeth: ['1'] } });
    expect(result).toMatchObject({ assessed: false, measurements: [], missingTeeth: ['1'] });
  });
  it('uses the chart snapshot of missing teeth when present', () => {
    const result = buildPeriodontalHealth({ examData: { missingTeeth: [], chartData: { 1: { facial: measured() } } } }, { examData: { missingTeeth: [1] } });
    expect(result).toMatchObject({ assessed: true, missingTeeth: [] });
  });
  it('returns a recorded diagnosis even when no measurements exist', () => {
    const diagnosis = { type: 'periodontitis', stage: 'stage3', grading: 'gradeC', distribution: 'localized' };
    expect(buildPeriodontalHealth({ examData: { diagnosis } }, null)).toMatchObject({ assessed: true, diagnosis, measurements: [], score: null, status: 'recorded' });
  });
});

describe('patient report chart selection', () => {
  const date = new Date('2026-10-12T08:00:00Z');
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.patient.mockResolvedValue({ PatNum: 1n });
    mocks.appointments.mockResolvedValue([{ AptNum: 99n, AptDateTime: date }]);
    mocks.appointment.mockResolvedValue({ AptDateTime: date });
    mocks.exam.mockResolvedValue({ examData: {} });
    mocks.meta.mockResolvedValue({});
    mocks.allergies.mockResolvedValue([]);
    mocks.procedures.mockResolvedValue([]);
    mocks.perio.mockResolvedValue({ ExamId: 7n, PatNum: 1n, AptNum: 11n,
      ExamData: JSON.stringify({ chartData: { 1: { facial: measured() } } }),
      UpdatedAt: date, CreatedAt: date, appointment: { AptDateTime: date },
    });
  });
  it('loads the latest saved periodontal exam regardless of the general report appointment', async () => {
    const result = await new PatientReportService().getReport('1');
    expect(mocks.perio).toHaveBeenCalledWith(expect.objectContaining({
      where: { PatNum: 1n, appointment: { PatNum: 1n } },
      orderBy: [{ UpdatedAt: 'desc' }, { ExamId: 'desc' }],
    }));
    expect(result.metadata.appointmentId).toBe('99');
    expect(result.riskAssessment.gumHealth.source).toMatchObject({ appointmentId: '11', savedAt: date });
    expect(mocks.exam).toHaveBeenCalledWith('radiographic', '11');
  });
  it('does not fall back to another appointment when the requested one has no chart', async () => {
    mocks.perio.mockResolvedValue(null);
    const result = await new PatientReportService().getReport('1', '12');
    expect(mocks.perio.mock.calls[0][0].where).toEqual({ PatNum: 1n, appointment: { PatNum: 1n }, AptNum: 12n });
    expect(result.riskAssessment.gumHealth).toMatchObject({ assessed: false, source: null });
  });
  it('rejects an appointment belonging to a different patient', async () => {
    mocks.appointment.mockResolvedValue(null);
    await expect(new PatientReportService().getReport('1', '22')).rejects.toThrow('Appointment not found for this patient');
    expect(mocks.appointment).toHaveBeenCalledWith(expect.objectContaining({ where: { PatNum: 1n, AptNum: 22n } }));
    expect(mocks.perio).not.toHaveBeenCalled();
  });
  it('reflects changed persisted measurements when the report is reloaded', async () => {
    const service = new PatientReportService();
    const before = await service.getReport('1');
    const row = await mocks.perio();
    row.ExamData = JSON.stringify({ chartData: { 1: { facial: { ...blank(), probe: ['2', '2', '2'] } } } });
    const after = await service.getReport('1');
    expect(before.riskAssessment.gumHealth.issues.length).toBeGreaterThan(0);
    expect(after.riskAssessment.gumHealth.issues).toEqual([]);
  });
  it('surfaces chart database errors rather than presenting a healthy or absent chart', async () => {
    mocks.perio.mockRejectedValue(new Error('Chart read failed'));
    await expect(new PatientReportService().getReport('1')).rejects.toThrow('Chart read failed');
  });
});
