import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { getAdminAuthHeader } from './helpers/auth';

describe('Providers', () => {
  let authHeader: { Authorization: string };

  beforeAll(async () => {
    authHeader = await getAdminAuthHeader();
  });

  it('gets all providers', async () => {
    const res = await request(app)
      .get('/api/providers')
      .set(authHeader);
    expect(res.status).toBe(200);
  });

  it('gets provider specialties', async () => {
    const res = await request(app)
      .get('/api/providers/specialties')
      .set(authHeader);
    expect(res.status).toBe(200);
  });

  it('validates provider id', async () => {
    const res = await request(app)
      .get('/api/providers/invalid-id')
      .set(authHeader);
    expect(res.status).toBe(400);
  });

  it('validates create provider payload', async () => {
    const res = await request(app)
      .post('/api/providers')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates update provider payload', async () => {
    const res = await request(app)
      .put('/api/providers/invalid-id')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates activate provider params', async () => {
    const res = await request(app)
      .patch('/api/providers/invalid-id/activate')
      .set(authHeader);
    expect(res.status).toBe(400);
  });

  it('validates deactivate provider params', async () => {
    const res = await request(app)
      .patch('/api/providers/invalid-id/deactivate')
      .set(authHeader);
    expect(res.status).toBe(400);
  });

  it('validates delete provider params', async () => {
    const res = await request(app)
      .delete('/api/providers/invalid-id')
      .set(authHeader);
    expect(res.status).toBe(400);
  });
});
