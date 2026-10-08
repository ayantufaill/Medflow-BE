import { beforeEach, describe, expect, it, vi } from 'vitest';
import { basePrisma, withTenantTransaction } from '../src/config/db';
import { tenantContextStorage } from '../src/config/tenant-context';

describe('tenant transactions on the installed Prisma runtime', () => {
  const events: any[] = [];
  beforeEach(() => {
    process.env.DATABASE_URL = 'postgresql://unused:unused@127.0.0.1:1/unused';
    events.length = 0;
    let sequence = 0;
    vi.spyOn((basePrisma as any)._engine, 'transaction').mockImplementation(async (...args: any[]) => {
      const [action, , info] = args;
      const id = action === 'start' ? `test-${++sequence}` : info.id;
      events.push({ action, id });
      return { id };
    });
    vi.spyOn((basePrisma as any)._requestHandler, 'request').mockImplementation(async (...args: any[]) => {
      const [params] = args;
      events.push({ action: params.action, id: params.transaction?.id, args: params.args });
      return [];
    });
  });

  it('keeps tenant scope, row lock, model read and update on one transaction', async () => {
    await tenantContextStorage.run({ clinicIds: [30n], patientGroupId: 7, userId: 'test' }, () =>
      withTenantTransaction(async tx => {
        await tx.$queryRaw`SELECT "TreatPlanNum" FROM "treatplan" WHERE "TreatPlanNum" = 72 FOR UPDATE`;
        await tx.treatplan.findUnique({ where: { TreatPlanNum: 72n } });
        await tx.treatplan.update({ where: { TreatPlanNum: 72n }, data: { Heading: 'Draft' } });
      }),
    );
    expect(events.filter(e => e.action === 'start')).toHaveLength(1);
    expect(new Set(events.map(e => e.id))).toEqual(new Set(['test-1']));
    expect(events.map(e => e.action)).toEqual(['start', 'queryRaw', 'queryRaw', 'findUnique', 'update', 'commit']);
    expect(JSON.stringify(events[1].args)).toContain('app.clinic_ids');
    expect(JSON.stringify(events[1].args)).toContain('30');
  });

  it('rolls back the same transaction when work fails', async () => {
    await expect(tenantContextStorage.run({ clinicIds: [], patientGroupId: null }, () =>
      withTenantTransaction(async tx => {
        await tx.treatplan.update({ where: { TreatPlanNum: 72n }, data: { Heading: 'Draft' } });
        throw new Error('failed save');
      }),
    )).rejects.toThrow('failed save');
    expect(events.at(-1)).toEqual({ action: 'rollback', id: 'test-1' });
    expect(events.some(e => e.action === 'commit')).toBe(false);
  });
});
