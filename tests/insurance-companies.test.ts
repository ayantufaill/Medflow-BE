import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { getAdminAuthHeader } from './helpers/auth';
import { uniqueToken } from './helpers/unique';
import { createCarrierRecord } from './helpers/fixtures';

describe('Insurance Companies', () => {
  let authHeader: { Authorization: string };

  beforeAll(async () => {
    authHeader = await getAdminAuthHeader();
  });

  it('gets all insurance companies', async () => {
    const res = await request(app)
      .get('/api/insurance-companies')
      .set(authHeader);
    expect(res.status).toBe(200);
  });

  it('creates an insurance company and finds it via search', async () => {
    const token = uniqueToken('ins');
    const created = await createCarrierRecord(token);
    const name = created.CarrierName;

    const listRes = await request(app)
      .get(`/api/insurance-companies?search=${encodeURIComponent(name)}`)
      .set(authHeader);
    expect(listRes.status).toBe(200);
    const items = listRes.body?.data?.companies ?? [];
    expect(items.some((item: any) => item.name === name)).toBe(true);
  });

  it('validates insurance company id', async () => {
    const res = await request(app)
      .get('/api/insurance-companies/invalid-id')
      .set(authHeader);
    expect(res.status).toBe(400);
  });

  it('validates create insurance company payload', async () => {
    const res = await request(app)
      .post('/api/insurance-companies')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates update insurance company payload', async () => {
    const res = await request(app)
      .put('/api/insurance-companies/invalid-id')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates delete insurance company params', async () => {
    const res = await request(app)
      .delete('/api/insurance-companies/invalid-id')
      .set(authHeader);
    expect(res.status).toBe(400);
  });
});
