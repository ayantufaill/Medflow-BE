import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { getAdminAuthHeader } from './helpers/auth';
import { uniqueToken } from './helpers/unique';
import { createProcedureCodeRecord } from './helpers/fixtures';

describe('Services', () => {
  let authHeader: { Authorization: string };

  beforeAll(async () => {
    authHeader = await getAdminAuthHeader();
  });

  it('gets all services', async () => {
    const res = await request(app)
      .get('/api/services')
      .set(authHeader);
    expect(res.status).toBe(200);
  });

  it('creates, fetches, updates, and deletes a service', async () => {
    const token = uniqueToken('service');
    const created = await createProcedureCodeRecord(token);
    const serviceId = created.CodeNum.toString();
    const cptCode = created.ProcCode;

    const getRes = await request(app)
      .get(`/api/services/${serviceId}`)
      .set(authHeader);
    expect(getRes.status).toBe(200);
    expect(getRes.body?.data?.service?.cptCode).toBe(cptCode);

    const updatedName = `Updated ${token}`;
    const updateRes = await request(app)
      .put(`/api/services/${serviceId}`)
      .set(authHeader)
      .send({ name: updatedName });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body?.data?.service?.name).toBe(updatedName);

    const deleteRes = await request(app)
      .delete(`/api/services/${serviceId}`)
      .set(authHeader);
    expect(deleteRes.status).toBe(200);
  });

  it('toggles the service active status', async () => {
    const token = uniqueToken('service');
    const created = await createProcedureCodeRecord(token);
    const serviceId = created.CodeNum.toString();

    // Check initial status
    const getRes1 = await request(app)
      .get(`/api/services/${serviceId}`)
      .set(authHeader);
    expect(getRes1.status).toBe(200);
    expect(getRes1.body?.data?.service?.isActive).toBe(true);

    // First toggle: true -> false
    const toggleRes1 = await request(app)
      .patch(`/api/services/${serviceId}/toggle`)
      .set(authHeader);
    expect(toggleRes1.status).toBe(200);
    expect(toggleRes1.body?.data?.service?.isActive).toBe(false);

    // Verify status persists on GET
    const getRes2 = await request(app)
      .get(`/api/services/${serviceId}`)
      .set(authHeader);
    expect(getRes2.status).toBe(200);
    expect(getRes2.body?.data?.service?.isActive).toBe(false);

    // Second toggle: false -> true
    const toggleRes2 = await request(app)
      .patch(`/api/services/${serviceId}/toggle`)
      .set(authHeader);
    expect(toggleRes2.status).toBe(200);
    expect(toggleRes2.body?.data?.service?.isActive).toBe(true);

    // Cleanup
    await request(app)
      .delete(`/api/services/${serviceId}`)
      .set(authHeader);
  });

  it('validates service id', async () => {
    const res = await request(app)
      .get('/api/services/999999')
      .set(authHeader);
    expect(res.status).toBe(404);
  });

  it('validates create service payload', async () => {
    const res = await request(app)
      .post('/api/services')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates update service payload', async () => {
    const res = await request(app)
      .put('/api/services/999999')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(404);
  });

  it('validates delete service params', async () => {
    const res = await request(app)
      .delete('/api/services/999999')
      .set(authHeader);
    expect(res.status).toBe(404);
  });
});
