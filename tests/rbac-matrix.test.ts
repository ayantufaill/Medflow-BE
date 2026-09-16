import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { getAdminAuthHeader } from './helpers/auth';

const loginUser = async (email: string, password = 'Password123!') => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password });
  
  if (res.status !== 200 || !res.body?.data?.tokens?.accessToken) {
    throw new Error(`Login failed for ${email} (status ${res.status}): ${JSON.stringify(res.body)}`);
  }

  return {
    status: res.status,
    user: res.body.data.user,
    token: res.body.data.tokens.accessToken,
    header: { Authorization: `Bearer ${res.body.data.tokens.accessToken}` }
  };
};

describe('Pure 4-Group Role-Based Access Control (RBAC) Matrix & Permission Gating', () => {
  let adminHeader: { Authorization: string };
  let assistantHeader: { Authorization: string };
  let frontDeskHeader: { Authorization: string };
  let billerHeader: { Authorization: string };
  let providerHeader: { Authorization: string };

  beforeAll(async () => {
    adminHeader = await getAdminAuthHeader();

    const assistantLogin = await loginUser('assistant@medflow.com');
    assistantHeader = assistantLogin.header;

    const frontDeskLogin = await loginUser('frontdesk@medflow.com');
    frontDeskHeader = frontDeskLogin.header;

    const billerLogin = await loginUser('biller@medflow.com');
    billerHeader = billerLogin.header;

    const providerLogin = await loginUser('provider@medflow.com');
    providerHeader = providerLogin.header;
  });

  describe('1. Pure 4-Group Permission Matrix Configuration', () => {
    it('retrieves the full permissions matrix via /api/permissions/matrix', async () => {
      const res = await request(app)
        .get('/api/permissions/matrix')
        .set(adminHeader);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const matrix = res.body.data.matrix;
      expect(matrix).toBeDefined();

      // Group 1 (ADMIN_GROUP): Super Admin has wildcard '*'
      expect(matrix['Super Admin']).toBeDefined();
      expect(matrix['Super Admin']['*']).toBe(true);

      // Group 2 (CLINICAL_GROUP): All members have identical clinical permissions
      expect(matrix['Provider']).toBeDefined();
      expect(matrix['Provider']['clinical-notes.sign']).toBe(true);
      expect(matrix['Provider']['vital-signs.read']).toBe(true);
      expect(matrix['Provider']['reports.read']).toBeUndefined();

      expect(matrix['Assistant']).toBeDefined();
      expect(matrix['Assistant']['clinical-notes.sign']).toBe(true);
      expect(matrix['Assistant']['vital-signs.read']).toBe(true);
      expect(matrix['Assistant']['reports.read']).toBeUndefined();

      expect(matrix['Hygienist']).toBeDefined();
      expect(matrix['Hygienist']['clinical-notes.sign']).toBe(true);
      expect(matrix['Hygienist']['vital-signs.read']).toBe(true);
      expect(matrix['Hygienist']['reports.read']).toBeUndefined();

      // Group 3 (OPERATIONS_GROUP): All members have identical operations & billing permissions
      expect(matrix['Front Desk']).toBeDefined();
      expect(matrix['Front Desk']['patients.read']).toBe(true);
      expect(matrix['Front Desk']['reports.read']).toBe(true);
      expect(matrix['Front Desk']['clinical-notes.sign']).toBeUndefined();

      expect(matrix['Biller']).toBeDefined();
      expect(matrix['Biller']['patients.read']).toBe(true);
      expect(matrix['Biller']['reports.read']).toBe(true);
      expect(matrix['Biller']['clinical-notes.sign']).toBeUndefined();

      expect(matrix['Lab']).toBeDefined();
      expect(matrix['Lab']['reports.read']).toBe(true);
      expect(matrix['Lab']['clinical-notes.sign']).toBeUndefined();
    });
  });

  describe('2. Clinical Group Boundaries: Gated from Financial Reports', () => {
    it('allows Dental Assistant to access vital signs (Clinical Group)', async () => {
      const res = await request(app)
        .get('/api/vital-signs')
        .set(assistantHeader);

      expect([200, 404]).toContain(res.status);
    });

    it('DENIES Dental Assistant from accessing financial reports (/api/reports/financial/production)', async () => {
      const res = await request(app)
        .get('/api/reports/financial/production')
        .set(assistantHeader);

      expect(res.status).toBe(403);
      expect(res.body.error?.message || res.body.message).toMatch(/Required permission: reports\.read|Permission check failed/i);
    });

    it('DENIES Dental Assistant from accessing denial rate reports (/api/reports/denial-rates)', async () => {
      const res = await request(app)
        .get('/api/reports/denial-rates')
        .set(assistantHeader);

      expect(res.status).toBe(403);
    });

    it('DENIES Dental Assistant from accessing productivity panel summary (/api/productivity/panel-summary)', async () => {
      const res = await request(app)
        .get('/api/productivity/panel-summary')
        .set(assistantHeader);

      expect(res.status).toBe(403);
    });

    it('DENIES Provider from accessing financial reports (Clinical Group boundary)', async () => {
      const res = await request(app)
        .get('/api/reports/financial/production')
        .set(providerHeader);

      expect(res.status).toBe(403);
    });
  });

  describe('3. Operational Group Boundaries: Gated from Clinical Signing', () => {
    it('allows Front Desk to access patients', async () => {
      const res = await request(app)
        .get('/api/patients')
        .set(frontDeskHeader);

      expect(res.status).toBe(200);
    });

    it('DENIES Front Desk from signing clinical notes (POST /api/clinical-notes/:id/sign)', async () => {
      const res = await request(app)
        .post('/api/clinical-notes/1/sign')
        .set(frontDeskHeader);

      expect(res.status).toBe(403);
      expect(res.body.error?.message || res.body.message).toMatch(/Required permission: clinical-notes\.sign|Permission check failed/i);
    });

    it('DENIES Biller from signing clinical notes (POST /api/clinical-notes/:id/sign)', async () => {
      const res = await request(app)
        .post('/api/clinical-notes/1/sign')
        .set(billerHeader);

      expect(res.status).toBe(403);
    });
  });

  describe('4. Operational Group Financial Capabilities', () => {
    it('allows Biller to access billing/financial reports', async () => {
      const res = await request(app)
        .get('/api/reports/financial/production')
        .set(billerHeader);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('allows Biller to access denial rate reports', async () => {
      const res = await request(app)
        .get('/api/reports/denial-rates')
        .set(billerHeader);

      expect(res.status).toBe(200);
    });

    it('allows Front Desk to access financial reports (Equalized Operations Group access)', async () => {
      const res = await request(app)
        .get('/api/reports/financial/production')
        .set(frontDeskHeader);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('5. Patient Slider & Dropdown Access for All Staff Roles', () => {
    it('allows Biller to search and list patients from the patient dropdown', async () => {
      const res = await request(app)
        .get('/api/patients?limit=20&page=1')
        .set(billerHeader);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data?.patients || res.body.data)).toBe(true);
    });

    it('allows Biller to load patient workspace when selecting a patient', async () => {
      const listRes = await request(app)
        .get('/api/patients?limit=1')
        .set(billerHeader);
      
      const patients = listRes.body.data?.patients || listRes.body.data;
      const patientId = patients[0]?._id || patients[0]?.id || 1;

      const res = await request(app)
        .get(`/api/patients/${patientId}/workspace`)
        .set(billerHeader);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('allows Biller to load patient balance and appointments for billing slider', async () => {
      const listRes = await request(app)
        .get('/api/patients?limit=1')
        .set(billerHeader);
      
      const patients = listRes.body.data?.patients || listRes.body.data;
      const patientId = patients[0]?._id || patients[0]?.id || 1;

      const balRes = await request(app)
        .get(`/api/patients/${patientId}/balance`)
        .set(billerHeader);
      expect(balRes.status).toBe(200);

      const apptRes = await request(app)
        .get(`/api/patients/${patientId}/appointments`)
        .set(billerHeader);
      expect(apptRes.status).toBe(200);
    });

    it('allows Dental Assistant to list and select patients in slider', async () => {
      const listRes = await request(app)
        .get('/api/patients?limit=1')
        .set(assistantHeader);
      expect(listRes.status).toBe(200);

      const patients = listRes.body.data?.patients || listRes.body.data;
      const patientId = patients[0]?._id || patients[0]?.id || 1;

      const wsRes = await request(app)
        .get(`/api/patients/${patientId}/workspace`)
        .set(assistantHeader);
      expect(wsRes.status).toBe(200);
    });

    it('allows Front Desk to list and select patients in slider', async () => {
      const listRes = await request(app)
        .get('/api/patients?limit=1')
        .set(frontDeskHeader);
      expect(listRes.status).toBe(200);

      const patients = listRes.body.data?.patients || listRes.body.data;
      const patientId = patients[0]?._id || patients[0]?.id || 1;

      const wsRes = await request(app)
        .get(`/api/patients/${patientId}/workspace`)
        .set(frontDeskHeader);
      expect(wsRes.status).toBe(200);
    });
  });

  describe('6. Super Admin Universal Access Across All Modules', () => {
    it('allows Super Admin to access schedule endpoints', async () => {
      const res = await request(app)
        .get('/api/appointments?limit=10')
        .set(adminHeader);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('allows Super Admin to access patients endpoints', async () => {
      const res = await request(app)
        .get('/api/patients?limit=10')
        .set(adminHeader);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('allows Super Admin to access clinical notes', async () => {
      const res = await request(app)
        .get('/api/clinical-notes')
        .set(adminHeader);
      expect([200, 404]).toContain(res.status);
    });

    it('allows Super Admin to access financial reports', async () => {
      const res = await request(app)
        .get('/api/reports/financial/production')
        .set(adminHeader);
      expect(res.status).toBe(200);
    });

    it('allows Super Admin to access user management', async () => {
      const res = await request(app)
        .get('/api/users')
        .set(adminHeader);
      expect(res.status).toBe(200);
    });
  });
});
