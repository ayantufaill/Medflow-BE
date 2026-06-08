import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { getAdminAuthHeader } from './helpers/auth';
import { uniqueToken } from './helpers/unique';

describe('Admin Finance Management APIs', () => {
  let authHeader: { Authorization: string };

  beforeAll(async () => {
    authHeader = await getAdminAuthHeader();
  });

  describe('Definitions (Adjustment & Payment Types)', () => {
    it('manages definitions CRUD cycles for Category 1 (Adjustments)', async () => {
      const defName = `Adj-${uniqueToken('adj')}`;
      
      // 1. Create
      const createRes = await request(app)
        .post('/api/admin-finance/definitions/1')
        .set(authHeader)
        .send({ name: defName, value: 'Applied to fee', itemOrder: 5 });
      expect(createRes.status).toBe(201);
      const defId = createRes.body?.data?.id;
      expect(defId).toBeDefined();
      expect(createRes.body?.data?.type).toBe(defName);

      // 2. Fetch
      const getRes = await request(app)
        .get('/api/admin-finance/definitions/1')
        .set(authHeader);
      expect(getRes.status).toBe(200);
      const found = getRes.body?.data?.find((d: any) => d.id === defId);
      expect(found).toBeDefined();
      expect(found.type).toBe(defName);

      // 3. Update
      const updateRes = await request(app)
        .put(`/api/admin-finance/definitions/item/${defId}`)
        .set(authHeader)
        .send({ name: `Updated-${defName}`, isHidden: false });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body?.data?.type).toBe(`Updated-${defName}`);

      // 4. Delete
      const deleteRes = await request(app)
        .delete(`/api/admin-finance/definitions/item/${defId}`)
        .set(authHeader);
      expect(deleteRes.status).toBe(200);

      // 5. Fetch again (should be hidden)
      const getRes2 = await request(app)
        .get('/api/admin-finance/definitions/1')
        .set(authHeader);
      const found2 = getRes2.body?.data?.find((d: any) => d.id === defId);
      expect(found2).toBeUndefined();
    });
  });

  describe('Serialized Settings', () => {
    it('saves and retrieves Billing Configuration and AR Automation configs', async () => {
      // 1. Billing Configuration
      const billingData = {
        assignmentAllBenefits: false,
        outOfNetworkByDefault: true,
        chronologicalInvoices: true,
        defaultBillingType: 'Standard Billing',
      };

      const saveBillingRes = await request(app)
        .put('/api/admin-finance/settings/billing_configuration')
        .set(authHeader)
        .send(billingData);
      expect(saveBillingRes.status).toBe(200);
      expect(saveBillingRes.body?.data?.defaultBillingType).toBe('Standard Billing');

      const getBillingRes = await request(app)
        .get('/api/admin-finance/settings/billing_configuration')
        .set(authHeader);
      expect(getBillingRes.status).toBe(200);
      expect(getBillingRes.body?.data?.outOfNetworkByDefault).toBe(true);

      // 2. AR Automation
      const arData = {
        enabled: true,
        skipOpenClaims: true,
        notifications: [
          { id: 1, title: 'Notification 1', template: 'Remind 15', method: 'Email', after: '15 Days' }
        ]
      };

      const saveArRes = await request(app)
        .put('/api/admin-finance/settings/ar_automation_config')
        .set(authHeader)
        .send(arData);
      expect(saveArRes.status).toBe(200);
      expect(saveArRes.body?.data?.enabled).toBe(true);

      const getArRes = await request(app)
        .get('/api/admin-finance/settings/ar_automation_config')
        .set(authHeader);
      expect(getArRes.status).toBe(200);
      expect(getArRes.body?.data?.notifications[0]?.title).toBe('Notification 1');
    });
  });
});
