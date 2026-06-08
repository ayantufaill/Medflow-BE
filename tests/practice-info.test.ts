import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { getAdminAuthHeader } from './helpers/auth';

describe('Practice Info', () => {
  let authHeader: { Authorization: string };
  let practiceId: string | undefined;

  beforeAll(async () => {
    authHeader = await getAdminAuthHeader();

    const currentRes = await request(app)
      .get('/api/practice-info/current')
      .set(authHeader);
    
    if (currentRes.status === 200 && currentRes.body.data.practiceInfo) {
      practiceId = currentRes.body.data.practiceInfo._id;
    } else {
      const createRes = await request(app)
        .post('/api/practice-info')
        .set(authHeader)
        .send({
          practiceName: 'Test Practice Clinic',
          phone: '123-456-7890',
          email: 'test@practice.com',
          address: {
            line1: '123 Main St',
            city: 'Seattle',
            state: 'WA',
            postalCode: '98101',
            country: 'United States',
          },
        });
      if (createRes.status === 201) {
        practiceId = createRes.body.data.practiceInfo._id;
      } else {
        console.error('Failed to create practice clinic for testing:', createRes.body);
      }
    }
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
      .get('/api/practice-info/abc')
      .set(authHeader);
    expect(res.status).toBe(400);
  });

  it('validates update practice info payload', async () => {
    const res = await request(app)
      .put('/api/practice-info/abc')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates delete practice info params', async () => {
    const res = await request(app)
      .delete('/api/practice-info/abc')
      .set(authHeader);
    expect(res.status).toBe(400);
  });

  it('updates practice billing configuration', async () => {
    expect(practiceId).toBeDefined();

    const patchRes = await request(app)
      .patch(`/api/practice-info/${practiceId}/billing-config`)
      .set(authHeader)
      .send({
        billingOutOfNetwork: 'yes',
        billingAssignmentType: 'non-assignment',
        billingProvider: 'treating',
      });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.practiceInfo.billingOutOfNetwork).toBe('yes');
    expect(patchRes.body.data.practiceInfo.billingAssignmentType).toBe('non-assignment');
    expect(patchRes.body.data.practiceInfo.billingProvider).toBe('treating');
  });

  it('schedules and retrieves installation support appointments', async () => {
    const scheduleRes = await request(app)
      .post('/api/practice-info/support-appointments')
      .set(authHeader)
      .send({
        name: 'Jane Doe',
        email: 'jane.doe@example.com',
        date: '2026-06-15',
        timeSlot: '11:00 AM - 12:00 PM',
        note: 'Setup macOS client',
        practiceInfoId: practiceId,
      });
    expect(scheduleRes.status).toBe(201);
    expect(scheduleRes.body.success).toBe(true);
    expect(scheduleRes.body.data.name).toBe('Jane Doe');
    expect(scheduleRes.body.data.email).toBe('jane.doe@example.com');
    expect(scheduleRes.body.data.date).toBe('2026-06-15');

    const getRes = await request(app)
      .get('/api/practice-info/support-appointments')
      .set(authHeader)
      .query({ practiceInfoId: practiceId });
    expect(getRes.status).toBe(200);
    expect(getRes.body.success).toBe(true);
    expect(Array.isArray(getRes.body.data)).toBe(true);
    const found = getRes.body.data.find((appt: any) => appt.name === 'Jane Doe');
    expect(found).toBeDefined();
    expect(found.email).toBe('jane.doe@example.com');
  });

  it('simulates move patient data', async () => {
    const moveRes = await request(app)
      .post('/api/practice-info/move-patient')
      .set(authHeader)
      .send({
        fromPatient: 'Patient A',
        toPatient: 'Patient B',
        checklist: {
          medicalHistory: true,
          notes: true,
          insurance: false,
          billing: false,
          treatmentPlan: false,
          exam: false,
        },
      });
    expect(moveRes.status).toBe(200);
    expect(moveRes.body.success).toBe(true);
    expect(moveRes.body.data.fromPatient.name).toBe('Patient A');
    expect(moveRes.body.data.toPatient.name).toBe('Patient B');
    expect(moveRes.body.data.movedItems).toContain('medicalHistory');
    expect(moveRes.body.data.movedItems).toContain('notes');
  });

  it('simulates move provider future data', async () => {
    const moveRes = await request(app)
      .post('/api/practice-info/move-provider')
      .set(authHeader)
      .send({
        fromProvider: 'Dr. John Doe',
        toProvider: 'Dr. Jane Smith',
      });
    expect(moveRes.status).toBe(200);
    expect(moveRes.body.success).toBe(true);
    expect(moveRes.body.data.fromProvider.name).toBe('Dr. John Doe');
    expect(moveRes.body.data.toProvider.name).toBe('Dr. Jane Smith');
  });
});

