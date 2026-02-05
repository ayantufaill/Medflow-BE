import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { getAdminAuthHeader } from './helpers/auth';

describe('Allergies', () => {
  let authHeader: { Authorization: string };

  beforeAll(async () => {
    authHeader = await getAdminAuthHeader();
  });

  it('validates allergy list query', async () => {
    const res = await request(app)
      .get('/api/allergies')
      .set(authHeader);
    expect(res.status).toBe(400);
  });

  it('validates create allergy payload', async () => {
    const res = await request(app)
      .post('/api/allergies')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates allergy id', async () => {
    const res = await request(app)
      .get('/api/allergies/1')
      .set(authHeader);
    expect(res.status).toBe(400);
  });

  it('validates update allergy payload', async () => {
    const res = await request(app)
      .put('/api/allergies/1')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates delete allergy params', async () => {
    const res = await request(app)
      .delete('/api/allergies/1')
      .set(authHeader);
    expect(res.status).toBe(400);
  });
});
