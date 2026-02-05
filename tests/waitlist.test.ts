import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { getAdminAuthHeader } from './helpers/auth';

describe('Waitlist', () => {
  let authHeader: { Authorization: string };

  beforeAll(async () => {
    authHeader = await getAdminAuthHeader();
  });

  it('gets all waitlist entries', async () => {
    const res = await request(app)
      .get('/api/waitlist')
      .set(authHeader);
    expect(res.status).toBe(200);
  });

  it('validates waitlist entry id', async () => {
    const res = await request(app)
      .get('/api/waitlist/1')
      .set(authHeader);
    expect(res.status).toBe(400);
  });

  it('validates create waitlist payload', async () => {
    const res = await request(app)
      .post('/api/waitlist')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates update waitlist payload', async () => {
    const res = await request(app)
      .put('/api/waitlist/1')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates mark called params', async () => {
    const res = await request(app)
      .post('/api/waitlist/1/called')
      .set(authHeader);
    expect(res.status).toBe(400);
  });

  it('validates mark scheduled params', async () => {
    const res = await request(app)
      .post('/api/waitlist/1/scheduled')
      .set(authHeader);
    expect(res.status).toBe(400);
  });

  it('validates convert to appointment payload', async () => {
    const res = await request(app)
      .post('/api/waitlist/1/convert-to-appointment')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates delete waitlist params', async () => {
    const res = await request(app)
      .delete('/api/waitlist/1')
      .set(authHeader);
    expect(res.status).toBe(400);
  });
});
