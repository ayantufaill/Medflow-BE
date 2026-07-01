import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { getAdminAuthHeader } from './helpers/auth';
import { uniqueToken } from './helpers/unique';
import { createPatientRecord } from './helpers/fixtures';

describe('Patients', () => {
  let authHeader: { Authorization: string };

  beforeAll(async () => {
    authHeader = await getAdminAuthHeader();
  });

  it('gets all patients', async () => {
    const res = await request(app)
      .get('/api/patients')
      .set(authHeader);
    expect(res.status).toBe(200);
  });

  it('creates a patient and finds it via search', async () => {
    const token = uniqueToken('patient');
    const created = await createPatientRecord(token);
    const firstName = created.FName;

    const searchRes = await request(app)
      .get(`/api/patients?search=${encodeURIComponent(firstName)}`)
      .set(authHeader);
    expect(searchRes.status).toBe(200);
    const items = searchRes.body?.data?.patients ?? [];
    expect(items.some((item: any) => item.firstName === firstName)).toBe(true);
  });

  it('searches patients', async () => {
    const res = await request(app)
      .get('/api/patients/search')
      .set(authHeader);
    expect(res.status).toBe(200);
  });

  it('validates check-duplicates payload', async () => {
    const res = await request(app)
      .post('/api/patients/check-duplicates')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates create patient payload', async () => {
    const res = await request(app)
      .post('/api/patients')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates patient balance params', async () => {
    const res = await request(app)
      .get('/api/patients/1/balance')
      .set(authHeader);
    expect(res.status).toBe(400);
  });

  it('validates get patient params', async () => {
    const res = await request(app)
      .get('/api/patients/1')
      .set(authHeader);
    expect(res.status).toBe(400);
  });

  it('validates update patient params', async () => {
    const res = await request(app)
      .put('/api/patients/1')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates delete patient params', async () => {
    const res = await request(app)
      .delete('/api/patients/1')
      .set(authHeader);
    expect(res.status).toBe(400);
  });

  it('validates get patient insurance params', async () => {
    const res = await request(app)
      .get('/api/patients/1/insurance')
      .set(authHeader);
    expect(res.status).toBe(400);
  });

  it('validates create patient insurance payload', async () => {
    const res = await request(app)
      .post('/api/patients/1/insurance')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates get patient insurance by id params', async () => {
    const res = await request(app)
      .get('/api/patients/1/insurance/1')
      .set(authHeader);
    expect(res.status).toBe(400);
  });

  it('validates update patient insurance params', async () => {
    const res = await request(app)
      .put('/api/patients/1/insurance/1')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates delete patient insurance params', async () => {
    const res = await request(app)
      .delete('/api/patients/1/insurance/1')
      .set(authHeader);
    expect(res.status).toBe(400);
  });

  it('validates get patient allergies params', async () => {
    const res = await request(app)
      .get('/api/patients/1/allergies')
      .set(authHeader);
    expect(res.status).toBe(400);
  });

  it('validates create patient allergy payload', async () => {
    const res = await request(app)
      .post('/api/patients/1/allergies')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates get patient allergy by id params', async () => {
    const res = await request(app)
      .get('/api/patients/1/allergies/1')
      .set(authHeader);
    expect(res.status).toBe(400);
  });

  it('validates update patient allergy params', async () => {
    const res = await request(app)
      .put('/api/patients/1/allergies/1')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates delete patient allergy params', async () => {
    const res = await request(app)
      .delete('/api/patients/1/allergies/1')
      .set(authHeader);
    expect(res.status).toBe(400);
  });
});
