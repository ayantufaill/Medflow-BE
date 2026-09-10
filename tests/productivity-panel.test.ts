import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { getAdminAuthHeader } from './helpers/auth';

describe('Productivity Panel Summary API', () => {
  let authHeader: { Authorization: string };

  beforeAll(async () => {
    authHeader = await getAdminAuthHeader();
  });

  it('fails with 401 on unauthorized access', async () => {
    const res = await request(app)
      .get('/api/productivity/panel-summary?date=2026-09-10');

    expect(res.status).toBe(401);
  });

  it('fails with 400 on invalid date format', async () => {
    const res = await request(app)
      .get('/api/productivity/panel-summary?date=invalid-date')
      .set(authHeader);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('fails with 400 on invalid calendar date', async () => {
    const res = await request(app)
      .get('/api/productivity/panel-summary?date=2026-02-31')
      .set(authHeader);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns valid productivity panel summary on valid date request', async () => {
    const res = await request(app)
      .get('/api/productivity/panel-summary?date=2026-09-10')
      .set(authHeader);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toBeDefined();

    const { total, dentist, hygienist } = res.body.data;
    expect(total).toBeDefined();
    expect(total.title).toBe('Total');
    expect(typeof total.scheduled).toBe('number');
    expect(Array.isArray(total.rows)).toBe(true);
    expect(total.rows.length).toBe(4);
    expect(total.rows.map((r: any) => r.id)).toEqual(['P', 'C', 'GP', 'GC']);
    expect(typeof total.perHour).toBe('number');
    expect(typeof total.perHourGoal).toBe('number');
    expect(typeof total.perVisit).toBe('number');
    expect(typeof total.perVisitGoal).toBe('number');

    expect(dentist).toBeDefined();
    expect(dentist.title).toBe('Dentist');
    expect(typeof dentist.scheduled).toBe('number');
    expect(Array.isArray(dentist.rows)).toBe(true);
    expect(dentist.rows.length).toBe(4);

    expect(hygienist).toBeDefined();
    expect(hygienist.title).toBe('Hygienist');
    expect(typeof hygienist.scheduled).toBe('number');
    expect(Array.isArray(hygienist.rows)).toBe(true);
    expect(hygienist.rows.length).toBe(4);
  });

  it('handles provider-filtered request', async () => {
    const res = await request(app)
      .get('/api/productivity/panel-summary?date=2026-09-10&providerId=Dentist')
      .set(authHeader);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toBeDefined();
    expect(res.body.data.total).toBeDefined();
    expect(res.body.data.dentist).toBeDefined();
    expect(res.body.data.hygienist).toBeDefined();
  });

  it('returns clean empty production metrics on date with no data', async () => {
    const res = await request(app)
      .get('/api/productivity/panel-summary?date=1990-01-01')
      .set(authHeader);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toBeDefined();

    const { total, dentist, hygienist } = res.body.data;
    expect(total.scheduled).toBe(0);
    expect(total.perHour).toBe(0);
    expect(total.perVisit).toBe(0);
    expect(total.rows.find((r: any) => r.id === 'P')?.value).toBe(0);
    expect(total.rows.find((r: any) => r.id === 'C')?.value).toBe(0);

    expect(dentist.scheduled).toBe(0);
    expect(dentist.perHour).toBe(0);
    expect(dentist.perVisit).toBe(0);

    expect(hygienist.scheduled).toBe(0);
    expect(hygienist.perHour).toBe(0);
    expect(hygienist.perVisit).toBe(0);
  });
});
