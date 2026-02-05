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
    const serviceId = created.ProcCode;
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

  it('validates service id', async () => {
    const res = await request(app)
      .get('/api/services/1')
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
      .put('/api/services/1')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(404);
  });

  it('validates delete service params', async () => {
    const res = await request(app)
      .delete('/api/services/1')
      .set(authHeader);
    expect(res.status).toBe(404);
  });
});
