import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { getAdminAuthHeader } from './helpers/auth';

describe('Languages', () => {
  let authHeader: { Authorization: string };

  beforeAll(async () => {
    authHeader = await getAdminAuthHeader();
  });

  it('gets all languages', async () => {
    const res = await request(app)
      .get('/api/languages')
      .set(authHeader);
    expect(res.status).toBe(200);
  });
});
