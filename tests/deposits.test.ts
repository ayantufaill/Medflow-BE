import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/db';
import { getAdminAuthHeader } from './helpers/auth';
import { uniqueToken } from './helpers/unique';
import { createPatientRecord } from './helpers/fixtures';

const nextUniqueId = (() => {
  let counter = 0n;
  const pidShard = BigInt(process.pid % 1000);
  return () => {
    counter = (counter + 1n) % 1000n;
    const nowSeconds = BigInt(Math.floor(Date.now() / 1000));
    return nowSeconds * 1_000_000n + pidShard * 1_000n + counter;
  };
})();

describe('Deposits & Deposit Slips API', () => {
  let authHeader: { Authorization: string };

  beforeAll(async () => {
    authHeader = await getAdminAuthHeader();
  });

  describe('GET /api/deposits/slips', () => {
    it('returns a paginated list of deposit slips', async () => {
      const res = await request(app)
        .get('/api/deposits/slips')
        .set(authHeader);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data.slips)).toBe(true);
      expect(res.body.data.pagination).toBeDefined();
    });
  });

  describe('GET /api/deposits/slips/un-deposited', () => {
    it('returns lists of un-deposited patient and insurance payments', async () => {
      const res = await request(app)
        .get('/api/deposits/slips/un-deposited')
        .set(authHeader);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data.patientPayments)).toBe(true);
      expect(Array.isArray(res.body.data.insurancePayments)).toBe(true);
    });
  });

  describe('POST /api/deposits/slips', () => {
    it('creates a deposit slip and associates selected patient/insurance payments', async () => {
      const token = uniqueToken('dep');
      
      // 1. Create a patient
      const patient = await createPatientRecord(token);
      
      // 2. Create a patient payment (with DepositNum = 0 or null)
      const payNum = nextUniqueId();
      const patientPayment = await prisma.payment.create({
        data: {
          PayNum: payNum,
          PatNum: patient.PatNum,
          PayDate: new Date(),
          PayAmt: 150.0,
          PayNote: JSON.stringify({
            notes: `Patient payment for deposit test ${token}`,
            method: 'check',
          }),
          DepositNum: null,
        },
      });

      // 3. Create an insurance payment (claimpayment) (with DepositNum = 0 or null)
      const claimPaymentNum = nextUniqueId();
      const insurancePayment = await prisma.claimpayment.create({
        data: {
          ClaimPaymentNum: claimPaymentNum,
          CheckAmt: 350.0,
          CheckDate: new Date(),
          CheckNum: `CHK-${token}`.slice(0, 20),
          CarrierName: `Carrier ${token}`,
          DepositNum: null,
        },
      });

      // Verify they are in un-deposited list
      const unDepositedBefore = await request(app)
        .get('/api/deposits/slips/un-deposited')
        .set(authHeader);
      
      expect(unDepositedBefore.status).toBe(200);
      const patPaysBefore = unDepositedBefore.body.data.patientPayments.map((p: any) => p.id);
      const insPaysBefore = unDepositedBefore.body.data.insurancePayments.map((p: any) => p.id);
      
      expect(patPaysBefore).toContain(patientPayment.PayNum.toString());
      expect(insPaysBefore).toContain(insurancePayment.ClaimPaymentNum.toString());

      // 4. Create the deposit slip
      const slipData = {
        bankAccountInfo: 'Test Savings Account 101',
        memo: `Batch deposit ${token}`,
        date: new Date().toISOString(),
        patientPaymentIds: [patientPayment.PayNum.toString()],
        insurancePaymentIds: [insurancePayment.ClaimPaymentNum.toString()],
      };

      const createRes = await request(app)
        .post('/api/deposits/slips')
        .set(authHeader)
        .send(slipData);

      expect(createRes.status).toBe(201);
      expect(createRes.body.success).toBe(true);
      expect(createRes.body.data).toBeDefined();
      expect(createRes.body.data.amount).toBe(500.0); // 150 + 350
      expect(createRes.body.data.bankAccountInfo).toBe(slipData.bankAccountInfo);
      expect(createRes.body.data.memo).toBe(slipData.memo);
      expect(createRes.body.data._id).toBeDefined();

      const createdSlipId = createRes.body.data._id;

      // 5. Verify payments have been updated in the DB
      const updatedPatientPayment = await prisma.payment.findUnique({
        where: { PayNum: patientPayment.PayNum },
      });
      expect(updatedPatientPayment?.DepositNum?.toString()).toBe(createdSlipId);

      const updatedInsurancePayment = await prisma.claimpayment.findUnique({
        where: { ClaimPaymentNum: insurancePayment.ClaimPaymentNum },
      });
      expect(updatedInsurancePayment?.DepositNum?.toString()).toBe(createdSlipId);

      // 6. Verify they are no longer in the un-deposited list
      const unDepositedAfter = await request(app)
        .get('/api/deposits/slips/un-deposited')
        .set(authHeader);
      
      expect(unDepositedAfter.status).toBe(200);
      const patPaysAfter = unDepositedAfter.body.data.patientPayments.map((p: any) => p.id);
      const insPaysAfter = unDepositedAfter.body.data.insurancePayments.map((p: any) => p.id);
      
      expect(patPaysAfter).not.toContain(patientPayment.PayNum.toString());
      expect(insPaysAfter).not.toContain(insurancePayment.ClaimPaymentNum.toString());

      // 7. Verify the deposit slip is listed in slips
      const slipsListRes = await request(app)
        .get('/api/deposits/slips')
        .set(authHeader);
      
      expect(slipsListRes.status).toBe(200);
      const slips = slipsListRes.body.data.slips;
      const foundSlip = slips.find((s: any) => s._id === createdSlipId);
      expect(foundSlip).toBeDefined();
      expect(foundSlip.amount).toBe(500.0);
    });

    it('returns 400 validation error if body fields are invalid', async () => {
      const res = await request(app)
        .post('/api/deposits/slips')
        .set(authHeader)
        .send({
          patientPaymentIds: 'not-an-array',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});
