import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/db';
import { getAdminAuthHeader } from './helpers/auth';
import { uniqueToken } from './helpers/unique';
import {
  createAppointmentRecord,
  createPatientRecord,
  createProviderRecord,
} from './helpers/fixtures';

describe('Appointment Total and Paid Amount Calculation', () => {
  let authHeader: { Authorization: string };

  beforeAll(async () => {
    authHeader = await getAdminAuthHeader();
  });

  it('defaults totalAmount and paidAmount to 0 for appointment with no procedures', async () => {
    const token = uniqueToken('aptzero');
    const patient = await createPatientRecord(token);
    const provider = await createProviderRecord(token);
    const appointment = await createAppointmentRecord({
      patientId: patient.PatNum,
      providerId: provider.ProvNum,
      token,
    });

    const res = await request(app)
      .get(`/api/appointments/${appointment.AptNum}`)
      .set(authHeader);

    expect(res.status).toBe(200);
    const data = res.body?.data?.appointment ?? res.body?.data;
    expect(data.totalAmount).toBe(0);
    expect(data.paidAmount).toBe(0);
  });

  it('calculates fully unpaid appointment ($0.00 / $300.00)', async () => {
    const token = uniqueToken('aptunpaid');
    const patient = await createPatientRecord(token);
    const provider = await createProviderRecord(token);
    const appointment = await createAppointmentRecord({
      patientId: patient.PatNum,
      providerId: provider.ProvNum,
      token,
    });

    // Create a procedure attached to this appointment with fee $300
    const proc = await prisma.procedurelog.create({
      data: {
        ProcNum: BigInt(Math.floor(Date.now() + Math.random() * 100000)),
        PatNum: patient.PatNum,
        AptNum: appointment.AptNum,
        ProcFee: 300,
        UnitQty: 1,
        ProcStatus: 2, // completed
      },
    });

    const res = await request(app)
      .get(`/api/appointments/${appointment.AptNum}`)
      .set(authHeader);

    expect(res.status).toBe(200);
    const data = res.body?.data?.appointment ?? res.body?.data;
    expect(data.totalAmount).toBe(300);
    expect(data.paidAmount).toBe(0);
  });

  it('calculates partially paid appointment with patient split ($125.00 / $300.00)', async () => {
    const token = uniqueToken('aptpart');
    const patient = await createPatientRecord(token);
    const provider = await createProviderRecord(token);
    const appointment = await createAppointmentRecord({
      patientId: patient.PatNum,
      providerId: provider.ProvNum,
      token,
    });

    const proc = await prisma.procedurelog.create({
      data: {
        ProcNum: BigInt(Math.floor(Date.now() + Math.random() * 100000 + 100)),
        PatNum: patient.PatNum,
        AptNum: appointment.AptNum,
        ProcFee: 300,
        UnitQty: 1,
        ProcStatus: 2,
      },
    });

    // Create a paysplit for $125
    await prisma.paysplit.create({
      data: {
        SplitNum: BigInt(Math.floor(Date.now() + Math.random() * 100000 + 200)),
        ProcNum: proc.ProcNum,
        PatNum: patient.PatNum,
        SplitAmt: 125,
      },
    });

    const res = await request(app)
      .get(`/api/appointments/${appointment.AptNum}`)
      .set(authHeader);

    expect(res.status).toBe(200);
    const data = res.body?.data?.appointment ?? res.body?.data;
    expect(data.totalAmount).toBe(300);
    expect(data.paidAmount).toBe(125);
  });

  it('calculates fully paid appointment with patient split and insurance payment ($300.00 / $300.00)', async () => {
    const token = uniqueToken('aptfull');
    const patient = await createPatientRecord(token);
    const provider = await createProviderRecord(token);
    const appointment = await createAppointmentRecord({
      patientId: patient.PatNum,
      providerId: provider.ProvNum,
      token,
    });

    const proc = await prisma.procedurelog.create({
      data: {
        ProcNum: BigInt(Math.floor(Date.now() + Math.random() * 100000 + 300)),
        PatNum: patient.PatNum,
        AptNum: appointment.AptNum,
        ProcFee: 300,
        UnitQty: 1,
        ProcStatus: 2,
      },
    });

    // Patient payment of $100
    await prisma.paysplit.create({
      data: {
        SplitNum: BigInt(Math.floor(Date.now() + Math.random() * 100000 + 400)),
        ProcNum: proc.ProcNum,
        PatNum: patient.PatNum,
        SplitAmt: 100,
      },
    });

    // Insurance payment of $200
    await prisma.claimproc.create({
      data: {
        ClaimProcNum: BigInt(Math.floor(Date.now() + Math.random() * 100000 + 500)),
        ProcNum: proc.ProcNum,
        PatNum: patient.PatNum,
        Status: 1, // 1 = Received
        InsPayAmt: 200,
      },
    });

    const res = await request(app)
      .get(`/api/appointments/${appointment.AptNum}`)
      .set(authHeader);

    expect(res.status).toBe(200);
    const data = res.body?.data?.appointment ?? res.body?.data;
    expect(data.totalAmount).toBe(300);
    expect(data.paidAmount).toBe(300);
  });

  it('returns normalized totalAmount and paidAmount in bulk GET /api/appointments list', async () => {
    const token = uniqueToken('aptbulk');
    const patient = await createPatientRecord(token);
    const provider = await createProviderRecord(token);
    const appointment = await createAppointmentRecord({
      patientId: patient.PatNum,
      providerId: provider.ProvNum,
      token,
    });

    const proc = await prisma.procedurelog.create({
      data: {
        ProcNum: BigInt(Math.floor(Date.now() + Math.random() * 100000 + 600)),
        PatNum: patient.PatNum,
        AptNum: appointment.AptNum,
        ProcFee: 150,
        UnitQty: 2, // 150 * 2 = 300
        ProcStatus: 2,
      },
    });

    await prisma.paysplit.create({
      data: {
        SplitNum: BigInt(Math.floor(Date.now() + Math.random() * 100000 + 700)),
        ProcNum: proc.ProcNum,
        PatNum: patient.PatNum,
        SplitAmt: 125,
      },
    });

    const res = await request(app)
      .get(`/api/appointments?search=${encodeURIComponent(token)}`)
      .set(authHeader);

    expect(res.status).toBe(200);
    const items = res.body?.data?.appointments ?? [];
    const found = items.find((item: any) => String(item._id) === appointment.AptNum.toString());
    expect(found).toBeDefined();
    expect(found.totalAmount).toBe(300);
    expect(found.paidAmount).toBe(125);
  });
});
