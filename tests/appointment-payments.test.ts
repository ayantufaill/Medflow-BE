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

  it('auto-allocates invoice payment across appointment procedures and updates appointment totals ($150.00 / $300.00)', async () => {
    const token = uniqueToken('aptinvpay');
    const patient = await createPatientRecord(token);
    const provider = await createProviderRecord(token);
    const appointment = await createAppointmentRecord({
      patientId: patient.PatNum,
      providerId: provider.ProvNum,
      token,
    });

    const proc = await prisma.procedurelog.create({
      data: {
        ProcNum: BigInt(Math.floor(Date.now() + Math.random() * 100000 + 800)),
        PatNum: patient.PatNum,
        AptNum: appointment.AptNum,
        ProcFee: 300,
        UnitQty: 1,
        ProcStatus: 2,
      },
    });

    const stmt = await prisma.statement.create({
      data: {
        StatementNum: BigInt(Math.floor(Date.now() + Math.random() * 100000 + 900)),
        PatNum: patient.PatNum,
        DateSent: new Date(),
        IsInvoice: 1,
        StatementType: 'draft',
        ShortGUID: `INV${Math.floor(Date.now() / 1000)}`,
        BalTotal: 300,
        NoteBold: JSON.stringify({ appointmentId: appointment.AptNum.toString(), totalAmount: 300 }),
      },
    });

    await prisma.procedurelog.update({
      where: { ProcNum: proc.ProcNum },
      data: { StatementNum: stmt.StatementNum },
    });

    const { paymentService } = await import('../src/services/payment.service');
    const { loginAsAdmin } = await import('./helpers/auth');
    const admin = await loginAsAdmin();

    const payment = await paymentService.createPayment(
      {
        patientId: patient.PatNum.toString(),
        invoiceId: stmt.StatementNum.toString(),
        amount: 150,
        paymentMethod: 'cash',
      },
      admin.userId
    );

    expect(payment).toBeDefined();
    expect(payment.amount).toBe(150);

    // Verify paysplit was auto-created
    const splits = await prisma.paysplit.findMany({ where: { ProcNum: proc.ProcNum } });
    expect(splits.length).toBeGreaterThan(0);
    const splitSum = splits.reduce((sum, s) => sum + Number(s.SplitAmt), 0);
    expect(splitSum).toBe(150);

    // Verify appointment totals reflect payment
    const res = await request(app)
      .get(`/api/appointments/${appointment.AptNum}`)
      .set(authHeader);

    expect(res.status).toBe(200);
    const data = res.body?.data?.appointment ?? res.body?.data;
    expect(data.totalAmount).toBe(300);
    expect(data.paidAmount).toBe(150);
  });

  it('handles full invoice payment ($300.00 / $300.00)', async () => {
    const token = uniqueToken('aptinvfull');
    const patient = await createPatientRecord(token);
    const provider = await createProviderRecord(token);
    const appointment = await createAppointmentRecord({
      patientId: patient.PatNum,
      providerId: provider.ProvNum,
      token,
    });

    const proc = await prisma.procedurelog.create({
      data: {
        ProcNum: BigInt(Math.floor(Date.now() + Math.random() * 100000 + 1000)),
        PatNum: patient.PatNum,
        AptNum: appointment.AptNum,
        ProcFee: 300,
        UnitQty: 1,
        ProcStatus: 2,
      },
    });

    const stmt = await prisma.statement.create({
      data: {
        StatementNum: BigInt(Math.floor(Date.now() + Math.random() * 100000 + 1100)),
        PatNum: patient.PatNum,
        DateSent: new Date(),
        IsInvoice: 1,
        StatementType: 'draft',
        ShortGUID: `INV${Math.floor(Date.now() / 1000) + 1}`,
        BalTotal: 300,
        NoteBold: JSON.stringify({ appointmentId: appointment.AptNum.toString(), totalAmount: 300 }),
      },
    });

    await prisma.procedurelog.update({
      where: { ProcNum: proc.ProcNum },
      data: { StatementNum: stmt.StatementNum },
    });

    const { paymentService } = await import('../src/services/payment.service');
    const { loginAsAdmin } = await import('./helpers/auth');
    const admin = await loginAsAdmin();

    await paymentService.createPayment(
      {
        patientId: patient.PatNum.toString(),
        invoiceId: stmt.StatementNum.toString(),
        amount: 300,
        paymentMethod: 'credit_card',
      },
      admin.userId
    );

    const res = await request(app)
      .get(`/api/appointments/${appointment.AptNum}`)
      .set(authHeader);

    expect(res.status).toBe(200);
    const data = res.body?.data?.appointment ?? res.body?.data;
    expect(data.totalAmount).toBe(300);
    expect(data.paidAmount).toBe(300);
  });

  it('correctly aggregates legacy invoice payment without procedure-level paysplit', async () => {
    const token = uniqueToken('aptinvlegacy');
    const patient = await createPatientRecord(token);
    const provider = await createProviderRecord(token);
    const appointment = await createAppointmentRecord({
      patientId: patient.PatNum,
      providerId: provider.ProvNum,
      token,
    });

    const proc = await prisma.procedurelog.create({
      data: {
        ProcNum: BigInt(Math.floor(Date.now() + Math.random() * 100000 + 1200)),
        PatNum: patient.PatNum,
        AptNum: appointment.AptNum,
        ProcFee: 300,
        UnitQty: 1,
        ProcStatus: 2,
      },
    });

    const stmt = await prisma.statement.create({
      data: {
        StatementNum: BigInt(Math.floor(Date.now() + Math.random() * 100000 + 1300)),
        PatNum: patient.PatNum,
        DateSent: new Date(),
        IsInvoice: 1,
        StatementType: 'draft',
        ShortGUID: `INV${Math.floor(Date.now() / 1000) + 2}`,
        BalTotal: 300,
        NoteBold: JSON.stringify({ appointmentId: appointment.AptNum.toString(), totalAmount: 300 }),
      },
    });

    await prisma.procedurelog.update({
      where: { ProcNum: proc.ProcNum },
      data: { StatementNum: stmt.StatementNum },
    });

    // Create legacy payment with invoiceId in PayNote but without paysplit
    await prisma.payment.create({
      data: {
        PayNum: BigInt(Math.floor(Date.now() + Math.random() * 100000 + 1400)),
        PatNum: patient.PatNum,
        PayAmt: 200,
        PayDate: new Date(),
        PayNote: JSON.stringify({
          invoiceId: stmt.StatementNum.toString(),
          status: 'completed',
        }),
      },
    });

    const res = await request(app)
      .get(`/api/appointments/${appointment.AptNum}`)
      .set(authHeader);

    expect(res.status).toBe(200);
    const data = res.body?.data?.appointment ?? res.body?.data;
    expect(data.totalAmount).toBe(300);
    expect(data.paidAmount).toBe(200);
  });

  it('excludes voided payment from appointment paid amount ($0.00 / $300.00)', async () => {
    const token = uniqueToken('aptinvvoid');
    const patient = await createPatientRecord(token);
    const provider = await createProviderRecord(token);
    const appointment = await createAppointmentRecord({
      patientId: patient.PatNum,
      providerId: provider.ProvNum,
      token,
    });

    const proc = await prisma.procedurelog.create({
      data: {
        ProcNum: BigInt(Math.floor(Date.now() + Math.random() * 100000 + 1500)),
        PatNum: patient.PatNum,
        AptNum: appointment.AptNum,
        ProcFee: 300,
        UnitQty: 1,
        ProcStatus: 2,
      },
    });

    const stmt = await prisma.statement.create({
      data: {
        StatementNum: BigInt(Math.floor(Date.now() + Math.random() * 100000 + 1600)),
        PatNum: patient.PatNum,
        DateSent: new Date(),
        IsInvoice: 1,
        StatementType: 'draft',
        ShortGUID: `INV${Math.floor(Date.now() / 1000) + 3}`,
        BalTotal: 300,
        NoteBold: JSON.stringify({ appointmentId: appointment.AptNum.toString(), totalAmount: 300 }),
      },
    });

    await prisma.procedurelog.update({
      where: { ProcNum: proc.ProcNum },
      data: { StatementNum: stmt.StatementNum },
    });

    const { paymentService } = await import('../src/services/payment.service');
    const { loginAsAdmin } = await import('./helpers/auth');
    const admin = await loginAsAdmin();

    const payment = await paymentService.createPayment(
      {
        patientId: patient.PatNum.toString(),
        invoiceId: stmt.StatementNum.toString(),
        amount: 150,
        paymentMethod: 'cash',
      },
      admin.userId
    );

    // Verify it initially shows $150 paid
    let res = await request(app)
      .get(`/api/appointments/${appointment.AptNum}`)
      .set(authHeader);
    let data = res.body?.data?.appointment ?? res.body?.data;
    expect(data.paidAmount).toBe(150);

    // Void the payment
    await paymentService.voidPayment(payment._id, 'Payment mistake', admin.userId);

    // Verify appointment paidAmount is now 0
    res = await request(app)
      .get(`/api/appointments/${appointment.AptNum}`)
      .set(authHeader);

    data = res.body?.data?.appointment ?? res.body?.data;
    expect(data.totalAmount).toBe(300);
    expect(data.paidAmount).toBe(0);
  });

  it('updates appointment paid amount when standalone invoice is created and paid ($78.00 / $510.00)', async () => {
    const token = uniqueToken('aptstand');
    const patient = await createPatientRecord(token);
    const provider = await createProviderRecord(token);
    const appointment = await createAppointmentRecord({
      patientId: patient.PatNum,
      providerId: provider.ProvNum,
      token,
    });

    // Appointment procedures
    const proc1 = await prisma.procedurelog.create({
      data: {
        ProcNum: BigInt(Math.floor(Date.now() + Math.random() * 100000 + 2000)),
        PatNum: patient.PatNum,
        AptNum: appointment.AptNum,
        ProcFee: 120,
        UnitQty: 1,
        ProcStatus: 1,
        BillingNote: 'Panoramic Radiographic Image',
      },
    });
    const proc2 = await prisma.procedurelog.create({
      data: {
        ProcNum: BigInt(Math.floor(Date.now() + Math.random() * 100000 + 2001)),
        PatNum: patient.PatNum,
        AptNum: appointment.AptNum,
        ProcFee: 170,
        UnitQty: 1,
        ProcStatus: 1,
        BillingNote: 'Full Mouth Debridement',
      },
    });
    const proc3 = await prisma.procedurelog.create({
      data: {
        ProcNum: BigInt(Math.floor(Date.now() + Math.random() * 100000 + 2002)),
        PatNum: patient.PatNum,
        AptNum: appointment.AptNum,
        ProcFee: 220,
        UnitQty: 1,
        ProcStatus: 1,
        BillingNote: 'Periodontal Scaling & Root Planing',
      },
    });

    const { loginAsAdmin } = await import('./helpers/auth');
    const admin = await loginAsAdmin();
    const { invoiceService } = await import('../src/services/invoice.service');
    const { paymentService } = await import('../src/services/payment.service');

    // Create standalone invoice for this patient / appointment
    const createdInvoice = await invoiceService.createStandaloneInvoice(
      {
        patientId: patient.PatNum.toString(),
        appointmentId: appointment.AptNum.toString(),
        items: [
          { code: 'D0330', description: 'Panoramic Radiographic Image', charge: 120, insPortion: 120, ptPortion: 0 },
          { code: 'D4355', description: 'Full Mouth Debridement', charge: 170, insPortion: 136, ptPortion: 34 },
          { code: 'D4341', description: 'Periodontal Scaling & Root Planing', charge: 220, insPortion: 176, ptPortion: 44 },
        ],
      },
      admin.userId
    );

    // Initial check: $0.00 paid, $510.00 total
    let res = await request(app)
      .get(`/api/appointments/${appointment.AptNum}`)
      .set(authHeader);
    let data = res.body?.data?.appointment ?? res.body?.data;
    expect(data.totalAmount).toBe(510);
    expect(data.paidAmount).toBe(0);

    // Collect patient payment ($78.00)
    await paymentService.createPayment(
      {
        patientId: patient.PatNum.toString(),
        invoiceId: createdInvoice.id,
        amount: 78,
        paymentMethod: 'Master Card',
      },
      admin.userId
    );

    // Appointment now displays $78.00 / $510.00
    res = await request(app)
      .get(`/api/appointments/${appointment.AptNum}`)
      .set(authHeader);
    data = res.body?.data?.appointment ?? res.body?.data;
    expect(data.totalAmount).toBe(510);
    expect(data.paidAmount).toBe(78);
  });
});

