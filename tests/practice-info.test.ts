import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { getAdminAuthHeader } from './helpers/auth';

describe('Practice Info', () => {
  let authHeader: { Authorization: string };

  beforeAll(async () => {
    authHeader = await getAdminAuthHeader();
  });

  it('gets all practice info records', async () => {
    const res = await request(app)
      .get('/api/practice-info')
      .set(authHeader);
    expect(res.status).toBe(200);
  });

  it('gets current practice info', async () => {
    const res = await request(app)
      .get('/api/practice-info/current')
      .set(authHeader);
    expect(res.status).toBe(200);
  });

  it('validates practice info id', async () => {
    const res = await request(app)
      .get('/api/practice-info/1')
      .set(authHeader);
    expect(res.status).toBe(400);
  });

  it('validates create practice info payload', async () => {
    const res = await request(app)
      .post('/api/practice-info')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates update practice info payload', async () => {
    const res = await request(app)
      .put('/api/practice-info/1')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates delete practice info params', async () => {
    const res = await request(app)
      .delete('/api/practice-info/1')
      .set(authHeader);
    expect(res.status).toBe(400);
  });
});
