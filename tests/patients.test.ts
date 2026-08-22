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
    const firstName = created.FName || '';

    const searchRes = await request(app)
      .get(`/api/patients?search=${encodeURIComponent(firstName)}`)
      .set(authHeader);
    expect(searchRes.status).toBe(200);
    const items = searchRes.body?.data?.patients ?? [];
    expect(items.some((item: any) => item.firstName === firstName)).toBe(true);
  });

  it('finds a patient via case-insensitive search', async () => {
    const token = uniqueToken('case');
    const created = await createPatientRecord(token);
    const firstName = created.FName || '';

    // Search with lowercase
    const searchResLower = await request(app)
      .get(`/api/patients?search=${encodeURIComponent(firstName.toLowerCase())}`)
      .set(authHeader);
    expect(searchResLower.status).toBe(200);
    const itemsLower = searchResLower.body?.data?.patients ?? [];
    expect(itemsLower.some((item: any) => item.firstName === firstName)).toBe(true);

    // Search with uppercase
    const searchResUpper = await request(app)
      .get(`/api/patients?search=${encodeURIComponent(firstName.toUpperCase())}`)
      .set(authHeader);
    expect(searchResUpper.status).toBe(200);
    const itemsUpper = searchResUpper.body?.data?.patients ?? [];
    expect(itemsUpper.some((item: any) => item.firstName === firstName)).toBe(true);
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
      .get('/api/patients/invalid-id/balance')
      .set(authHeader);
    expect(res.status).toBe(400);
  });

  it('validates get patient params', async () => {
    const res = await request(app)
      .get('/api/patients/invalid-id')
      .set(authHeader);
    expect(res.status).toBe(400);
  });

  it('validates update patient params', async () => {
    const res = await request(app)
      .patch('/api/patients/invalid-id')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates delete patient params', async () => {
    const res = await request(app)
      .delete('/api/patients/invalid-id')
      .set(authHeader);
    expect(res.status).toBe(400);
  });

  it('validates get patient insurance params', async () => {
    const res = await request(app)
      .get('/api/patients/invalid-id/insurance')
      .set(authHeader);
    expect(res.status).toBe(400);
  });

  it('validates create patient insurance payload', async () => {
    const res = await request(app)
      .post('/api/patients/invalid-id/insurance')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates get patient insurance by id params', async () => {
    const res = await request(app)
      .get('/api/patients/invalid-id/insurance/invalid-id')
      .set(authHeader);
    expect(res.status).toBe(400);
  });

  it('validates update patient insurance params', async () => {
    const res = await request(app)
      .put('/api/patients/invalid-id/insurance/invalid-id')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates delete patient insurance params', async () => {
    const res = await request(app)
      .delete('/api/patients/invalid-id/insurance/invalid-id')
      .set(authHeader);
    expect(res.status).toBe(400);
  });

  it('validates get patient allergies params', async () => {
    const res = await request(app)
      .get('/api/patients/invalid-id/allergies')
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
      .get('/api/patients/invalid-id/allergies/invalid-id')
      .set(authHeader);
    expect(res.status).toBe(400);
  });

  it('validates update patient allergy params', async () => {
    const res = await request(app)
      .put('/api/patients/invalid-id/allergies/invalid-id')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates delete patient allergy params', async () => {
    const res = await request(app)
      .delete('/api/patients/invalid-id/allergies/invalid-id')
      .set(authHeader);
    expect(res.status).toBe(400);
  });

  it('gets patients sorted alphabetically by name', async () => {
    // Create patients with distinct first names (same LName: User)
    const suffix = uniqueToken('sort');
    const patA = await createPatientRecord(`A_${suffix}`);
    const patB = await createPatientRecord(`B_${suffix}`);
    const patC = await createPatientRecord(`C_${suffix}`);

    // Fetch sorted by name asc — scoped to this test's own patients via the shared
    // suffix, so the assertion doesn't depend on how many other patients exist in
    // the database (a fixed limit alone isn't reliable as the dataset grows).
    const resAsc = await request(app)
      .get(`/api/patients?sortBy=name&sortOrder=asc&limit=100&search=${suffix}`)
      .set(authHeader);
    expect(resAsc.status).toBe(200);
    const patientsAsc = resAsc.body?.data?.patients ?? [];
    
    // Find the positions of our created patients in the returned list
    const indexA_asc = patientsAsc.findIndex((p: any) => p.firstName === patA.FName);
    const indexB_asc = patientsAsc.findIndex((p: any) => p.firstName === patB.FName);
    const indexC_asc = patientsAsc.findIndex((p: any) => p.firstName === patC.FName);

    expect(indexA_asc).toBeGreaterThan(-1);
    expect(indexB_asc).toBeGreaterThan(-1);
    expect(indexC_asc).toBeGreaterThan(-1);

    // Verify Ascending order: patA < patB < patC
    expect(indexA_asc).toBeLessThan(indexB_asc);
    expect(indexB_asc).toBeLessThan(indexC_asc);

    // Fetch sorted by name desc — same scoping as above
    const resDesc = await request(app)
      .get(`/api/patients?sortBy=name&sortOrder=desc&limit=100&search=${suffix}`)
      .set(authHeader);
    expect(resDesc.status).toBe(200);
    const patientsDesc = resDesc.body?.data?.patients ?? [];

    const indexA_desc = patientsDesc.findIndex((p: any) => p.firstName === patA.FName);
    const indexB_desc = patientsDesc.findIndex((p: any) => p.firstName === patB.FName);
    const indexC_desc = patientsDesc.findIndex((p: any) => p.firstName === patC.FName);

    expect(indexA_desc).toBeGreaterThan(-1);
    expect(indexB_desc).toBeGreaterThan(-1);
    expect(indexC_desc).toBeGreaterThan(-1);

    // Verify Descending order: patC < patB < patA (in indices, meaning patC comes first)
    expect(indexC_desc).toBeLessThan(indexB_desc);
    expect(indexB_desc).toBeLessThan(indexA_desc);
  });
});
