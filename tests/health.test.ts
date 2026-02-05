import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app';

describe('Health', () => {
  it('GET / returns welcome payload', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'success' });
  });

  it('GET /health returns healthy', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'healthy' });
  });
});
