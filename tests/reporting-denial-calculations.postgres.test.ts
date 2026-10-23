import { execFileSync } from 'node:child_process';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../src/config/db', () => ({ prisma: { $queryRawUnsafe: mocks.query } }));
vi.mock('../src/utils/opendental-ids.util', () => ({ getNextId: vi.fn() }));
import { ReportingService } from '../src/services/reporting.service';

// Opt in to a local PostgreSQL container. Every query is READ ONLY and all four
// table names are shadowed by synthetic CTEs. No setup, seeds, or real rows used.
const container = process.env.REPORTING_POSTGRES_CONTAINER;
type RecordRow = Record<string, unknown>;
let claims: RecordRow[];
let lines: RecordRow[];
let carriers: RecordRow[];
let plans: RecordRow[];

const claim = (id: number, extra: RecordRow = {}): RecordRow => ({
  ClaimNum: id, ClinicNum: 30, PlanNum: 1, ClaimStatus: 'D', ClaimFee: 300,
  DateSent: null, Narrative: '{"denialReason":"Not covered, under policy"}', ReasonUnderPaid: null,
  ...extra,
});
const line = (id: number, claimId: number, proc: number | null, fee: number | null, extra: RecordRow = {}): RecordRow => ({
  ClaimProcNum: id, ClaimNum: claimId, ClinicNum: 30, ProcNum: proc, FeeBilled: fee, Status: 0,
  PaymentRow: 0, IsTransfer: 0, NoBillIns: 0, LineNumber: null, ClaimAdjReasonCodes: null,
  ...extra,
});

const cte = (name: string, rows: RecordRow[], schema: string) =>
  `${name} AS (SELECT * FROM jsonb_to_recordset('${JSON.stringify(rows).replace(/'/g, "''")}'::jsonb) AS fixture(${schema}))`;

describe.skipIf(!container)('denial calculations using actual SQL on read-only PostgreSQL fixtures', () => {
  beforeEach(() => {
    claims = [];
    lines = [];
    carriers = [{ CarrierNum: 1, CarrierName: 'Fixture Carrier' }];
    plans = [{ PlanNum: 1, CarrierNum: 1 }];
    mocks.query.mockImplementation(async (sql: string) => {
      const fixtures = [
        cte('claim', claims, '"ClaimNum" bigint, "ClinicNum" bigint, "PlanNum" bigint, "ClaimStatus" text, "DateSent" timestamp, "ClaimFee" double precision, "Narrative" text, "ReasonUnderPaid" text'),
        cte('claimproc', lines, '"ClaimProcNum" bigint, "ClaimNum" bigint, "ClinicNum" bigint, "ProcNum" bigint, "LineNumber" integer, "FeeBilled" double precision, "Status" integer, "PaymentRow" integer, "IsTransfer" integer, "NoBillIns" integer, "ClaimAdjReasonCodes" text'),
        cte('carrier', carriers, '"CarrierNum" bigint, "CarrierName" text'),
        cte('insplan', plans, '"PlanNum" bigint, "CarrierNum" bigint'),
      ].join(',\n');
      const output = execFileSync('docker', [
        'exec', '-i', container!, 'sh', '-c',
        'exec psql -X -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -Atq',
      ], {
        input: `BEGIN READ ONLY; SET LOCAL statement_timeout = '10s'; WITH ${fixtures}
          SELECT COALESCE(json_agg(result), '[]'::json) FROM (${sql}) result; ROLLBACK;`,
        encoding: 'utf8', timeout: 20000,
      });
      return JSON.parse(output.trim());
    });
  });

  const run = (branchId?: string) => new ReportingService().getDenialRates(branchId);

  it('counts a five-procedure denied claim once against one paid claim and keeps its reason intact', async () => {
    claims = [claim(1), claim(2, { ClaimStatus: 'R' })];
    lines = Array.from({ length: 5 }, (_, i) => line(i + 1, 1, i + 1, 60));
    expect(await run()).toEqual([{
      payerId: '1', payerName: 'Fixture Carrier', totalSubmitted: 2, deniedCount: 1,
      deniedValue: 300, denialRate: '50.0%', topReasons: ['Not covered, under policy'],
    }]);
  });

  it('does not classify paid claims with statuses 4 or 7 as denied', async () => {
    claims = [claim(1, { ClaimStatus: 'R' }), claim(2, { ClaimStatus: 'R' })];
    lines = [line(1, 1, 1, 900, { Status: 4 }), line(2, 2, 2, 800, { Status: 7 })];
    expect((await run())[0]).toMatchObject({ totalSubmitted: 2, deniedCount: 0, deniedValue: 0, denialRate: '0.0%', topReasons: ['None'] });
  });

  it('uses each claim fee once even when every procedure fee is null', async () => {
    claims = [claim(1, { ClaimFee: 500 })];
    lines = Array.from({ length: 5 }, (_, i) => line(i + 1, 1, i + 1, null));
    expect((await run())[0]).toMatchObject({ totalSubmitted: 1, deniedCount: 1, deniedValue: 500, denialRate: '100.0%' });
  });

  it('falls back to unique original procedures without collapsing equal fees or adding payment rows', async () => {
    claims = [claim(1, { ClaimFee: null })];
    lines = [
      line(1, 1, 10, 100), line(2, 1, 10, 100), line(3, 1, 11, 100),
      line(4, 1, 10, 900, { Status: 4 }), line(5, 1, 12, 800, { Status: 7 }),
      line(6, 1, 13, 700, { Status: 6 }), line(7, 1, 14, 600, { PaymentRow: 1 }),
      line(8, 1, 15, 500, { IsTransfer: 1 }), line(9, 1, 16, 400, { NoBillIns: 1 }),
    ];
    expect((await run())[0]).toMatchObject({ deniedCount: 1, deniedValue: 200, denialRate: '100.0%' });
  });

  it('uses line identity when procedure identity is missing and preserves distinct unlinked rows', async () => {
    claims = [claim(1, { ClaimFee: null })];
    lines = [
      line(1, 1, null, 25, { LineNumber: 1 }), line(2, 1, 0, 25, { LineNumber: 1 }),
      line(3, 1, null, 25, { LineNumber: 2 }), line(4, 1, null, 25), line(5, 1, null, 25),
    ];
    expect((await run())[0].deniedValue).toBe(100);
  });

  it('prefers original billed lines over claim totals and preserves zero original fees', async () => {
    claims = [claim(1, { ClaimFee: 0 }), claim(2, { ClaimFee: null })];
    lines = [line(1, 1, 10, 100), line(2, 2, 11, 0), line(3, 2, 11, 200)];
    expect((await run())[0]).toMatchObject({ deniedCount: 2, deniedValue: 100 });
  });

  it('keeps denied claims without procedure rows and safely resolves legacy reason fallbacks', async () => {
    claims = [claim(1, { ClaimFee: null, Narrative: '{broken', ReasonUnderPaid: 'Legacy explanation' })];
    expect((await run())[0]).toMatchObject({ deniedCount: 1, deniedValue: 0, topReasons: ['Legacy explanation'] });
  });

  it('keeps different carriers with the same display name separate', async () => {
    carriers.push({ CarrierNum: 2, CarrierName: 'Fixture Carrier' });
    plans.push({ PlanNum: 2, CarrierNum: 2 });
    claims = [claim(1), claim(2, { PlanNum: 2, ClaimStatus: 'R' })];
    const results = await run();
    expect(results).toHaveLength(2);
    expect(results.find(r => r.payerId === '1')).toMatchObject({ totalSubmitted: 1, deniedCount: 1 });
    expect(results.find(r => r.payerId === '2')).toMatchObject({ totalSubmitted: 1, deniedCount: 0 });
  });

  it('applies branch scope to all eligible states and excludes drafts, unknowns, and unsent rejections', async () => {
    claims = [
      claim(1), claim(2, { ClinicNum: 31 }), claim(3, { ClaimStatus: 'S' }),
      claim(4, { ClaimStatus: 'P' }), claim(5, { ClaimStatus: 'T' }),
      claim(6, { ClaimStatus: 'X' }), claim(7, { ClaimStatus: 'H' }),
      claim(8, { ClaimStatus: null }), claim(9, { ClaimStatus: 'U' }),
      claim(10, { ClaimStatus: 'X', DateSent: '2026-01-01' }),
      claim(11, { ClaimStatus: 'X', DateSent: '0001-01-01' }),
    ];
    expect((await run('30'))[0]).toMatchObject({ totalSubmitted: 5, deniedCount: 1, denialRate: '20.0%' });
  });

  it('ranks reasons by distinct claims even when the less common reason has more procedure rows', async () => {
    claims = [claim(1), claim(2), claim(3, { Narrative: '{}', ReasonUnderPaid: null })];
    lines = Array.from({ length: 5 }, (_, i) => line(i + 1, 3, i + 1, 60, { ClaimAdjReasonCodes: 'CO-96' }));
    expect((await run())[0].topReasons).toEqual(['Not covered, under policy', 'CO-96']);
  });

  it('returns no rows when there are no eligible claims', async () => {
    expect(await run()).toEqual([]);
  });

  it('includes an unassigned denied claim in the one branch established by its procedure lines', async () => {
    claims = [claim(1, { ClinicNum: null, Narrative: '{"denialReason":"information is false"}' })];
    lines = [line(1, 1, 10, 90), line(2, 1, 11, 105)];
    expect((await run('30'))[0]).toMatchObject({ totalSubmitted: 1, deniedCount: 1, deniedValue: 195, topReasons: ['information is false'] });
    expect(await run('31')).toEqual([]);
  });

  it('treats the zero clinic sentinel as unassigned without counting a claim twice', async () => {
    claims = [claim(1, { ClinicNum: 0 })];
    lines = [line(1, 1, 10, 100), line(2, 1, 11, 100)];
    expect((await run('30'))[0]).toMatchObject({ totalSubmitted: 1, deniedCount: 1, deniedValue: 200 });
  });

  it('never overrides an explicitly stored claim branch with line ownership', async () => {
    claims = [claim(1, { ClinicNum: 31 })];
    lines = [line(1, 1, 10, 100)];
    expect(await run('30')).toEqual([]);
    expect((await run('31'))[0].deniedCount).toBe(1);
  });

  it('does not assign mixed-branch, partially unknown, or unlinked claims to a branch', async () => {
    claims = [claim(1, { ClinicNum: null }), claim(2, { ClinicNum: null }), claim(3, { ClinicNum: null })];
    lines = [line(1, 1, 10, 100), line(2, 1, 11, 100, { ClinicNum: 31 }), line(3, 2, 12, 100), line(4, 2, 13, 100, { ClinicNum: null })];
    expect(await run('30')).toEqual([]);
    expect(await run('31')).toEqual([]);
    expect((await run())[0].deniedCount).toBe(3);
  });
});
