import { beforeEach, describe, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({
  patient: { findMany: vi.fn() }, provider: { findMany: vi.fn() },
  appointment: { findMany: vi.fn() }, recall: { findMany: vi.fn() },
  patplan: { findMany: vi.fn() }, claimproc: { findMany: vi.fn() },
  procedurelog: { findMany: vi.fn() }, payplan: { findMany: vi.fn() },
  deposit: { findMany: vi.fn() }, rxpat: { findMany: vi.fn() },
  document: { create: vi.fn(), findMany: vi.fn() },
  treatplan: { findMany: vi.fn() }, preference: { findFirst: vi.fn() }, paysplit: { findMany: vi.fn() },
}));
const meta = vi.hoisted(() => ({ patients: vi.fn(), policies: vi.fn(), providers: vi.fn() }));
vi.mock('../src/config/db', () => ({ prisma: db }));
vi.mock('../src/utils/opendental-auth.util', () => ({ getPatientsMeta: meta.patients, getPatientInsurancesMeta: meta.policies, getProvidersMeta: meta.providers }));
vi.mock('../src/services/clinical-note.service', () => ({ clinicalNoteService: {} }));
// vitest.config has restoreMocks: true, which wipes an implementation given at
// creation time before every test — so the id is (re)set in beforeEach.
const ids = vi.hoisted(() => ({ getNextId: vi.fn() }));
vi.mock('../src/utils/opendental-ids.util', () => ({ getNextId: ids.getNextId }));
import { compileReportFilters, validateReportDefinition } from '../src/utils/reporting-fields.util';
import { normalizeReportingGoals, workingHoursInRange, productionGoal, collectionGoal, goalPercent, goalIsConfigured } from '../src/utils/reporting-goals.util';
import { paymentPlanReport } from '../src/utils/payment-plan-report.util';
import { annualMaximum, benefitPeriodStart, remainingAnnualBenefit } from '../src/utils/insurance-benefit-usage.util';
import { reportingClinicIds } from '../src/utils/reporting-scope.util';
import { tenantContextStorage } from '../src/config/tenant-context';
import { classifyRecare, recarePatientRows, countRecareCategories } from '../src/services/recare-reporting.service';
import { patientReportRows } from '../src/services/reporting-patient-data.service';
import { runCustomReport } from '../src/services/report-builder.service';
import { ReportGenerationService } from '../src/services/report-generation.service';
import { DashboardMetricsService } from '../src/services/dashboard-metrics.service';
import { ProductivityService } from '../src/services/productivity.service';
import { ReportingService } from '../src/services/reporting.service';

beforeEach(() => {
  for (const model of Object.values(db)) for (const fn of Object.values(model)) fn.mockReset().mockResolvedValue([]);
  db.preference.findFirst.mockResolvedValue(null);
  meta.patients.mockReset().mockResolvedValue({});
  meta.policies.mockReset().mockResolvedValue({});
  meta.providers.mockReset().mockResolvedValue({});
  ids.getNextId.mockReset().mockResolvedValue(999n);
});
const now = new Date('2026-10-08T12:00:00Z');
const patient = { PatNum: 1n, FName: 'Fixture', LName: 'Person', PatStatus: 0, BalTotal: 0, Birthdate: null };

describe('typed report filters and persisted data', () => {
  it('parses false without reversing active/inactive meaning', () => {
    const match = compileReportFilters([{ field: 'Inactive', operator: 'Equals', value: 'false' }]);
    expect(match({ Inactive: false })).toBe(true);
    expect(match({ Inactive: true })).toBe(false);
    expect(match({ Inactive: null })).toBe(false);
  });
  it.each([
    [{ field: 'unimplemented', value: 'x' }],
    [{ field: 'Fee', operator: 'Contains', value: 1 }],
    [{ field: 'dob', value: '2026-02-30' }],
    [{ field: 'Inactive', value: 'sometimes' }], [null],
  ])('rejects unsupported or malformed filters %j', filter => {
    expect(() => compileReportFilters([filter])).toThrow();
  });
  it('rejects malformed definitions before a database query', async () => {
    expect(() => validateReportDefinition({ kind: 'Patient', columns: ['ID'], filters: {} as any })).toThrow();
    await expect(runCustomReport({ kind: 'Patient', columns: ['Fee'], filters: [] })).rejects.toThrow('Procedures');
    expect(db.patient.findMany).not.toHaveBeenCalled();
  });
  it('uses date/numeric/empty predicates together and preserves real zero', () => {
    const match = compileReportFilters([{ field: 'Fee', operator: 'Less than or equal', value: '0' }, { field: 'Date', operator: 'Greater than', value: '2026-01-01' }, { field: 'email', operator: 'Empty' }]);
    expect(match({ Fee: 0, Date: '2026-10-08', email: null })).toBe(true);
    expect(match({ Fee: 5, Date: '2026-10-08', email: null })).toBe(false);
  });
  it('does not invent patient demographics, insurance, appointments, or account access', async () => {
    const row = (await patientReportRows([patient], now)).get('1')!;
    expect(row).toMatchObject({ dob: null, payerName: null, 'Ins Remain': null, lastAppt: null, nextRecareAppt: null, 'Has Mychart Account': null, 'Total Outstanding Balance': 0, Inactive: false });
  });
  it('reads primary policy benefits and actual completed/scheduled appointments', async () => {
    db.patplan.findMany.mockResolvedValue([{ PatNum: 1n, PatPlanNum: 10n, InsSubNum: 20n, Ordinal: 1, inssub: { insplan: { carrier: { CarrierName: 'Saved Payer' } } } }]);
    meta.policies.mockResolvedValue({ '10': { annualMax: 2000, renewalMonth: 7 } });
    db.claimproc.findMany.mockResolvedValue([{ PatNum: 1n, InsSubNum: 20n, DateCP: new Date('2026-08-01'), InsPayAmt: 250 }]);
    // App mapping (mapAppointmentStatusToDb): 0 = scheduled, 1 = completed.
    db.appointment.findMany.mockResolvedValue([{ PatNum: 1n, AptStatus: 1, AptDateTime: new Date('2026-09-01') }, { PatNum: 1n, AptStatus: 0, IsHygiene: 1, AptDateTime: new Date('2026-11-01') }]);
    expect((await patientReportRows([patient], now)).get('1')).toMatchObject({ payerName: 'Saved Payer', 'Ins Remain': 1750, lastAppt: '2026-09-01', nextRecareAppt: '2026-11-01', nextTreatmentAppt: null });
  });
  it('applies patient filters before pagination and returns the exact matching total', async () => {
    db.patient.findMany.mockResolvedValue([patient, { ...patient, PatNum: 2n, FName: 'Other' }, { ...patient, PatNum: 3n }]);
    const result = await runCustomReport({ kind: 'Patient', columns: ['ID', 'First Name'], filters: [{ field: 'First Name', operator: 'Equals', value: 'fixture' }], page: 2, limit: 1 });
    expect(result).toEqual({ data: [{ ID: '3', 'First Name': 'Fixture' }], total: 2, page: 2, limit: 1 });
  });
  it('continues filtering past the first source batch', async () => {
    db.patient.findMany.mockResolvedValueOnce(Array.from({ length: 250 }, (_, i) => ({ ...patient, PatNum: BigInt(i + 1), FName: 'Other' })))
      .mockResolvedValueOnce([{ ...patient, PatNum: 251n }]);
    const result = await runCustomReport({ kind: 'Patient', columns: ['ID'], filters: [{ field: 'First Name', value: 'Fixture' }], limit: 1 });
    expect(result.total).toBe(1); expect(result.data).toEqual([{ ID: '251' }]);
    expect(db.patient.findMany.mock.calls[1][0]).toMatchObject({ cursor: { PatNum: 250n }, skip: 1 });
  });
  it('saves and reloads exactly the selected definition', async () => {
    const definition = { kind: 'Patient', name: 'Fixture report', columns: ['ID', 'Inactive'], filters: [{ field: 'Inactive', operator: 'Equals', value: false }] };
    db.document.create.mockImplementation(async ({ data }) => { db.document.findMany.mockResolvedValue([data]); return data; });
    const service = new ReportingService();
    await service.saveReport(definition);
    expect((await service.getSavedReports())[0]).toEqual({ _id: '999', ...definition });
  });
  it('applies patient and procedure filters in Procedures mode with zero fee intact', async () => {
    db.procedurelog.findMany.mockResolvedValue([{ ProcNum: 10n, PatNum: 1n, patient, ProcFee: 0, ProcStatus: 2, ProcDate: new Date('2026-10-08'), procedurecode_procedurelog_CodeNumToprocedurecode: { ProcCode: 'SAVED' } }]);
    const result = await runCustomReport({ kind: 'Procedures', columns: ['Code', 'Fee', 'email'], filters: [{ field: 'Inactive', value: false }, { field: 'Code', operator: 'Equals', value: 'SAVED' }] });
    expect(result.data).toEqual([{ Code: 'SAVED', Fee: 0, email: null }]);
    expect(result.total).toBe(1);
  });
  it('honors renewal year and distinguishes missing limits from zero', () => {
    expect(annualMaximum({})).toBeNull(); expect(annualMaximum({ annualMax: '$2,000' })).toBe(2000);
    expect(benefitPeriodStart({ renewalMonth: 12 }, now).toISOString().slice(0, 10)).toBe('2025-12-01');
    expect(remainingAnnualBenefit(null, 10)).toBeNull(); expect(remainingAnnualBenefit(0, 10)).toBe(0);
  });
  it('intersects selected branches with authorized clinics', () => {
    tenantContextStorage.run({ clinicIds: [1n], patientGroupId: 1 }, () => {
      expect(reportingClinicIds('All')).toEqual([1n]); expect(reportingClinicIds('2')).toEqual([]);
      expect(() => reportingClinicIds('1 OR 1=1')).toThrow();
    });
  });
});

describe('report output contains recorded facts', () => {
  it('returns no payment lines for a real plan without charges', async () => {
    db.payplan.findMany.mockResolvedValue([{ PayPlanNum: 1n, payplancharge: [] }]);
    expect(await new ReportGenerationService().getFinancialReport('payment-lines', {})).toEqual([]);
  });
  it('uses linked allocations, excludes credit charges, and does not label overdue as failed', () => {
    const plan = paymentPlanReport({ payplancharge: [
      { PayPlanChargeNum: 1n, ChargeType: 0, ChargeDate: '2026-09-01', Principal: 100, paysplit: [{ SplitAmt: 25, DatePay: '2026-09-02' }] },
      { PayPlanChargeNum: 2n, ChargeType: 1, Principal: 999 },
      { PayPlanChargeNum: 3n, ChargeType: 0, ChargeDate: '2026-12-01', Principal: 100, paysplit: [{ SplitAmt: 100, DatePay: '2026-10-01' }] },
    ] }, now);
    expect(plan.history).toHaveLength(2);
    expect(plan.history[0]).toMatchObject({ remainingAmount: 75, status: 'Overdue', failedAttempts: null, error: null });
    expect(plan.history[1].status).toBe('Paid'); expect(plan.remainingBalance).toBe('$75.00');
  });
  it.each(['getFinancialReport', 'getClinicalReport', 'getPatientReport', 'getOthersReport'])('rejects unknown slugs through %s', async method => {
    await expect((new ReportGenerationService() as any)[method]('not-a-report', {})).rejects.toThrow('Unsupported report');
  });
  it('does not invent prescription or deposit metadata', async () => {
    db.rxpat.findMany.mockResolvedValue([{ RxNum: 1n }]); db.deposit.findMany.mockResolvedValue([{ DepositNum: 1n, Amount: 0 }]);
    const service = new ReportGenerationService();
    expect((await service.getClinicalReport('rx', {}))[0]).toMatchObject({ drugName: null, duration: null, longTerm: null });
    expect((await service.getFinancialReport('deposit-slips', {}))[0]).toMatchObject({ bank: null, status: null, amount: 0 });
  });
});

describe('one recall category per eligible patient', () => {
  it.each([
    [null, false, false, false, 'noRecare'], [null, true, false, false, 'flaggedNoRecare'],
    ['2026-11-01', false, false, false, 'onTimeNoPreAppt'], ['2026-11-01', false, true, false, 'onTimePreAppt'],
    ['2025-01-01', false, true, true, 'late12mAppt'], ['2025-01-01', false, false, true, 'late12mBroken'], ['2025-01-01', false, false, false, 'late12mNoAppt'],
    ['2026-09-01', false, true, false, 'lateUnder12mAppt'], ['2026-09-01', false, false, true, 'lateUnder12mBroken'], ['2026-09-01', false, false, false, 'lateUnder12mNoAppt'],
  ])('classifies %s %s %s %s', (due, flagged, scheduled, broken, key) => {
    expect(classifyRecare(due as string | null, flagged as boolean, scheduled as boolean, broken as boolean, now)).toBe(key);
  });
  it('starts with patients so people without recalls are included once', async () => {
    db.patient.findMany.mockResolvedValue([patient, { ...patient, PatNum: 2n }]);
    meta.patients.mockResolvedValue({ '2': { patientFlags: ['Needs follow-up'] } });
    const rows = await recarePatientRows({ asOf: now }); const counts = countRecareCategories(rows);
    expect(counts.noRecare).toBe(1); expect(counts.flaggedNoRecare).toBe(1);
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(2);
    expect(db.patient.findMany.mock.calls[0][0].where.PatStatus).toBe(0);
  });
});

describe('shared configured goals', () => {
  it('distinguishes unconfigured goals from explicit zero without invented coefficients', () => {
    const empty = normalizeReportingGoals({}); const zero = normalizeReportingGoals({ dentistHourlyGoal: 0 });
    expect(goalIsConfigured(empty, 'dentistHourlyGoal')).toBe(false);
    expect(goalIsConfigured(zero, 'dentistHourlyGoal')).toBe(true);
    expect(goalPercent(100, 0)).toBeNull(); expect(productionGoal(4, zero.dentistHourlyGoal)).toBe(0);
    expect(collectionGoal(800, 90)).toBe(720);
  });
  it('uses only configured available hours and counts calendar days consistently', () => {
    expect(workingHoursInRange({}, now, now)).toBe(0);
    expect(workingHoursInRange({ workingHours: [{ dayOfWeek: 4, startTime: '08:00', endTime: '12:00', isAvailable: true }] }, now, now)).toBe(4);
    expect(workingHoursInRange({ workingHours: [{ dayOfWeek: 4, startTime: '08:00', endTime: '12:00', isAvailable: false }] }, now, now)).toBe(0);
    expect(() => normalizeReportingGoals({ collectionPercentGoal: 101 })).toThrow();
  });
  it('both services return the same production and collection targets for the same scope', async () => {
    db.preference.findFirst.mockResolvedValue({ ValueString: JSON.stringify({ dentistHourlyGoal: 200, hygienistHourlyGoal: 100, collectionPercentGoal: 90 }) });
    db.provider.findMany.mockResolvedValue([{ ProvNum: 1n, IsSecondary: 0, providerclinic: [] }, { ProvNum: 2n, IsSecondary: 1, providerclinic: [] }]);
    const hours = { workingHours: [{ dayOfWeek: 4, startTime: '08:00', endTime: '12:00', isAvailable: true }] };
    meta.providers.mockResolvedValue({ '1': hours, '2': hours });
    const dashboard = await new DashboardMetricsService().getDashboardMetrics('2026-10-08', 'Daily', 'All');
    const panel = await new ProductivityService().getPanelSummary('2026-10-08');
    for (const key of ['total', 'dentist', 'hygienist'] as const) {
      expect(panel[key].rows[0].goal).toBe(dashboard[key].pGoal);
      expect(panel[key].rows[1].goal).toBe(dashboard[key].cGoal);
      expect(dashboard[key].gpGoal).toBe(dashboard[key].pGoal);
    }
    expect(dashboard.total.pGoal).toBe(1200); expect(dashboard.total.cGoal).toBe(1080);
  });
});
