import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { getAdminAuthHeader } from './helpers/auth';
import { prisma } from '../src/config/db';
import { getNextId } from '../src/utils/opendental-ids.util';

describe('Fee Guide Details and Management APIs', () => {
  let authHeader: { Authorization: string };
  let testSchedNum: bigint;
  let testCodeNum1: bigint;
  let testCodeNum2: bigint;
  let testProvNum: bigint;

  beforeAll(async () => {
    authHeader = await getAdminAuthHeader();

    // 1. Create a test fee schedule in DB manually
    const nextSchedId = await getNextId('feesched', 'FeeSchedNum');
    const sched = await prisma.feesched.create({
      data: {
        FeeSchedNum: nextSchedId,
        Description: 'Detail Test Fee Sched',
        FeeSchedType: 0,
        IsHidden: 0,
        IsGlobal: 1,
      },
    });
    testSchedNum = sched.FeeSchedNum;

    // 2. Make sure we have some procedure codes
    const code1 = await prisma.procedurecode.findFirst({ where: { ProcCode: 'D0120' } });
    if (code1) {
      testCodeNum1 = code1.CodeNum;
    } else {
      const nextCodeId = await getNextId('procedurecode', 'CodeNum');
      const newCode = await prisma.procedurecode.create({
        data: {
          CodeNum: nextCodeId,
          ProcCode: 'D0120',
          Descript: 'Periodic Oral Evaluation',
        },
      });
      testCodeNum1 = newCode.CodeNum;
    }

    const code2 = await prisma.procedurecode.findFirst({ where: { ProcCode: 'D0140' } });
    if (code2) {
      testCodeNum2 = code2.CodeNum;
    } else {
      const nextCodeId = await getNextId('procedurecode', 'CodeNum');
      const newCode = await prisma.procedurecode.create({
        data: {
          CodeNum: nextCodeId,
          ProcCode: 'D0140',
          Descript: 'Limited Oral Evaluation',
        },
      });
      testCodeNum2 = newCode.CodeNum;
    }

    // 3. Create a provider for testing set-provider assignment
    const nextProvId = await getNextId('provider', 'ProvNum');
    const prov = await prisma.provider.create({
      data: {
        ProvNum: nextProvId,
        Abbr: 'TPROV',
        LName: 'TestProvider',
        FName: 'Detail',
      },
    });
    testProvNum = prov.ProvNum;
  });

  it('GET /guides/:id - retrieves fee schedule by ID', async () => {
    const res = await request(app)
      .get(`/api/fee-management/guides/${testSchedNum}`)
      .set(authHeader);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data._id).toBe(testSchedNum.toString());
    expect(res.body.data.description).toBe('Detail Test Fee Sched');
  });

  it('PUT /guides/:id/fees and GET /guides/:id/fees - bulk update and query fees', async () => {
    // 1. Bulk Update/Upsert two fees
    const updateRes = await request(app)
      .put(`/api/fee-management/guides/${testSchedNum}/fees`)
      .set(authHeader)
      .send({
        fees: [
          { procCode: 'D0120', amount: 45.50 },
          { procCode: 'D0140', amount: 75.00 },
        ],
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.success).toBe(true);
    expect(updateRes.body.data.count).toBe(2);

    // 2. Query fees with pagination
    const getRes = await request(app)
      .get(`/api/fee-management/guides/${testSchedNum}/fees`)
      .set(authHeader)
      .query({ search: 'D01', limit: 10 });

    expect(getRes.status).toBe(200);
    expect(getRes.body.success).toBe(true);
    expect(getRes.body.data.length).toBeGreaterThanOrEqual(2);

    const feeD0120 = getRes.body.data.find((f: any) => f.code === 'D0120');
    expect(feeD0120).toBeDefined();
    expect(feeD0120.fee).toBe(45.50);
  });

  it('POST /guides/:id/round - rounds fees to nearest specified increment', async () => {
    const roundRes = await request(app)
      .post(`/api/fee-management/guides/${testSchedNum}/round`)
      .set(authHeader)
      .send({ toNearest: 1 });

    expect(roundRes.status).toBe(200);
    expect(roundRes.body.success).toBe(true);
    expect(roundRes.body.data.updatedCount).toBeGreaterThanOrEqual(2);

    // D0120 was 45.50. Nearest $1 ceiling is 46.00
    const getRes = await request(app)
      .get(`/api/fee-management/guides/${testSchedNum}/fees`)
      .set(authHeader)
      .query({ search: 'D0120' });

    const feeD0120 = getRes.body.data.find((f: any) => f.code === 'D0120');
    expect(feeD0120.fee).toBe(46);
  });

  it('POST /guides/:id/set-provider - associates provider with fee guide', async () => {
    const setRes = await request(app)
      .post(`/api/fee-management/guides/${testSchedNum}/set-provider`)
      .set(authHeader)
      .send({ providerId: testProvNum.toString() });

    expect(setRes.status).toBe(200);
    expect(setRes.body.success).toBe(true);

    const updatedProv = await prisma.provider.findUnique({
      where: { ProvNum: testProvNum },
    });
    expect(updatedProv?.FeeSched).toBe(testSchedNum);
  });

  it('POST /guides/:id/upload - upload/import fees via array mapping', async () => {
    const uploadRes = await request(app)
      .post(`/api/fee-management/guides/${testSchedNum}/upload`)
      .set(authHeader)
      .send({
        fees: [
          { procCode: 'D0120', amount: 50.00 },
          { procCode: 'D0140', amount: 80.00 },
        ],
      });

    expect(uploadRes.status).toBe(200);
    expect(uploadRes.body.success).toBe(true);
    expect(uploadRes.body.message).toBe('Fees uploaded successfully');

    const getRes = await request(app)
      .get(`/api/fee-management/guides/${testSchedNum}/fees`)
      .set(authHeader)
      .query({ search: 'D0120' });

    const feeD0120 = getRes.body.data.find((f: any) => f.code === 'D0120');
    expect(feeD0120.fee).toBe(50.00);
  });
});
