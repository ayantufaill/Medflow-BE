import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { getAdminAuthHeader } from './helpers/auth';

describe('Reports Section APIs', () => {
  let authHeader: { Authorization: string };

  beforeAll(async () => {
    authHeader = await getAdminAuthHeader();
  });

  describe('Financial Reports', () => {
    it('gets aging report', async () => {
      const res = await request(app)
        .get('/api/reports/financial/aging')
        .set(authHeader);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      if (res.body.data.length > 0) {
        expect(res.body.data[0].name).toBeDefined();
        expect(res.body.data[0].buckets).toBeDefined();
      }
    });

    it('gets production report', async () => {
      const res = await request(app)
        .get('/api/reports/financial/production?range=Monthly&date=2026-05-22')
        .set(authHeader);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('gets deposit slips report', async () => {
      const res = await request(app)
        .get('/api/reports/financial/deposit-slips')
        .set(authHeader);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('gets provider collection per payment type report', async () => {
      const res = await request(app)
        .get('/api/reports/financial/provider-collection-payment-type')
        .set(authHeader);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      if (res.body.data.length > 0) {
        expect(res.body.data[0].patient).toBeDefined();
        expect(res.body.data[0].code).toBeDefined();
        expect(res.body.data[0].paymentType).toBeDefined();
        expect(res.body.data[0].ins).toBeDefined();
        expect(res.body.data[0].pt).toBeDefined();
      }
    });

    it('gets referral production report', async () => {
      const res = await request(app)
        .get('/api/reports/financial/referral-production?range=Monthly&date=2026-05-22')
        .set(authHeader);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.summary).toBeDefined();
      expect(res.body.data.detail).toBeDefined();
      expect(Array.isArray(res.body.data.summary)).toBe(true);
      expect(typeof res.body.data.detail).toBe('object');
    });
  });

  describe('Clinical Reports', () => {
    it('gets rx prescription report', async () => {
      const res = await request(app)
        .get('/api/reports/clinical/rx')
        .set(authHeader);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      if (res.body.data.length > 0) {
        expect(res.body.data[0].drugName).toBeDefined();
        expect(res.body.data[0].patient).toBeDefined();
      }
    });

    it('gets recare report with date range filters', async () => {
      const res = await request(app)
        .get('/api/reports/clinical/recare?startDate=2026-01-01&endDate=2026-12-31')
        .set(authHeader);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      if (res.body.data.length > 0) {
        expect(res.body.data[0].dentistId).toBeDefined();
        expect(res.body.data[0].hygienistId).toBeDefined();
      }
    });
  });

  describe('Patient Reports', () => {
    it('gets insurance coverage report', async () => {
      const res = await request(app)
        .get('/api/reports/patient/insurance-coverage')
        .set(authHeader);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('gets cancelled appointments report', async () => {
      const res = await request(app)
        .get('/api/reports/patient/cancelled-appointments')
        .set(authHeader);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('gets duplicate patients report', async () => {
      const res = await request(app)
        .get('/api/reports/patient/duplicate-patients')
        .set(authHeader);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('Other Reports', () => {
    it('gets login log report', async () => {
      const res = await request(app)
        .get('/api/reports/others/login')
        .set(authHeader);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('gets audit log report', async () => {
      const res = await request(app)
        .get('/api/reports/others/audit')
        .set(authHeader);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('Archived Reports', () => {
    let createdReportId: string;

    it('archives a report snapshot', async () => {
      const sampleData = [
        { name: 'John Smith', total: 500, buckets: { '0-30': { pt: 500, ins: 0 } } },
      ];
      const res = await request(app)
        .post('/api/reports/archive')
        .set(authHeader)
        .send({
          type: 'aging',
          data: sampleData,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.type).toBe('aging');
      createdReportId = res.body.data.id;
    });

    it('gets list of archived reports', async () => {
      const res = await request(app)
        .get('/api/reports/archive')
        .set(authHeader);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data.some((r: any) => r.id === createdReportId)).toBe(true);
    });

    it('gets archived report by id', async () => {
      const res = await request(app)
        .get(`/api/reports/archive/${createdReportId}`)
        .set(authHeader);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(createdReportId);
      expect(res.body.data.type).toBe('aging');
      expect(Array.isArray(res.body.data.data)).toBe(true);
      expect(res.body.data.data[0].name).toBe('John Smith');
    });

    it('returns 404 for non-existent archived report', async () => {
      const res = await request(app)
        .get('/api/reports/archive/99999999')
        .set(authHeader);

      expect(res.status).toBe(404);
    });
  });
});
