import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { getAdminAuthHeader } from './helpers/auth';

describe('Membership Plans and Carrier Matching Endpoints', () => {
  let authHeader: { Authorization: string };

  beforeAll(async () => {
    authHeader = await getAdminAuthHeader();
  });

  describe('Membership Plans', () => {
    let createdPlanId: string;

    it('GET /api/membership-plans - returns a list of membership plans', async () => {
      const res = await request(app)
        .get('/api/membership-plans')
        .set(authHeader);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('POST /api/membership-plans - creates a new membership plan', async () => {
      const res = await request(app)
        .post('/api/membership-plans')
        .set(authHeader)
        .send({
          name: 'Super Premium Plan',
          annualFee: '1200.00',
          monthlyFee: '99.00',
          isCoPay: true,
          autoRenewal: true,
          saveAsTemplate: true,
        });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.name).toBe('Super Premium Plan');
      expect(res.body.data.annualFee).toBe('$1200.00');
      expect(res.body.data.monthlyFee).toBe('$99.00');
      createdPlanId = res.body.data.id;
    });

    it('PUT /api/membership-plans/:id - updates the created membership plan', async () => {
      const res = await request(app)
        .put(`/api/membership-plans/${createdPlanId}`)
        .set(authHeader)
        .send({
          name: 'Super Premium Plan Updated',
          annualFee: '1300.00',
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Super Premium Plan Updated');
    });

    it('DELETE /api/membership-plans/:id - deletes the membership plan', async () => {
      const res = await request(app)
        .delete(`/api/membership-plans/${createdPlanId}`)
        .set(authHeader);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify deletion
      const checkRes = await request(app)
        .get('/api/membership-plans')
        .set(authHeader);
      const exists = checkRes.body.data.some((plan: any) => plan.id === createdPlanId);
      expect(exists).toBe(false);
    });
  });

  describe('Match Converted Carriers', () => {
    it('GET /api/insurance-companies/converted/old-payers - returns list', async () => {
      const res = await request(app)
        .get('/api/insurance-companies/converted/old-payers')
        .set(authHeader);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('GET /api/insurance-companies/converted/oryx-payers - returns list', async () => {
      const res = await request(app)
        .get('/api/insurance-companies/converted/oryx-payers')
        .set(authHeader);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('POST /api/insurance-companies/converted/match - creates a match, and matching is retrieved via GET /matched', async () => {
      const matchRes = await request(app)
        .post('/api/insurance-companies/converted/match')
        .set(authHeader)
        .send({
          oldPayerId: 'old-1',
          oryxPayerId: '1',
        });
      expect(matchRes.status).toBe(200);
      expect(matchRes.body.success).toBe(true);

      const getRes = await request(app)
        .get('/api/insurance-companies/converted/matched')
        .set(authHeader);
      expect(getRes.status).toBe(200);
      expect(getRes.body.success).toBe(true);
      expect(getRes.body.data.some((m: any) => m.oldPayerId === 'old-1')).toBe(true);
    });

    it('DELETE /api/insurance-companies/converted/match/:oldPayerId - removes match', async () => {
      const delRes = await request(app)
        .delete('/api/insurance-companies/converted/match/old-1')
        .set(authHeader);
      expect(delRes.status).toBe(200);
      expect(delRes.body.success).toBe(true);

      const getRes = await request(app)
        .get('/api/insurance-companies/converted/matched')
        .set(authHeader);
      expect(getRes.body.data.some((m: any) => m.oldPayerId === 'old-1')).toBe(false);
    });

    it('POST /api/insurance-companies/converted/fetch-matches - triggers process', async () => {
      const res = await request(app)
        .post('/api/insurance-companies/converted/fetch-matches')
        .set(authHeader);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('Match Vyne Carriers', () => {
    it('GET /api/insurance-companies/vyne/office-payers - returns list', async () => {
      const res = await request(app)
        .get('/api/insurance-companies/vyne/office-payers')
        .set(authHeader);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('GET /api/insurance-companies/vyne/payers - returns national list', async () => {
      const res = await request(app)
        .get('/api/insurance-companies/vyne/payers')
        .set(authHeader);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('POST /api/insurance-companies/vyne/match - maps office carrier to Vyne payer', async () => {
      const matchRes = await request(app)
        .post('/api/insurance-companies/vyne/match')
        .set(authHeader)
        .send({
          officePayerId: 'office-1',
          vynePayerId: 'vyne-1',
          vyneMasterId: 'VM-MASTER-123',
        });
      expect(matchRes.status).toBe(200);
      expect(matchRes.body.success).toBe(true);

      const getRes = await request(app)
        .get('/api/insurance-companies/vyne/matched')
        .set(authHeader);
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.some((m: any) => m.officePayerId === 'office-1')).toBe(true);
    });

    it('DELETE /api/insurance-companies/vyne/match/:officePayerId - removes mapping', async () => {
      const delRes = await request(app)
        .delete('/api/insurance-companies/vyne/match/office-1')
        .set(authHeader);
      expect(delRes.status).toBe(200);
      expect(delRes.body.success).toBe(true);

      const getRes = await request(app)
        .get('/api/insurance-companies/vyne/matched')
        .set(authHeader);
      expect(getRes.body.data.some((m: any) => m.officePayerId === 'office-1')).toBe(false);
    });
  });
});
