import { describe, expect, it, vi } from 'vitest';
import { getTopDenialReasons, type DenialReasonRow } from '../src/utils/denial-reasons.util';

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('../src/config/db', () => ({ prisma: { $queryRawUnsafe: mocks.query } }));
vi.mock('../src/utils/opendental-ids.util', () => ({ getNextId: vi.fn() }));

import { ReportingService } from '../src/services/reporting.service';

const row = (overrides: Partial<DenialReasonRow> = {}): DenialReasonRow => ({
  claimNum: '1',
  narrative: null,
  reasonUnderPaid: null,
  adjustmentReasonCodes: null,
  ...overrides,
});

describe('denial reason resolution and ranking', () => {
  it('prefers the manual reason, preserving commas and complete text', () => {
    expect(getTopDenialReasons([row({
      narrative: JSON.stringify({ denialReason: '  Service not covered, subscriber policy excludes it  ' }),
      reasonUnderPaid: 'Legacy explanation',
      adjustmentReasonCodes: 'CO-96: $100',
    })])).toEqual(['Service not covered, subscriber policy excludes it']);
  });

  it.each(['{"denialReason":"  "}', '{broken', 'Legacy plain text', 'null', '[]', '{"denialReason":123}'])
    ('falls back to ReasonUnderPaid for an unusable narrative: %s', narrative => {
      expect(getTopDenialReasons([row({
        narrative,
        reasonUnderPaid: '  Benefit limit reached  ',
        adjustmentReasonCodes: 'CO-119: $100',
      })])).toEqual(['Benefit limit reached']);
    });

  it('uses adjustment codes when both claim-level explanations are missing', () => {
    expect(getTopDenialReasons([row({
      narrative: '{}', reasonUnderPaid: ' ', adjustmentReasonCodes: ' CO-96: $50; PR-1: $20 ',
    })])).toEqual(['CO-96: $50; PR-1: $20']);
  });

  it('ranks by distinct claims, not procedure rows, and returns three reasons with stable ties', () => {
    const rows = [
      ...Array.from({ length: 5 }, () => row({ reasonUnderPaid: 'One multi-procedure claim' })),
      row({ claimNum: '2', reasonUnderPaid: 'Most common reason' }),
      row({ claimNum: '3', reasonUnderPaid: 'Most common reason' }),
      row({ claimNum: '4', reasonUnderPaid: 'Alpha tie' }),
      row({ claimNum: '5', reasonUnderPaid: 'Beta tie' }),
    ];
    const expected = ['Most common reason', 'Alpha tie', 'Beta tie'];
    expect(getTopDenialReasons(rows)).toEqual(expected);
    expect(getTopDenialReasons([...rows].reverse())).toEqual(expected);
  });

  it('deduplicates line reasons within a claim while retaining different line explanations', () => {
    expect(getTopDenialReasons([
      row({ adjustmentReasonCodes: 'CO-96' }),
      row({ adjustmentReasonCodes: 'CO-96' }),
      row({ adjustmentReasonCodes: 'CO-119' }),
    ])).toEqual(['CO-119', 'CO-96']);
  });

  it('returns no reasons for empty or unrecorded data', () => {
    expect(getTopDenialReasons([])).toEqual([]);
    expect(getTopDenialReasons([row({ narrative: '{}', reasonUnderPaid: ' ', adjustmentReasonCodes: '' })])).toEqual([]);
  });
});

describe('denial report response', () => {
  it('exposes the saved reason for the three-claim example without changing financial fields', async () => {
    const reason = 'Service not covered under current subscriber policy';
    mocks.query.mockResolvedValue([{
      payerId: '10', payerName: 'Fixture Carrier', totalSubmitted: 6n, deniedCount: 3n, deniedValue: 300,
      reasonRows: ['1', '2', '3'].map(claimNum => [row({
        claimNum, narrative: JSON.stringify({ denialReason: reason }),
      })]),
    }]);

    expect(await new ReportingService().getDenialRates('30')).toEqual([{
      payerId: '10', payerName: 'Fixture Carrier', totalSubmitted: 6, deniedCount: 3, denialRate: '50.0%',
      deniedValue: 300, topReasons: [reason],
    }]);
  });

  it('preserves the existing None display when no reason is recorded', async () => {
    mocks.query.mockResolvedValue([{
      payerName: 'Fixture Carrier', totalSubmitted: 1n, deniedCount: 1n,
      deniedValue: 0, reasonRows: [row()],
    }]);
    expect((await new ReportingService().getDenialRates())[0].topReasons).toEqual(['None']);
  });
});
