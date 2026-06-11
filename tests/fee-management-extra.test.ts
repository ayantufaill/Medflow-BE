import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { getAdminAuthHeader } from './helpers/auth';
import { prisma } from '../src/config/db';

describe('Fee Guides CRUD & Advanced Tools APIs', () => {
  let authHeader: { Authorization: string };

  beforeAll(async () => {
    authHeader = await getAdminAuthHeader();
  });

  it('performs CRUD and copy on fee schedules', async () => {
    // 1. Create a fee schedule
    const createRes = await request(app)
      .post('/api/fee-management/guides')
      .set(authHeader)
      .send({
        description: 'Test Office Fee 2026',
        feeSchedType: 1,
        isGlobal: true,
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.success).toBe(true);
    expect(createRes.body.data._id).toBeDefined();
    expect(createRes.body.data.description).toBe('Test Office Fee 2026');

    const feeSchedId = createRes.body.data._id;

    // 2. Edit the fee schedule
    const updateRes = await request(app)
      .put(`/api/fee-management/guides/${feeSchedId}`)
      .set(authHeader)
      .send({
        description: 'Updated Office Fee 2026',
        feeSchedType: 2,
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.success).toBe(true);
    expect(updateRes.body.data.description).toBe('Updated Office Fee 2026');
    expect(updateRes.body.data.feeSchedType).toBe(2);

    // 3. Copy the fee schedule
    const copyRes = await request(app)
      .post(`/api/fee-management/guides/${feeSchedId}/copy`)
      .set(authHeader)
      .send({
        description: 'Copied Office Fee 2026',
      });

    expect(copyRes.status).toBe(201);
    expect(copyRes.body.success).toBe(true);
    expect(copyRes.body.data._id).toBeDefined();
    expect(copyRes.body.data.description).toBe('Copied Office Fee 2026');

    const copiedId = copyRes.body.data._id;

    // 4. Delete/hide the schedules
    const deleteRes1 = await request(app)
      .delete(`/api/fee-management/guides/${feeSchedId}`)
      .set(authHeader);
    expect(deleteRes1.status).toBe(200);

    const deleteRes2 = await request(app)
      .delete(`/api/fee-management/guides/${copiedId}`)
      .set(authHeader);
    expect(deleteRes2.status).toBe(200);
  });

  it('runs advanced tools calculations successfully', async () => {
    // Clear locked fees
    const clearRes = await request(app)
      .post('/api/fee-management/tools/clear-locked')
      .set(authHeader)
      .send({});
    expect(clearRes.status).toBe(200);
    expect(clearRes.body.success).toBe(true);
    expect(clearRes.body.data.updatedCount).toBeDefined();

    // Re-estimate treatment plans
    const reestRes = await request(app)
      .post('/api/fee-management/tools/reestimate')
      .set(authHeader)
      .send({});
    expect(reestRes.status).toBe(200);
    expect(reestRes.body.success).toBe(true);
    expect(reestRes.body.data.updatedCount).toBeDefined();

    // Reset treatment plans
    const resetRes = await request(app)
      .post('/api/fee-management/tools/reset-tplans')
      .set(authHeader)
      .send({ patientIds: [] });
    expect(resetRes.status).toBe(200);
    expect(resetRes.body.success).toBe(true);
    expect(resetRes.body.data.updatedPatientsCount).toBeDefined();
  });

  it('manages statement printout form CRUD cycles', async () => {
    // 1. Get default statement form
    const getRes = await request(app)
      .get('/api/admin-finance/statement-forms')
      .set(authHeader);
    expect(getRes.status).toBe(200);
    expect(getRes.body.success).toBe(true);
    expect(getRes.body.data.length).toBeGreaterThanOrEqual(1);
    expect(getRes.body.data[0].name).toBe('Simple Statement');

    // 2. Create a statement form
    const createRes = await request(app)
      .post('/api/admin-finance/statement-forms')
      .set(authHeader)
      .send({
        name: 'Custom Statement Form',
        isDefault: false,
        sections: { header: false, transaction: true },
      });
    expect(createRes.status).toBe(201);
    expect(createRes.body.success).toBe(true);
    expect(createRes.body.data.id).toBeDefined();

    const createdId = createRes.body.data.id;

    // 3. Update the statement form
    const updateRes = await request(app)
      .put(`/api/admin-finance/statement-forms/${createdId}`)
      .set(authHeader)
      .send({
        name: 'Updated Custom Form',
        isDefault: true,
      });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.name).toBe('Updated Custom Form');

    // 4. Delete the form
    const deleteRes = await request(app)
      .delete(`/api/admin-finance/statement-forms/${createdId}`)
      .set(authHeader);
    expect(deleteRes.status).toBe(200);
  });

  it('manages coverage book shortcut CRUD cycles', async () => {
    // 1. Get default coverage shortcuts
    const getRes = await request(app)
      .get('/api/admin-finance/coverage-book-shortcuts')
      .set(authHeader);
    expect(getRes.status).toBe(200);
    expect(getRes.body.success).toBe(true);
    expect(getRes.body.data.length).toBeGreaterThanOrEqual(1);

    // 2. Create coverage book shortcut
    const createRes = await request(app)
      .post('/api/admin-finance/coverage-book-shortcuts')
      .set(authHeader)
      .send({
        name: 'Orthodontics Shortcuts',
        groups: [
          {
            id: 999,
            name: 'Braces',
            deliveryPattern: '1/lifetime',
            codes: [{ code: 'D8080', desc: 'Comprehensive orthodontic treatment' }],
          },
        ],
      });
    expect(createRes.status).toBe(201);
    expect(createRes.body.data.id).toBeDefined();

    const createdId = createRes.body.data.id;

    // 3. Update coverage book shortcut
    const updateRes = await request(app)
      .put(`/api/admin-finance/coverage-book-shortcuts/${createdId}`)
      .set(authHeader)
      .send({
        name: 'Updated Orthodontics Shortcuts',
      });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.name).toBe('Updated Orthodontics Shortcuts');

    // 4. Delete coverage book shortcut
    const deleteRes = await request(app)
      .delete(`/api/admin-finance/coverage-book-shortcuts/${createdId}`)
      .set(authHeader);
    expect(deleteRes.status).toBe(200);
  });
});
