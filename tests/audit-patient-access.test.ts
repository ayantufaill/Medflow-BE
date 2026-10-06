import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';

const writeAudit = vi.hoisted(() => vi.fn());
vi.mock('../src/services/audit.service', () => ({ writeAudit }));
vi.mock('../src/config/db', () => ({ prisma: {} }));

import { auditPatientAccess } from '../src/middleware/audit.middleware';
import { PermType } from '../src/constants/audit-types';

const run = async (method: string, patientId: string, status: number, userId: string | null = '28') => {
  const req = { method, params: { patientId }, userId: userId ?? undefined, originalUrl: `/api/patients/${patientId}` } as never;
  const res = Object.assign(new EventEmitter(), { statusCode: status }) as never;
  const next = vi.fn();
  auditPatientAccess(req, res, next);
  expect(next).toHaveBeenCalledOnce();
  (res as EventEmitter).emit('finish');
  await new Promise((r) => setImmediate(r));
};

describe('auditPatientAccess', () => {
  beforeEach(() => {
    writeAudit.mockReset();
    writeAudit.mockResolvedValue(true);
  });

  it('logs a successful read with actor and patient', async () => {
    await run('GET', '57', 200);
    expect(writeAudit).toHaveBeenCalledWith(expect.objectContaining({ userNum: 28n, patNum: 57n, permType: PermType.PATIENT_RECORD_READ }));
  });

  it('logs refused attempts (403 and 404)', async () => {
    await run('GET', '58', 404);
    await run('PUT', '58', 403);
    expect(writeAudit).toHaveBeenCalledTimes(2);
    for (const [args] of writeAudit.mock.calls) {
      expect(args).toMatchObject({ permType: PermType.PATIENT_ACCESS_DENIED, patNum: 58n });
      expect(args.text).toContain('patient 58');
    }
  });

  it('retries a denied attempt without PatNum when the id does not exist', async () => {
    writeAudit.mockResolvedValueOnce(false);
    await run('GET', '999999', 404);
    expect(writeAudit).toHaveBeenCalledTimes(2);
    expect(writeAudit.mock.calls[1][0].patNum).toBeUndefined();
    expect(writeAudit.mock.calls[1][0].text).toContain('999999');
  });

  it('ignores writes that succeed, server errors, non-numeric paths and anonymous requests', async () => {
    await run('PUT', '57', 200);
    await run('GET', '57', 500);
    await run('GET', 'search', 200);
    await run('GET', '57', 200, null);
    expect(writeAudit).not.toHaveBeenCalled();
  });
});
