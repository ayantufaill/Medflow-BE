import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { getAdminAuthHeader } from './helpers/auth';

describe('Payment Terminals APIs', () => {
  let authHeader: { Authorization: string };

  beforeAll(async () => {
    authHeader = await getAdminAuthHeader();
  });

  it('manages OpenEdge, Prosperipay, and Payrix terminals CRUD cycles', async () => {
    // 1. Create OpenEdge Terminal
    const oeRes = await request(app)
      .post('/api/payment-terminals')
      .set(authHeader)
      .send({
        Type: 'OpenEdge',
        SerialNum: 'OE-123456',
        AccountToken: 'OE-TOKEN-999',
      });
    expect(oeRes.status).toBe(201);
    expect(oeRes.body.data.id).toBeDefined();
    expect(oeRes.body.data.type).toBe('OpenEdge');
    expect(oeRes.body.data.serialNum).toBe('OE-123456');
    expect(oeRes.body.data.accountToken).toBe('OE-TOKEN-999');

    const oeId = oeRes.body.data.id;

    // 2. Create Prosperipay Terminal
    const ppRes = await request(app)
      .post('/api/payment-terminals')
      .set(authHeader)
      .send({
        Type: 'Prosperipay',
        SerialNum: 'PP-123456',
        Name: 'Checkin Terminal',
        MerchantId: 'PP-MERCH-888',
        Model: 'Lane/3000',
        DeviceId: 'DEV-112233',
      });
    expect(ppRes.status).toBe(201);
    expect(ppRes.body.data.id).toBeDefined();
    expect(ppRes.body.data.type).toBe('Prosperipay');
    expect(ppRes.body.data.name).toBe('Checkin Terminal');

    const ppId = ppRes.body.data.id;

    // 3. Create Payrix Terminal
    const pxRes = await request(app)
      .post('/api/payment-terminals')
      .set(authHeader)
      .send({
        Type: 'Payrix',
        SerialNum: 'PX-123456',
        TerminalId: 'PX-TERM-777',
        Model: 'Lane/5000',
        LaneId: '2',
      });
    expect(pxRes.status).toBe(201);
    expect(pxRes.body.data.id).toBeDefined();
    expect(pxRes.body.data.type).toBe('Payrix');
    expect(pxRes.body.data.terminalId).toBe('PX-TERM-777');

    const pxId = pxRes.body.data.id;

    // 4. List all active terminals
    const listRes = await request(app)
      .get('/api/payment-terminals')
      .set(authHeader);
    expect(listRes.status).toBe(200);
    const ids = listRes.body.data.map((t: any) => t.id);
    expect(ids).toContain(oeId);
    expect(ids).toContain(ppId);
    expect(ids).toContain(pxId);

    // 5. Delete OpenEdge terminal
    const deleteRes = await request(app)
      .delete(`/api/payment-terminals/${oeId}`)
      .set(authHeader);
    expect(deleteRes.status).toBe(200);

    // 6. List again and ensure OpenEdge is gone
    const listRes2 = await request(app)
      .get('/api/payment-terminals')
      .set(authHeader);
    expect(listRes2.status).toBe(200);
    const ids2 = listRes2.body.data.map((t: any) => t.id);
    expect(ids2).not.toContain(oeId);
    expect(ids2).toContain(ppId);
    expect(ids2).toContain(pxId);
  });

  it('validates incorrect payload types', async () => {
    // Missing serial number
    const res1 = await request(app)
      .post('/api/payment-terminals')
      .set(authHeader)
      .send({
        Type: 'OpenEdge',
        AccountToken: 'OE-TOKEN-999',
      });
    expect(res1.status).toBe(400);

    // Invalid terminal type
    const res2 = await request(app)
      .post('/api/payment-terminals')
      .set(authHeader)
      .send({
        Type: 'InvalidType',
        SerialNum: '1234',
      });
    expect(res2.status).toBe(400);
  });
});
