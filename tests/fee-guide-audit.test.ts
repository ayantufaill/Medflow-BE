import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { getAdminAuthHeader } from './helpers/auth';
import { prisma } from '../src/config/db';
import { getNextId } from '../src/utils/opendental-ids.util';

describe('Fee Guide Audit History', () => {
  let authHeader: { Authorization: string };
  let createdGuideId: string;

  beforeAll(async () => {
    authHeader = await getAdminAuthHeader();

    // Ensure D0120 procedure code exists
    const existing = await prisma.procedurecode.findFirst({ where: { ProcCode: 'D0120' } });
    if (!existing) {
      const nextCodeId = await getNextId('procedurecode', 'CodeNum');
      await prisma.procedurecode.create({
        data: {
          CodeNum: nextCodeId,
          ProcCode: 'D0120',
          Descript: 'Periodic Oral Evaluation',
        },
      });
    }
  });

  it('records audit log on fee schedule creation', async () => {
    const res = await request(app)
      .post('/api/fee-management/guides')
      .set(authHeader)
      .send({
        description: 'Audit Test Guide 2026',
        feeSchedType: 0,
        isGlobal: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    createdGuideId = res.body.data._id;
    expect(createdGuideId).toBeDefined();

    // Check audit history
    const auditRes = await request(app)
      .get(`/api/fee-management/guides/${createdGuideId}/audit-history`)
      .set(authHeader);

    expect(auditRes.status).toBe(200);
    expect(auditRes.body.success).toBe(true);
    const events = auditRes.body.data.auditEvents;
    expect(events.length).toBeGreaterThanOrEqual(1);

    const createEvent = events.find((e: any) => e.action === 'Create');
    expect(createEvent).toBeDefined();
    expect(createEvent.feeGuideName).toBe('Audit Test Guide 2026');
    expect(createEvent.actorName).toBeDefined();
    expect(createEvent.differences.some((d: any) => d.key === 'description' && d.new === 'Audit Test Guide 2026')).toBe(true);
  });

  it('records audit log on fee schedule update with diffs', async () => {
    const res = await request(app)
      .put(`/api/fee-management/guides/${createdGuideId}`)
      .set(authHeader)
      .send({
        description: 'Audit Test Guide 2026 Updated',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const auditRes = await request(app)
      .get(`/api/fee-management/guides/${createdGuideId}/audit-history`)
      .set(authHeader);

    expect(auditRes.status).toBe(200);
    const events = auditRes.body.data.auditEvents;
    const updateEvent = events.find((e: any) => e.action === 'Update');
    expect(updateEvent).toBeDefined();
    expect(updateEvent.differences).toContainEqual({
      key: 'description',
      old: 'Audit Test Guide 2026',
      new: 'Audit Test Guide 2026 Updated',
    });
  });

  it('records audit log on fee change', async () => {
    const res = await request(app)
      .put(`/api/fee-management/guides/${createdGuideId}/fees`)
      .set(authHeader)
      .send({
        fees: [
          { procCode: 'D0120', amount: 125 },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const auditRes = await request(app)
      .get(`/api/fee-management/guides/${createdGuideId}/audit-history`)
      .set(authHeader);

    expect(auditRes.status).toBe(200);
    const events = auditRes.body.data.auditEvents;
    const feeChangeEvent = events.find((e: any) => e.action === 'Fee Change');
    expect(feeChangeEvent).toBeDefined();
    expect(feeChangeEvent.differences.some((d: any) => d.key === 'D0120 Fee' && d.new === 125)).toBe(true);
  });

  it('records audit log on fee schedule deletion', async () => {
    const res = await request(app)
      .delete(`/api/fee-management/guides/${createdGuideId}`)
      .set(authHeader);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const auditRes = await request(app)
      .get(`/api/fee-management/guides/${createdGuideId}/audit-history`)
      .set(authHeader);

    expect(auditRes.status).toBe(200);
    const events = auditRes.body.data.auditEvents;
    const deleteEvent = events.find((e: any) => e.action === 'Delete');
    expect(deleteEvent).toBeDefined();
  });

  it('serves audit history via the /api/admin/finance-management/fee-guides/:id/audit-history alias', async () => {
    const res = await request(app)
      .get(`/api/admin/finance-management/fee-guides/${createdGuideId}/audit-history`)
      .set(authHeader);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.auditEvents)).toBe(true);
    expect(res.body.data.auditEvents.length).toBeGreaterThanOrEqual(3);
  });
});
