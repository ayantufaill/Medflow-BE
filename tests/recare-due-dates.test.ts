import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/db';
import { recareService, calculateDueDate } from '../src/services/recare.service';
import { getAdminAuthHeader } from './helpers/auth';
import { uniqueToken } from './helpers/unique';
import { createPatientRecord } from './helpers/fixtures';
import { getNextId } from '../src/utils/opendental-ids.util';

describe('Recare (Recall) Due Dates - Per-CDT Oryx Logic', () => {
  let authHeader: { Authorization: string };
  let testPatient: any;
  const createdProcNums: bigint[] = [];

  beforeAll(async () => {
    authHeader = await getAdminAuthHeader();
    const token = uniqueToken('recare');
    testPatient = await createPatientRecord(token);
  });

  afterAll(async () => {
    if (createdProcNums.length > 0) {
      await prisma.procedurelog.deleteMany({
        where: { ProcNum: { in: createdProcNums } },
      });
    }
    if (testPatient?.PatNum) {
      await prisma.recall.deleteMany({
        where: { PatNum: testPatient.PatNum },
      });
      await prisma.patient.deleteMany({
        where: { PatNum: testPatient.PatNum },
      });
    }
  });

  describe('calculateDueDate Unit Tests', () => {
    it('calculates 6 months + 1 day offset correctly (Oryx Prophy rule: 2022-07-14 -> 2023-01-15)', () => {
      const result = calculateDueDate('2022-07-14', 6, 1);
      expect(result).toBe('2023-01-15');
    });

    it('calculates 6 months + 0 day offset correctly (Periodic exam: 2022-07-14 -> 2023-01-14)', () => {
      const result = calculateDueDate('2022-07-14', 6, 0);
      expect(result).toBe('2023-01-14');
    });

    it('calculates 12 months interval (Bitewings: 2022-07-14 -> 2023-07-14)', () => {
      const result = calculateDueDate('2022-07-14', 12, 0);
      expect(result).toBe('2023-07-14');
    });

    it('calculates 3 months interval (Perio: 2022-07-14 -> 2022-10-14)', () => {
      const result = calculateDueDate('2022-07-14', 3, 0);
      expect(result).toBe('2022-10-14');
    });

    it('handles month-end clamping cleanly (e.g. Aug 31 + 6 months -> Feb 28)', () => {
      const result = calculateDueDate('2022-08-31', 6, 0);
      expect(result).toBe('2023-02-28');
    });
  });

  describe('RecareService Database Tests', () => {
    it('returns isNeverCompleted: true when patient has no completed history for CDT', async () => {
      const res = await recareService.getRecareDueDate(testPatient.PatNum, 'D1110');

      expect(res.code).toBe('D1110');
      expect(res.isNeverCompleted).toBe(true);
      expect(res.lastCompletedDate).toBeNull();
      expect(res.dueDate).toBeNull();
      expect(res.intervalMonths).toBe(6);
      expect(res.offsetDays).toBe(1);
      expect(res.recallTypeName).toBe('Adult Prophy');
    });

    it('calculates due date from completed procedurelog with +1 day offset', async () => {
      const d1110Code = await prisma.procedurecode.findFirst({
        where: { ProcCode: 'D1110' },
      });
      expect(d1110Code).toBeDefined();

      const procNum = await getNextId('procedurelog', 'ProcNum');
      createdProcNums.push(procNum);

      await prisma.procedurelog.create({
        data: {
          ProcNum: procNum,
          PatNum: testPatient.PatNum,
          CodeNum: d1110Code!.CodeNum,
          ProcDate: new Date('2022-07-14T00:00:00.000Z'),
          ProcStatus: 2, // 2 = Completed
        },
      });

      const res = await recareService.getRecareDueDate(testPatient.PatNum, 'D1110');
      expect(res.isNeverCompleted).toBe(false);
      expect(res.lastCompletedDate).toBe('2022-07-14');
      expect(res.dueDate).toBe('2023-01-15');
      expect(res.isOverdue).toBe(true);
      expect(res.intervalMonths).toBe(6);
      expect(res.offsetDays).toBe(1);
    });

    it('triggers Periodic Exam (D0120) recare from Comp Exam (D0150) completion', async () => {
      const d0150Code = await prisma.procedurecode.findFirst({
        where: { ProcCode: 'D0150' },
      });
      expect(d0150Code).toBeDefined();

      const procNum = await getNextId('procedurelog', 'ProcNum');
      createdProcNums.push(procNum);

      await prisma.procedurelog.create({
        data: {
          ProcNum: procNum,
          PatNum: testPatient.PatNum,
          CodeNum: d0150Code!.CodeNum,
          ProcDate: new Date('2023-05-10T00:00:00.000Z'),
          ProcStatus: 2, // Completed
        },
      });

      // Checking D0120 should pick up D0150 since D0150 is a trigger for the Periodic Exam recall type
      const res = await recareService.getRecareDueDate(testPatient.PatNum, 'D0120');
      expect(res.isNeverCompleted).toBe(false);
      expect(res.lastCompletedDate).toBe('2023-05-10');
      expect(res.dueDate).toBe('2023-11-10');
      expect(res.intervalMonths).toBe(6);
      expect(res.offsetDays).toBe(0);
      expect(res.recallTypeName).toBe('Periodic Exam');
    });

    it('calculates multiple recare due dates in calculateRecareDueDates', async () => {
      const result = await recareService.calculateRecareDueDates(testPatient.PatNum, ['D1110', 'D0120', 'D0274']);

      expect(result.patientId).toBe(testPatient.PatNum.toString());
      expect(result.recareDueDates['D1110'].dueDate).toBe('2023-01-15');
      expect(result.recareDueDates['D0120'].dueDate).toBe('2023-11-10');
      expect(result.recareDueDates['D0274'].isNeverCompleted).toBe(true);
    });
  });

  describe('API Route GET /api/patients/:patientId/recare-due-dates', () => {
    it('returns calculated recare due dates over HTTP with authentication', async () => {
      const res = await request(app)
        .get(`/api/patients/${testPatient.PatNum}/recare-due-dates?procedures=D1110,D0120`)
        .set(authHeader);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe('success');
      expect(res.body.data.patientId).toBe(testPatient.PatNum.toString());

      const d1110 = res.body.data.recareDueDates['D1110'];
      expect(d1110).toBeDefined();
      expect(d1110.lastCompletedDate).toBe('2022-07-14');
      expect(d1110.dueDate).toBe('2023-01-15');
      expect(d1110.offsetDays).toBe(1);
      expect(d1110.intervalMonths).toBe(6);
      expect(d1110.isOverdue).toBe(true);

      const d0120 = res.body.data.recareDueDates['D0120'];
      expect(d0120).toBeDefined();
      expect(d0120.lastCompletedDate).toBe('2023-05-10');
      expect(d0120.dueDate).toBe('2023-11-10');
    });

    it('returns all active recare procedures if procedures query is omitted', async () => {
      const res = await request(app)
        .get(`/api/patients/${testPatient.PatNum}/recare-due-dates`)
        .set(authHeader);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.recareDueDates['D1110']).toBeDefined();
      expect(res.body.data.recareDueDates['D0120']).toBeDefined();
      expect(res.body.data.recareDueDates['D0274']).toBeDefined();
    });

    it('returns 401 for unauthenticated request', async () => {
      const res = await request(app)
        .get(`/api/patients/${testPatient.PatNum}/recare-due-dates`);

      expect(res.status).toBe(401);
    });
  });
});
