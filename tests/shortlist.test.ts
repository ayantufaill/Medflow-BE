import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { getAdminAuthHeader } from './helpers/auth';
import { uniqueToken } from './helpers/unique';
import { createPatientRecord, createProviderRecord } from './helpers/fixtures';

describe('Shortlist Endpoints', () => {
  let authHeader: { Authorization: string };

  beforeAll(async () => {
    authHeader = await getAdminAuthHeader();
  });

  it('gets shortlist items', async () => {
    const res = await request(app)
      .get('/api/shortlist')
      .set(authHeader);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('creates, updates, and deletes a shortlist item', async () => {
    const token = uniqueToken('shortlist');
    const patient = await createPatientRecord(token);
    const provider = await createProviderRecord(token);

    // 1. Create shortlist item
    const createRes = await request(app)
      .post('/api/shortlist')
      .set(authHeader)
      .send({
        patientId: patient.PatNum.toString(),
        providerId: provider.ProvNum.toString(),
        durationMins: 45,
        preferredDay: 'Monday',
        preferredTime: 'Morning',
        notes: 'Initial test note',
        procedures: ['D1110']
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.status).toBe('success');
    const createdItem = createRes.body.data;
    expect(createdItem.Notes).toBe('Initial test note');
    expect(createdItem.ShortlistNum).toBeDefined();

    const itemId = createdItem.ShortlistNum;

    // 2. Update shortlist item
    const updateRes = await request(app)
      .put(`/api/shortlist/${itemId}`)
      .set(authHeader)
      .send({
        patientId: patient.PatNum.toString(),
        providerId: provider.ProvNum.toString(),
        durationMins: 60,
        preferredDay: 'Tuesday',
        preferredTime: 'Afternoon',
        notes: 'Updated test note',
        procedures: ['D1110', 'D1208']
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.status).toBe('success');
    const updatedItem = updateRes.body.data;
    expect(updatedItem.Notes).toBe('Updated test note');
    expect(updatedItem.DurationMins).toBe(60);

    // 3. Delete shortlist item
    const deleteRes = await request(app)
      .delete(`/api/shortlist/${itemId}`)
      .set(authHeader);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.status).toBe('success');
  });

  it('returns 404 when updating non-existent item', async () => {
    const res = await request(app)
      .put('/api/shortlist/99999999')
      .set(authHeader)
      .send({
        patientId: '1',
        durationMins: 30
      });
    expect(res.status).toBe(404);
  });
});
