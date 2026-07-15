import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { getAdminAuthHeader } from './helpers/auth';
import { prisma } from '../src/config/db';
import { getNextId } from '../src/utils/opendental-ids.util';

describe('Adjunctive Therapy Management APIs', () => {
  let authHeader: { Authorization: string };
  let testPatientId: bigint;

  beforeAll(async () => {
    authHeader = await getAdminAuthHeader();

    // 1. Resolve or create a patient
    const patient = await prisma.patient.findFirst();
    if (patient) {
      testPatientId = patient.PatNum;
    } else {
      const nextId = await getNextId('patient', 'PatNum');
      const newPat = await prisma.patient.create({
        data: { PatNum: nextId, LName: 'Doe', FName: 'AdjunctiveTest' },
      });
      testPatientId = newPat.PatNum;
    }

    // Clean up any existing adjunctive therapy preferences for the test patient
    await prisma.userodpref.deleteMany({
      where: {
        Fkey: testPatientId,
        FkeyType: 213, // ADJUNCTIVE_THERAPY_FKEYTYPE
      },
    });
  });

  it('GET /patients/:patientId/adjunctive-therapy - returns default empty structure when none exists', async () => {
    const res = await request(app)
      .get(`/api/patients/${testPatientId}/adjunctive-therapy`)
      .set(authHeader);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.products).toBeDefined();
    expect(res.body.data.labFees).toBeDefined();
    expect(res.body.data.notes).toBe('');
  });

  it('POST /patients/:patientId/adjunctive-therapy - preserves and retrieves nested configuration list', async () => {
    const payload = {
      products: ['OTC Fluoride', 'Mechanical Toothbrush'],
      labFees: ['Custom Nightguard Fee'],
      hygieneTools: ['Soft pick dental brushes'],
      fluoride: { selected: 'Prevident 5000', frequency: 'Once daily before bed' },
      toothbrush: { selected: 'Oral-B iO Series', type: 'Mechanical' },
      notes: 'Prescribed to treat generalized moderate sensitivity.',
    };

    // Save
    const saveRes = await request(app)
      .post(`/api/patients/${testPatientId}/adjunctive-therapy`)
      .set(authHeader)
      .send(payload);

    expect(saveRes.status).toBe(200);
    expect(saveRes.body.success).toBe(true);
    expect(saveRes.body.data.products).toContain('OTC Fluoride');
    expect(saveRes.body.data.notes).toBe('Prescribed to treat generalized moderate sensitivity.');

    // Fetch and check
    const getRes = await request(app)
      .get(`/api/patients/${testPatientId}/adjunctive-therapy`)
      .set(authHeader);

    expect(getRes.status).toBe(200);
    expect(getRes.body.success).toBe(true);
    expect(getRes.body.data.products).toContain('Mechanical Toothbrush');
    expect(getRes.body.data.fluoride.frequency).toBe('Once daily before bed');
  });

  it('POST /ai-conversation - submits prompts and receives clinical replies', async () => {
    const res = await request(app)
      .post('/api/ai-conversation')
      .set(authHeader)
      .send({ message: 'What is the recommendation for a patient withStage II Periodontitis?' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.reply).toContain('Stage II Periodontitis');
    expect(res.body.data.timestamp).toBeDefined();
  });
});
