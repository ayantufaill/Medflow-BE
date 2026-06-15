import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { getAdminAuthHeader } from './helpers/auth';
import { uniqueToken } from './helpers/unique';
import { createPatientRecord } from './helpers/fixtures';

describe('Prescriptions (RX) Custom Mappings', () => {
  let authHeader: { Authorization: string };

  beforeAll(async () => {
    authHeader = await getAdminAuthHeader();
  });

  it('creates and retrieves a prescription with custom fields duration, longTerm, and prints', async () => {
    const token = uniqueToken('rx');
    const patient = await createPatientRecord(token);

    // 1. Create a prescription with custom fields
    const createRes = await request(app)
      .post('/api/rx')
      .set(authHeader)
      .send({
        patientId: patient.PatNum.toString(),
        description: 'Amoxicillin 500mg',
        dose: '1 tablet',
        refills: '1',
        duration: '10 days',
        longTerm: 'No',
        prints: '2',
        notes: 'Take with food',
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.success).toBe(true);
    expect(createRes.body.data.prescription).toBeTruthy();
    expect(createRes.body.data.prescription.duration).toBe('10 days');
    expect(createRes.body.data.prescription.longTerm).toBe('No');
    expect(createRes.body.data.prescription.prints).toBe('2');

    const rxId = createRes.body.data.prescription.id;

    // 2. Retrieve the prescriptions for the patient
    const listRes = await request(app)
      .get(`/api/rx?patientId=${patient.PatNum.toString()}`)
      .set(authHeader);

    expect(listRes.status).toBe(200);
    expect(listRes.body.success).toBe(true);
    const prescriptions = listRes.body.data.prescriptions;
    expect(prescriptions.length).toBeGreaterThanOrEqual(1);

    const createdRx = prescriptions.find((rx: any) => rx.id === rxId);
    expect(createdRx).toBeTruthy();
    expect(createdRx.duration).toBe('10 days');
    expect(createdRx.longTerm).toBe('No');
    expect(createdRx.prints).toBe('2');
  });
});
