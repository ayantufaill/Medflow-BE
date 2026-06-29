import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { getAdminAuthHeader } from './helpers/auth';
import { prisma } from '../src/config/db';
import { getNextId } from '../src/utils/opendental-ids.util';

/**
 * Integration tests for clinical-exam upsert across the 3 core table-backed exam types:
 *   - periodontal
 *   - teeth-structure (maps to examtoothstructure table)
 *   - radiographic
 *
 * Also covers:
 *   - Pocket-depth round-trip (3.S.2)
 *   - History endpoint with enriched response (3.S.3)
 */
describe('Clinical Exam Upsert — periodontal, teeth-structure, radiographic', () => {
  let authHeader: { Authorization: string };
  let testPatientId: bigint;
  let testProviderId: bigint;

  // One appointment per exam type to avoid AptNum unique constraint clashes
  let aptPeriodontal: bigint;
  let aptTeethStructure: bigint;
  let aptRadiographic: bigint;
  // Extra appointments for history tests (second exam per type)
  let aptPeriodontal2: bigint;
  let aptTeethStructure2: bigint;
  let aptRadiographic2: bigint;

  beforeAll(async () => {
    authHeader = await getAdminAuthHeader();

    // Resolve or create a patient
    const patient = await prisma.patient.findFirst();
    if (patient) {
      testPatientId = patient.PatNum;
    } else {
      const nextId = await getNextId('patient', 'PatNum');
      const newPat = await prisma.patient.create({
        data: { PatNum: nextId, LName: 'Doe', FName: 'ExamUpsertTest' },
      });
      testPatientId = newPat.PatNum;
    }

    // Resolve or create a provider
    const provider = await prisma.provider.findFirst();
    if (provider) {
      testProviderId = provider.ProvNum;
    } else {
      const nextId = await getNextId('provider', 'ProvNum');
      const newProv = await prisma.provider.create({
        data: { ProvNum: nextId, Abbr: 'UPROV', LName: 'Upsert', FName: 'Test' },
      });
      testProviderId = newProv.ProvNum;
    }

    // Create 6 separate appointments (one per exam type × 2 for history)
    const createApt = async () => {
      const nextAptId = await getNextId('appointment', 'AptNum');
      const apt = await prisma.appointment.create({
        data: {
          AptNum: nextAptId,
          PatNum: testPatientId,
          ProvNum: testProviderId,
          AptDateTime: new Date(),
          AptStatus: 1,
        },
      });
      return apt.AptNum;
    };

    aptPeriodontal = await createApt();
    aptTeethStructure = await createApt();
    aptRadiographic = await createApt();
    aptPeriodontal2 = await createApt();
    aptTeethStructure2 = await createApt();
    aptRadiographic2 = await createApt();
  });

  // ── Exam-type specific payloads ────────────────────────────────────────────

  const periodontalPayload = {
    pocketDepths: {
      '1': { buccal: [3, 2, 3], lingual: [2, 3, 2] },
      '2': { buccal: [4, 3, 4], lingual: [3, 3, 3] },
      '14': { buccal: [5, 4, 5], lingual: [4, 4, 3] },
      '19': { buccal: [3, 3, 3], lingual: [2, 2, 2] },
      '30': { buccal: [6, 5, 6], lingual: [4, 5, 4] },
    },
    bleedingOnProbing: {
      '1': { buccal: [false, false, true], lingual: [false, false, false] },
      '2': { buccal: [true, false, true], lingual: [false, true, false] },
      '30': { buccal: [true, true, true], lingual: [true, true, false] },
    },
    recession: {
      '1': { buccal: [0, 0, 1], lingual: [0, 0, 0] },
      '14': { buccal: [1, 2, 1], lingual: [0, 1, 0] },
    },
    furcation: { '3': 1, '14': 2, '19': 0 },
    mobility: { '8': 1, '24': 0, '30': 2 },
    notes: 'Generalized moderate periodontitis with localized severe involvement #30',
  };

  const teethStructurePayload = {
    teeth: {
      '3': { condition: 'caries', surfaces: ['MO'], severity: 'moderate', notes: 'Class II MO caries' },
      '14': { condition: 'fracture', surfaces: ['B'], severity: 'mild', notes: 'Craze line on buccal' },
      '19': { condition: 'restoration', surfaces: ['MOD'], material: 'composite', status: 'intact' },
      '30': { condition: 'caries', surfaces: ['DO'], severity: 'severe', notes: 'Recurrent caries under existing restoration' },
    },
    generalNotes: 'Generalized attrition on anterior teeth',
    wearPattern: 'Moderate bruxism-related wear',
  };

  const radiographicPayload = {
    findings: [
      {
        region: 'maxillary right',
        toothNumbers: [2, 3, 4],
        finding: 'Periapical radiolucency',
        severity: 'moderate',
        notes: '3mm radiolucency at apex of #3',
      },
      {
        region: 'mandibular left',
        toothNumbers: [18, 19],
        finding: 'Bone loss',
        severity: 'mild',
        notes: 'Horizontal bone loss between #18 and #19',
      },
    ],
    boneLoss: { 'maxillary right': 'mild', 'mandibular left': 'moderate' },
    radiographType: 'full mouth series',
    notes: 'Recommend periapical radiograph for #3 follow-up',
  };

  const payloadMap: Record<string, { aptId: () => bigint; examData: any; updatedExamData: any; aptId2: () => bigint }> = {
    periodontal: {
      aptId: () => aptPeriodontal,
      aptId2: () => aptPeriodontal2,
      examData: periodontalPayload,
      updatedExamData: { ...periodontalPayload, notes: 'Updated: treatment plan discussed with patient' },
    },
    'teeth-structure': {
      aptId: () => aptTeethStructure,
      aptId2: () => aptTeethStructure2,
      examData: teethStructurePayload,
      updatedExamData: { ...teethStructurePayload, generalNotes: 'Updated: scheduled restoration for #30' },
    },
    radiographic: {
      aptId: () => aptRadiographic,
      aptId2: () => aptRadiographic2,
      examData: radiographicPayload,
      updatedExamData: { ...radiographicPayload, notes: 'Updated: periapical taken, no change' },
    },
  };

  // ── 3.S.1 — Upsert tests for each exam type ───────────────────────────────

  const runUpsertTests = (examType: string) => {
    const config = payloadMap[examType];

    describe(`Upsert: ${examType}`, () => {
      it(`PUT /clinical-exams/${examType}/:aptId — creates new exam`, async () => {
        const res = await request(app)
          .put(`/api/clinical-exams/${examType}/${config.aptId()}`)
          .set(authHeader)
          .send({
            patientId: testPatientId.toString(),
            providerId: testProviderId.toString(),
            examData: config.examData,
          });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.exam).toBeDefined();
        expect(res.body.data.exam.examType).toBe(examType);
        expect(res.body.data.exam.isSigned).toBe(false);
        expect(res.body.data.exam.examData).toBeDefined();
      });

      it(`GET /clinical-exams/${examType}/:aptId — reads back created exam`, async () => {
        const res = await request(app)
          .get(`/api/clinical-exams/${examType}/${config.aptId()}`)
          .set(authHeader);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.exam).toBeDefined();
        expect(res.body.data.exam.examType).toBe(examType);
        expect(res.body.data.exam.patientId).toBe(testPatientId.toString());
        expect(res.body.data.exam.examData).toEqual(config.examData);
      });

      it(`PUT /clinical-exams/${examType}/:aptId — updates existing exam`, async () => {
        const res = await request(app)
          .put(`/api/clinical-exams/${examType}/${config.aptId()}`)
          .set(authHeader)
          .send({
            patientId: testPatientId.toString(),
            providerId: testProviderId.toString(),
            examData: config.updatedExamData,
          });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.exam.examData).toBeDefined();
      });

      it(`GET /clinical-exams/${examType}/:aptId — reads back updated exam`, async () => {
        const res = await request(app)
          .get(`/api/clinical-exams/${examType}/${config.aptId()}`)
          .set(authHeader);

        expect(res.status).toBe(200);
        expect(res.body.data.exam.examData).toEqual(config.updatedExamData);
      });

      it(`POST /clinical-exams/${examType}/:aptId/sign — signs and locks exam`, async () => {
        const signRes = await request(app)
          .post(`/api/clinical-exams/${examType}/${config.aptId()}/sign`)
          .set(authHeader);

        expect(signRes.status).toBe(200);
        expect(signRes.body.success).toBe(true);
        expect(signRes.body.data.exam.isSigned).toBe(true);
        expect(signRes.body.data.exam.signedBy).toBeDefined();
        expect(signRes.body.data.exam.signedAt).toBeDefined();
      });

      it(`PUT /clinical-exams/${examType}/:aptId — rejects edit after signing`, async () => {
        const editRes = await request(app)
          .put(`/api/clinical-exams/${examType}/${config.aptId()}`)
          .set(authHeader)
          .send({
            patientId: testPatientId.toString(),
            providerId: testProviderId.toString(),
            examData: { findings: 'Trying to edit signed exam' },
          });

        expect(editRes.status).toBe(403);
        expect(editRes.body.success).toBe(false);
      });
    });
  };

  runUpsertTests('periodontal');
  runUpsertTests('teeth-structure');
  runUpsertTests('radiographic');

  // ── 3.S.2 — Periodontal pocket-depth round-trip ────────────────────────────

  describe('Pocket-depth round-trip (periodontal)', () => {
    // Build a realistic full-mouth 32-tooth × 6-surface pocket depth object
    const fullMouthPocketDepths: Record<string, { buccal: number[]; lingual: number[] }> = {};
    for (let tooth = 1; tooth <= 32; tooth++) {
      fullMouthPocketDepths[tooth.toString()] = {
        buccal: [
          Math.floor(Math.random() * 5) + 1,
          Math.floor(Math.random() * 5) + 1,
          Math.floor(Math.random() * 5) + 1,
        ],
        lingual: [
          Math.floor(Math.random() * 5) + 1,
          Math.floor(Math.random() * 5) + 1,
          Math.floor(Math.random() * 5) + 1,
        ],
      };
    }

    const fullMouthBleeding: Record<string, { buccal: boolean[]; lingual: boolean[] }> = {};
    for (let tooth = 1; tooth <= 32; tooth++) {
      fullMouthBleeding[tooth.toString()] = {
        buccal: [Math.random() > 0.5, Math.random() > 0.5, Math.random() > 0.5],
        lingual: [Math.random() > 0.5, Math.random() > 0.5, Math.random() > 0.5],
      };
    }

    const fullMouthRecession: Record<string, { buccal: number[]; lingual: number[] }> = {};
    for (let tooth = 1; tooth <= 32; tooth++) {
      fullMouthRecession[tooth.toString()] = {
        buccal: [
          Math.floor(Math.random() * 3),
          Math.floor(Math.random() * 3),
          Math.floor(Math.random() * 3),
        ],
        lingual: [
          Math.floor(Math.random() * 3),
          Math.floor(Math.random() * 3),
          Math.floor(Math.random() * 3),
        ],
      };
    }

    const fullPeriodontalData = {
      pocketDepths: fullMouthPocketDepths,
      bleedingOnProbing: fullMouthBleeding,
      recession: fullMouthRecession,
      furcation: { '3': 1, '14': 2, '19': 0, '30': 3 },
      mobility: { '8': 1, '9': 0, '24': 2, '25': 1 },
      mugivalMargin: {
        '1': { buccal: [1, 0, 1], lingual: [0, 0, 0] },
        '30': { buccal: [2, 1, 2], lingual: [1, 1, 0] },
      },
      notes: 'Full mouth periodontal charting — generalized moderate with localized severe periodontitis',
    };

    it('round-trips a full 32-tooth pocket depth payload without data loss', async () => {
      // Use aptPeriodontal2 (the second periodontal appointment, not yet used)
      const res = await request(app)
        .put(`/api/clinical-exams/periodontal/${aptPeriodontal2}`)
        .set(authHeader)
        .send({
          patientId: testPatientId.toString(),
          providerId: testProviderId.toString(),
          examData: fullPeriodontalData,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Read back
      const getRes = await request(app)
        .get(`/api/clinical-exams/periodontal/${aptPeriodontal2}`)
        .set(authHeader);

      expect(getRes.status).toBe(200);
      const returnedData = getRes.body.data.exam.examData;

      // Deep equality check — every pocket depth value must match exactly
      expect(returnedData.pocketDepths).toEqual(fullPeriodontalData.pocketDepths);
      expect(returnedData.bleedingOnProbing).toEqual(fullPeriodontalData.bleedingOnProbing);
      expect(returnedData.recession).toEqual(fullPeriodontalData.recession);
      expect(returnedData.furcation).toEqual(fullPeriodontalData.furcation);
      expect(returnedData.mobility).toEqual(fullPeriodontalData.mobility);
      expect(returnedData.mugivalMargin).toEqual(fullPeriodontalData.mugivalMargin);
      expect(returnedData.notes).toBe(fullPeriodontalData.notes);

      // Full object equality
      expect(returnedData).toEqual(fullPeriodontalData);
    });

    it('serialized JSON size is within expected bounds', () => {
      const jsonStr = JSON.stringify(fullPeriodontalData);
      // A full 32-tooth charting should be well under 65KB (MySQL TEXT limit)
      // but we verify it's reasonable
      expect(jsonStr.length).toBeGreaterThan(1000); // non-trivial payload
      expect(jsonStr.length).toBeLessThan(65535);    // within TEXT limit
    });
  });

  // ── 3.S.3 — History endpoint tests ─────────────────────────────────────────

  describe('History endpoint — GET /history/:examType/patient/:patientId', () => {
    // Create a second exam for each type (using aptId2 appointments)
    beforeAll(async () => {
      for (const examType of ['teeth-structure', 'radiographic'] as const) {
        const config = payloadMap[examType];
        await request(app)
          .put(`/api/clinical-exams/${examType}/${config.aptId2()}`)
          .set(authHeader)
          .send({
            patientId: testPatientId.toString(),
            providerId: testProviderId.toString(),
            examData: config.examData,
          });
      }
      // periodontal aptId2 was already used in the pocket-depth round-trip test above
    });

    const testHistoryForType = (examType: string) => {
      it(`returns sorted history with appointmentId for ${examType}`, async () => {
        const res = await request(app)
          .get(`/api/clinical-exams/history/${examType}/patient/${testPatientId}`)
          .set(authHeader);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data.dates)).toBe(true);
        expect(res.body.data.dates.length).toBeGreaterThanOrEqual(2);

        // Each entry should have date and appointmentId
        for (const entry of res.body.data.dates) {
          expect(entry).toHaveProperty('date');
          expect(entry).toHaveProperty('appointmentId');
          expect(typeof entry.appointmentId).toBe('string');
          expect(entry.appointmentId.length).toBeGreaterThan(0);
        }

        // Dates should be in ascending order
        const timestamps = res.body.data.dates.map((e: any) => new Date(e.date).getTime());
        for (let i = 1; i < timestamps.length; i++) {
          expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]);
        }
      });
    };

    testHistoryForType('periodontal');
    testHistoryForType('teeth-structure');
    testHistoryForType('radiographic');

    it('returns validation error for invalid examType', async () => {
      const res = await request(app)
        .get(`/api/clinical-exams/history/invalid-type/patient/${testPatientId}`)
        .set(authHeader);

      expect(res.status).toBe(400);
    });

    it('returns validation error for invalid patientId', async () => {
      const res = await request(app)
        .get(`/api/clinical-exams/history/periodontal/patient/abc`)
        .set(authHeader);

      expect(res.status).toBe(400);
    });
  });
});
