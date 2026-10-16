import { describe, expect, it } from 'vitest';
import { invoiceService } from '../src/services/invoice.service';

describe('preventive coverage percentage', () => {
  it('uses the preventive sub-row for both D1320 and D1321 when the latter has no catalog tier', () => {
    const service = invoiceService as any;
    const tables = service.buildCoveragePercentTables([
      {
        category: 'preventative',
        items: [
          { label: 'Basic', coverage: 100 },
          { label: 'Preventative', coverage: 50 },
        ],
      },
    ]);
    const ctx = {
      ...tables,
      coverageCategoryByCode: new Map([['D1320', 'Preventive Services']]),
    };

    expect(service.resolveCoveragePercent('D1320', true, ctx, [], new Map())).toBe(50);
    expect(service.resolveCoveragePercent('D1321', true, ctx, [], new Map())).toBe(50);
  });

  it('keeps an explicit procedure percentage ahead of the preventive category', () => {
    const service = invoiceService as any;
    const tables = service.buildCoveragePercentTables([
      { category: 'preventative', items: [{ label: 'Preventative', coverage: 50 }, { code: 'D1321', coverage: 70 }] },
    ]);
    const ctx = { ...tables, coverageCategoryByCode: new Map() };

    expect(service.resolveCoveragePercent('D1321', true, ctx, [], new Map())).toBe(70);
  });
});
