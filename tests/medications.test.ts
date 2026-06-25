import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { getAdminAuthHeader } from './helpers/auth';
import { prisma } from '../src/config/db';
import { getNextId } from '../src/utils/opendental-ids.util';

describe('Medications API Search & Autocomplete Endpoints', () => {
  let authHeader: { Authorization: string };
  let testMedNum1: bigint;
  let testMedNum2: bigint;

  beforeAll(async () => {
    authHeader = await getAdminAuthHeader();

    // 1. Check/create test medications in database
    const med1 = await prisma.medication.findFirst({ where: { MedName: 'Amoxicillin 500mg' } });
    if (med1) {
      testMedNum1 = med1.MedicationNum;
    } else {
      const nextId = await getNextId('medication', 'MedicationNum');
      const newMed = await prisma.medication.create({
        data: {
          MedicationNum: nextId,
          MedName: 'Amoxicillin 500mg',
          IsHidden: 0,
        },
      });
      testMedNum1 = newMed.MedicationNum;
    }

    const med2 = await prisma.medication.findFirst({ where: { MedName: 'Ibuprofen 400mg' } });
    if (med2) {
      testMedNum2 = med2.MedicationNum;
    } else {
      const nextId = await getNextId('medication', 'MedicationNum');
      const newMed = await prisma.medication.create({
        data: {
          MedicationNum: nextId,
          MedName: 'Ibuprofen 400mg',
          IsHidden: 0,
        },
      });
      testMedNum2 = newMed.MedicationNum;
    }
  });

  it('GET /api/medications - returns all medications', async () => {
    const res = await request(app)
      .get('/api/medications')
      .set(authHeader);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);

    const amoxicillin = res.body.data.find((m: any) => m.name === 'Amoxicillin 500mg');
    expect(amoxicillin).toBeDefined();
    expect(amoxicillin._id).toBe(testMedNum1.toString());
  });

  it('GET /api/medications?search=... - returns filtered autocomplete options', async () => {
    const res = await request(app)
      .get('/api/medications')
      .query({ search: 'Amox' })
      .set(authHeader);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.some((m: any) => m.name.includes('Amox'))).toBe(true);
    expect(res.body.data.some((m: any) => m.name.includes('Ibuprofen'))).toBe(false);
  });

  it('GET /api/medications/:id - retrieves a medication details by ID', async () => {
    const res = await request(app)
      .get(`/api/medications/${testMedNum1}`)
      .set(authHeader);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Amoxicillin 500mg');
  });

  it('GET /api/medications/:id - retrieves a medication details by name', async () => {
    const res = await request(app)
      .get(`/api/medications/Ibuprofen 400mg`)
      .set(authHeader);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data._id).toBe(testMedNum2.toString());
  });

  it('GET /api/medications/:id - returns 404 for unknown medication name/id', async () => {
    const res = await request(app)
      .get('/api/medications/UnknownMedicationXYZ')
      .set(authHeader);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  describe('POST /api/medications - Create Medication', () => {
    it('creates a new medication successfully', async () => {
      const uniqueName = `TestDrug-${Date.now()}`;
      const res = await request(app)
        .post('/api/medications')
        .set(authHeader)
        .send({
          name: uniqueName,
          notes: 'Test notes',
          rxCui: 99999,
          isActive: true
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe(uniqueName);
      expect(res.body.data.notes).toBe('Test notes');
      expect(res.body.data.rxCui).toBe('99999');
      expect(res.body.data.isActive).toBe(true);
    });

    it('returns 409 conflict when creating a duplicate medication', async () => {
      const res = await request(app)
        .post('/api/medications')
        .set(authHeader)
        .send({
          name: 'Amoxicillin 500mg'
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 validation error when name is missing', async () => {
      const res = await request(app)
        .post('/api/medications')
        .set(authHeader)
        .send({
          notes: 'No name'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PATCH /api/medications/:id - Update Medication', () => {
    it('updates medication name and notes successfully', async () => {
      const updatedName = `Updated-Amox-${Date.now()}`;
      const res = await request(app)
        .patch(`/api/medications/${testMedNum1}`)
        .set(authHeader)
        .send({
          name: updatedName,
          notes: 'Updated description'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe(updatedName);
      expect(res.body.data.notes).toBe('Updated description');
    });

    it('returns 404 for updating unknown medication', async () => {
      const res = await request(app)
        .patch('/api/medications/9999999999')
        .set(authHeader)
        .send({
          notes: 'Should fail'
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});
