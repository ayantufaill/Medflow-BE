/**
 * Coverage-limits engine tests (pure).
 *
 * These pin the rules that silently block or under-pay a line: age is inclusive,
 * the frequency window is open on the left, waiting/lifetime skip on missing
 * data, and all date math is UTC so the month-end boundary is stable.
 */
import { describe, it, expect } from 'vitest';
import {
  toUtcDate,
  addMonths,
  computeAge,
  parseDeliveryPattern,
  normalizeCoverageLimits,
  evaluateNotCovered,
  evaluateWaiting,
  evaluateAge,
  evaluateFrequency,
  evaluateLifetime,
  evaluateTeeth,
  isFixedBenefitCoverageType,
  stripCoveragePercentages,
} from '../src/services/coverage-limits.service';
import { parseTeethRange } from '../src/services/downgrade.service';

const book = (...rows: Record<string, any>[]) => rows;
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

describe('toUtcDate', () => {
  it('reads YYYY-MM-DD as a UTC calendar date', () => {
    const d = toUtcDate('2026-03-01');
    expect(d.getTime()).toBe(Date.UTC(2026, 2, 1));
  });

  it('keeps the UTC calendar day of a full timestamp', () => {
    expect(toUtcDate('2026-03-01T23:30:00Z').getTime()).toBe(Date.UTC(2026, 2, 1));
  });

  it('does not drift with the time-of-day', () => {
    // The regression this guards: local-time handling shifts the day and breaks
    // the Feb 28 / Mar 1 frequency boundary.
    expect(toUtcDate('2026-02-28T00:00:00Z').getUTCDate()).toBe(28);
    expect(toUtcDate('2026-02-28T23:59:59Z').getUTCDate()).toBe(28);
  });

  it('returns an Invalid Date for garbage', () => {
    expect(Number.isNaN(toUtcDate('not-a-date').getTime())).toBe(true);
    expect(Number.isNaN(toUtcDate(null).getTime())).toBe(true);
  });
});

describe('addMonths', () => {
  it('clamps the day to the target month length', () => {
    expect(addMonths(utc(2025, 1, 31), 1).getTime()).toBe(Date.UTC(2025, 1, 28));
    expect(addMonths(utc(2024, 1, 31), 1).getTime()).toBe(Date.UTC(2024, 1, 29));
  });

  it('subtracts months and crosses the year boundary', () => {
    expect(addMonths(utc(2026, 3, 1), -12).getTime()).toBe(Date.UTC(2025, 2, 1));
  });

  it('keeps the day when the target month is long enough', () => {
    expect(addMonths(utc(2026, 1, 15), 3).getTime()).toBe(Date.UTC(2026, 3, 15));
  });
});

describe('computeAge', () => {
  it('counts completed years', () => {
    expect(computeAge('2008-06-15', '2026-06-15')).toBe(18);
    expect(computeAge('2008-06-15', '2026-06-14')).toBe(17);
  });

  it('returns null when the birth date is missing or invalid', () => {
    expect(computeAge(null, '2026-06-15')).toBeNull();
    expect(computeAge('', '2026-06-15')).toBeNull();
    expect(computeAge('garbage', '2026-06-15')).toBeNull();
  });
});

describe('parseDeliveryPattern', () => {
  it('parses months and years', () => {
    expect(parseDeliveryPattern('2/12 M')).toEqual({ count: 2, months: 12 });
    expect(parseDeliveryPattern('1/6 M')).toEqual({ count: 1, months: 6 });
    expect(parseDeliveryPattern('1/5 Y')).toEqual({ count: 1, months: 60 });
    expect(parseDeliveryPattern('1/1 Y')).toEqual({ count: 1, months: 12 });
  });

  it('defaults a missing unit to months', () => {
    expect(parseDeliveryPattern('1/12')).toEqual({ count: 1, months: 12 });
  });

  it('returns null for blanks, partial patterns and garbage', () => {
    expect(parseDeliveryPattern('')).toBeNull();
    expect(parseDeliveryPattern(null)).toBeNull();
    expect(parseDeliveryPattern('/12 M')).toBeNull();
    expect(parseDeliveryPattern('2/ M')).toBeNull();
    expect(parseDeliveryPattern('whenever')).toBeNull();
    expect(parseDeliveryPattern(12)).toBeNull();
  });
});

describe('normalizeCoverageLimits', () => {
  const rule = (rows: Record<string, any>[]) =>
    normalizeCoverageLimits(rows).get('D1206');

  it('reads the delivery pattern first, then the split fields', () => {
    const withPattern = rule(book({ code: 'D1206', deliveryPattern: '2/12 M' }));
    expect(withPattern?.frequency).toEqual({ count: 2, months: 12 });

    const withSplit = rule(
      book({ code: 'D1206', frequency1: '2', frequency2: '12', period: 'M' })
    );
    expect(withSplit?.frequency).toEqual({ count: 2, months: 12 });

    const withYears = rule(
      book({ code: 'D1206', frequency1: '1', frequency2: '5', period: 'Y' })
    );
    expect(withYears?.frequency).toEqual({ count: 1, months: 60 });
  });

  it('prefers the delivery pattern when both are present', () => {
    const r = rule(
      book({
        code: 'D1206',
        deliveryPattern: '1/6 M',
        frequency1: '2',
        frequency2: '12',
        period: 'M',
      })
    );
    expect(r?.frequency).toEqual({ count: 1, months: 6 });
  });

  it('treats blank numeric fields as unset', () => {
    const r = rule(
      book({
        code: 'D1206',
        age: '',
        lifetimeLimit: '',
        flatPlanPortion: '',
        deliveryPattern: '',
      })
    );
    expect(r).toMatchObject({
      code: 'D1206',
      notCovered: false,
      ageLimit: null,
      frequency: null,
      lifetimeLimit: null,
      flatPlanPortion: null,
    });
  });

  it('parses not-covered, age, caps and teeth', () => {
    const r = rule(
      book({
        code: 'D1206',
        nc: true,
        age: '18',
        lifetimeLimit: '$1,500.00',
        flatPlanPortion: '50',
        teethLimit: '1, 3, 14',
      })
    );
    expect(r).toMatchObject({
      notCovered: true,
      ageLimit: 18,
      lifetimeLimit: 1500,
      flatPlanPortion: 50,
      teethLimit: ['P:1', 'P:14', 'P:3'],
    });
  });

  it('keeps an explicit $0 lifetime cap but treats $0 flat as unset', () => {
    const r = rule(book({ code: 'D1206', lifetimeLimit: '0', flatPlanPortion: '0' }));
    expect(r?.lifetimeLimit).toBe(0);
    expect(r?.flatPlanPortion).toBeNull();
  });

  it('drops rows without a code and non-object entries', () => {
    const map = normalizeCoverageLimits([
      { code: '' },
      { name: 'no code' },
      null,
      'nope',
      { code: 'D1206', age: '18' },
    ]);
    expect([...map.keys()]).toEqual(['D1206']);
  });

  it('keeps the last row for a duplicated code', () => {
    const map = normalizeCoverageLimits(
      book({ code: 'D1206', age: '10' }, { code: 'D1206', age: '18' })
    );
    expect(map.get('D1206')?.ageLimit).toBe(18);
  });

  it('returns an empty map for non-array input', () => {
    expect(normalizeCoverageLimits(null).size).toBe(0);
    expect(normalizeCoverageLimits({ code: 'D1206' }).size).toBe(0);
  });
});

describe('evaluateNotCovered', () => {
  it('blocks only when flagged', () => {
    expect(evaluateNotCovered(null)).toBe(false);
    expect(evaluateNotCovered({ notCovered: false } as any)).toBe(false);
    expect(evaluateNotCovered({ notCovered: true } as any)).toBe(true);
  });
});

describe('evaluateWaiting', () => {
  it('blocks strictly before the policy start + waiting months', () => {
    expect(evaluateWaiting(6, '2026-01-01', '2026-06-30')).toBe(true);
    expect(evaluateWaiting(6, '2026-01-01', '2026-07-01')).toBe(false);
    expect(evaluateWaiting(6, '2026-01-01', '2026-07-02')).toBe(false);
  });

  it('skips when the policy start or the waiting period is missing', () => {
    expect(evaluateWaiting(6, null, '2026-01-01')).toBe(false);
    expect(evaluateWaiting(6, '', '2026-01-01')).toBe(false);
    expect(evaluateWaiting(null, '2026-01-01', '2026-01-01')).toBe(false);
    expect(evaluateWaiting(0, '2026-01-01', '2026-01-01')).toBe(false);
  });
});

describe('evaluateAge', () => {
  const rule = { ageLimit: 18 } as any;

  it('covers up to and including the limit', () => {
    expect(evaluateAge(rule, 17)).toBe(false);
    expect(evaluateAge(rule, 18)).toBe(false);
  });

  it('blocks only above the limit', () => {
    expect(evaluateAge(rule, 19)).toBe(true);
  });

  it('never blocks without a limit or a known age', () => {
    expect(evaluateAge(null, 99)).toBe(false);
    expect(evaluateAge({ ageLimit: null } as any, 99)).toBe(false);
    expect(evaluateAge(rule, null)).toBe(false);
  });
});

describe('evaluateFrequency', () => {
  const rule = { frequency: { count: 1, months: 12 } } as any;

  it('blocks when the last service is inside the rolling year', () => {
    // Last service Mar 1 2025; service Feb 28 2026 → window (Feb 28 2025, ...]
    // contains Mar 1 2025 → blocked.
    expect(evaluateFrequency(rule, '2026-02-28', [{ date: '2025-03-01' }])).toBe(true);
  });

  it('allows a service exactly one window back (open-left boundary)', () => {
    // Service Mar 1 2026 → window (Mar 1 2025, Mar 1 2026]; the Mar 1 2025
    // service is NOT counted → allowed.
    expect(evaluateFrequency(rule, '2026-03-01', [{ date: '2025-03-01' }])).toBe(false);
  });

  it('allows when there is no prior usage', () => {
    expect(evaluateFrequency(rule, '2026-03-01', [])).toBe(false);
    expect(evaluateFrequency(rule, '2026-03-01', null)).toBe(false);
  });

  it('honours a count greater than one', () => {
    const twice = { frequency: { count: 2, months: 12 } } as any;
    const prior = [{ date: '2025-06-01' }];
    expect(evaluateFrequency(twice, '2026-01-01', prior)).toBe(false);
    expect(
      evaluateFrequency(twice, '2026-01-01', [{ date: '2025-06-01' }, { date: '2025-09-01' }])
    ).toBe(true);
  });

  it('ignores usage outside the window and future dates', () => {
    expect(evaluateFrequency(rule, '2026-03-01', [{ date: '2024-01-01' }])).toBe(false);
    expect(evaluateFrequency(rule, '2026-03-01', [{ date: '2026-12-01' }])).toBe(false);
  });

  it('never blocks when no frequency rule exists', () => {
    expect(evaluateFrequency(null, '2026-03-01', [{ date: '2025-03-01' }])).toBe(false);
    expect(evaluateFrequency({ frequency: null } as any, '2026-03-01', [{ date: '2025-03-01' }])).toBe(false);
  });
});

describe('evaluateLifetime', () => {
  const rule = { lifetimeLimit: 500 } as any;

  it('blocks once the cap is reached', () => {
    expect(evaluateLifetime(rule, 0)).toBe(false);
    expect(evaluateLifetime(rule, 499.99)).toBe(false);
    expect(evaluateLifetime(rule, 500)).toBe(true);
    expect(evaluateLifetime(rule, 750)).toBe(true);
  });

  it('blocks every line when the cap is an explicit $0', () => {
    const zero = { lifetimeLimit: 0 } as any;
    expect(evaluateLifetime(zero, 0)).toBe(true);
    expect(evaluateLifetime(zero, 100)).toBe(true);
  });

  it('never blocks without a cap', () => {
    expect(evaluateLifetime(null, 9999)).toBe(false);
    expect(evaluateLifetime({ lifetimeLimit: null } as any, 9999)).toBe(false);
  });
});

describe('evaluateTeeth', () => {
  const rule = (teethLimit: string[] | null) => ({ teethLimit } as any);

  it('never blocks when the row has no tooth limit', () => {
    expect(evaluateTeeth(rule(null), ['P:3'])).toBe(false);
    expect(evaluateTeeth(rule([]), ['P:3'])).toBe(false);
    expect(evaluateTeeth(null, ['P:3'])).toBe(false);
  });

  it('allows a line on a listed tooth', () => {
    expect(evaluateTeeth(rule(['P:3', 'P:14']), ['P:3'])).toBe(false);
    expect(evaluateTeeth(rule(['P:3', 'P:14']), ['P:14'])).toBe(false);
  });

  it('blocks a line on a tooth that is not listed', () => {
    expect(evaluateTeeth(rule(['P:3', 'P:14']), ['P:5'])).toBe(true);
  });

  it('blocks a multi-tooth range unless every tooth is listed', () => {
    expect(evaluateTeeth(rule(['P:3', 'P:14']), ['P:3', 'P:5'])).toBe(true);
    expect(evaluateTeeth(rule(['P:3', 'P:14']), ['P:3', 'P:14'])).toBe(false);
  });

  it('blocks a line whose tooth cannot be determined', () => {
    expect(evaluateTeeth(rule(['P:3']), null)).toBe(true);
    expect(evaluateTeeth(rule(['P:3']), [])).toBe(true);
  });

  it('parses a stored string limit and a range site end to end', () => {
    const map = normalizeCoverageLimits([
      { code: 'D2740', teethLimit: '3, 14' },
    ]);
    const parsed = map.get('D2740')!;
    expect(evaluateTeeth(parsed, parseTeethRange('3'))).toBe(false);
    expect(evaluateTeeth(parsed, parseTeethRange('5'))).toBe(true);
    expect(evaluateTeeth(parsed, parseTeethRange('1-3'))).toBe(true);
  });

  it('accepts a tooth selection stored as an array', () => {
    const map = normalizeCoverageLimits([{ code: 'D2391', teeth: ['3', '4'] }]);
    const parsed = map.get('D2391')!;
    expect(evaluateTeeth(parsed, parseTeethRange('4'))).toBe(false);
    expect(evaluateTeeth(parsed, parseTeethRange('9'))).toBe(true);
  });
});

describe('isFixedBenefitCoverageType', () => {
  it('is true for copay/fixed plan types', () => {
    expect(isFixedBenefitCoverageType('flat')).toBe(true);
    expect(isFixedBenefitCoverageType('copay')).toBe(true);
    expect(isFixedBenefitCoverageType(' FLAT ')).toBe(true);
  });

  it('is false for percentage plans and missing values', () => {
    expect(isFixedBenefitCoverageType('ppo')).toBe(false);
    expect(isFixedBenefitCoverageType('table')).toBe(false);
    expect(isFixedBenefitCoverageType(undefined)).toBe(false);
    expect(isFixedBenefitCoverageType(null)).toBe(false);
    expect(isFixedBenefitCoverageType('')).toBe(false);
  });
});

describe('stripCoveragePercentages', () => {
  const table = [
    {
      category: 'Preventative',
      items: [
        { id: 'D1110', label: 'D1110', coverage: 100, waiting: 0 },
        { id: 'D1206', label: 'D1206', coverage: 80, waiting: 6 },
      ],
    },
    { category: 'Restorative' },
  ];

  it('removes the coverage field from every item', () => {
    const result = stripCoveragePercentages(table);
    for (const entry of result) {
      for (const item of entry.items ?? []) {
        expect(item).not.toHaveProperty('coverage');
      }
    }
  });

  it('keeps every non-percentage field and itemless categories', () => {
    const result = stripCoveragePercentages(table);
    expect(result[0].items[0]).toEqual({ id: 'D1110', label: 'D1110', waiting: 0 });
    expect(result[0].items[1].waiting).toBe(6);
    expect(result[1]).toEqual({ category: 'Restorative' });
  });

  it('does not mutate its input', () => {
    stripCoveragePercentages(table);
    expect(table[0].items[0].coverage).toBe(100);
  });

  it('passes non-array input straight through', () => {
    expect(stripCoveragePercentages(undefined)).toBeUndefined();
    expect(stripCoveragePercentages(null)).toBeNull();
  });
});
