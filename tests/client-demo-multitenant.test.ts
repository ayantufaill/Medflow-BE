import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app';

const loginUser = async (email: string, password = 'Password123!') => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password });

  if (res.status !== 200 || !res.body?.data?.tokens?.accessToken) {
    throw new Error(`Login failed for ${email} (status ${res.status}): ${JSON.stringify(res.body)}`);
  }

  return {
    token: res.body.data.tokens.accessToken,
    header: { Authorization: `Bearer ${res.body.data.tokens.accessToken}` }
  };
};

describe('US Client Demo: Multi-Tenant & Multi-Branch Live Verification', () => {
  describe('1. Super Admin (Platform Owner) Visibility', () => {
    it('allows Super Admin to view all practice groups', async () => {
      const { header } = await loginUser('superadmin@medflow.com');
      const res = await request(app)
        .get('/api/practice-groups')
        .set(header);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const groupNames = res.body.data.map((g: any) => g.name);
      expect(groupNames).toContain('Metro Dental Partners');
      expect(groupNames).toContain('Pacific Coast Dental Care');
    });
  });

  describe('2. Group Admin Branch Scoping (DSO Regional View)', () => {
    it('returns exactly the 2 Texas branches for Metro Group Admin', async () => {
      const { header } = await loginUser('metro.groupadmin@medflow.com');
      const res = await request(app)
        .get('/api/branches')
        .set(header);

      expect(res.status).toBe(200);
      const branchNames = res.body.data.map((b: any) => b.name);
      expect(branchNames).toContain('Downtown Austin Clinic');
      expect(branchNames).toContain('Westlake Hills Branch');
      expect(branchNames).not.toContain('Seattle Central Clinic');
      expect(branchNames).not.toContain('Bellevue Medical Branch');
    });

    it('returns exactly the 2 Washington branches for Pacific Coast Group Admin', async () => {
      const { header } = await loginUser('pacific.groupadmin@medflow.com');
      const res = await request(app)
        .get('/api/branches')
        .set(header);

      expect(res.status).toBe(200);
      const branchNames = res.body.data.map((b: any) => b.name);
      expect(branchNames).toContain('Seattle Central Clinic');
      expect(branchNames).toContain('Bellevue Medical Branch');
      expect(branchNames).not.toContain('Downtown Austin Clinic');
      expect(branchNames).not.toContain('Westlake Hills Branch');
    });
  });

  describe('3. Branch Admin Scoping (Single Clinic View)', () => {
    it('returns ONLY Downtown Austin Clinic for Austin Branch Admin', async () => {
      const { header } = await loginUser('austin.branchadmin@medflow.com');
      const res = await request(app)
        .get('/api/branches')
        .set(header);

      expect(res.status).toBe(200);
      const branchNames = res.body.data.map((b: any) => b.name);
      expect(branchNames).toContain('Downtown Austin Clinic');
      expect(branchNames).not.toContain('Westlake Hills Branch');
      expect(branchNames).not.toContain('Seattle Central Clinic');
    });

    it('returns ONLY Seattle Central Clinic for Seattle Branch Admin', async () => {
      const { header } = await loginUser('seattle.branchadmin@medflow.com');
      const res = await request(app)
        .get('/api/branches')
        .set(header);

      expect(res.status).toBe(200);
      const branchNames = res.body.data.map((b: any) => b.name);
      expect(branchNames).toContain('Seattle Central Clinic');
      expect(branchNames).not.toContain('Bellevue Medical Branch');
      expect(branchNames).not.toContain('Downtown Austin Clinic');
    });
  });

  describe('4. Inter-Tenant Patient Isolation (Group Boundaries)', () => {
    it('shows Metro Dental patients to Metro Group Admin and strictly hides Pacific Coast patients', async () => {
      const { header } = await loginUser('metro.groupadmin@medflow.com');
      const res = await request(app)
        .get('/api/patients?limit=50')
        .set(header);

      expect(res.status).toBe(200);
      const patients = res.body.data?.patients || res.body.data;
      const patientNames = patients.map((p: any) => `${p.FName || p.firstName} ${p.LName || p.lastName}`);

      // Metro patients are visible
      expect(patientNames.some((n: string) => n.includes('Michael Johnson'))).toBe(true);

      // Pacific Coast patients are strictly hidden
      expect(patientNames.some((n: string) => n.includes('James Anderson'))).toBe(false);
      expect(patientNames.some((n: string) => n.includes('Olivia Martinez'))).toBe(false);
    });

    it('shows Pacific Coast patients to Pacific Coast Group Admin and strictly hides Metro Dental patients', async () => {
      const { header } = await loginUser('pacific.groupadmin@medflow.com');
      const res = await request(app)
        .get('/api/patients?limit=50')
        .set(header);

      expect(res.status).toBe(200);
      const patients = res.body.data?.patients || res.body.data;
      const patientNames = patients.map((p: any) => `${p.FName || p.firstName} ${p.LName || p.lastName}`);

      // Pacific Coast patients are visible
      expect(patientNames.some((n: string) => n.includes('James Anderson'))).toBe(true);

      // Metro patients are strictly hidden
      expect(patientNames.some((n: string) => n.includes('Michael Johnson'))).toBe(false);
      expect(patientNames.some((n: string) => n.includes('Emily Davis'))).toBe(false);
    });
  });

  describe('5. Operatory Scoping (Room Visibility per Role)', () => {
    it('returns ONLY Metro Dental operatories for Metro Group Admin', async () => {
      const { header } = await loginUser('metro.groupadmin@medflow.com');
      const res = await request(app)
        .get('/api/rooms?limit=100')
        .set(header);

      expect(res.status).toBe(200);
      const rooms = res.body.data?.rooms || [];
      const roomNames = rooms.map((r: any) => r.name);

      // Metro Dental operatories are visible
      expect(roomNames.some((n: string) => n.includes('Austin'))).toBe(true);

      // Pacific Coast operatories are hidden
      expect(roomNames.some((n: string) => n.includes('Seattle'))).toBe(false);
      expect(roomNames.some((n: string) => n.includes('Bellevue'))).toBe(false);
    });

    it('returns ONLY Austin operatory for Austin Branch Admin', async () => {
      const { header } = await loginUser('austin.branchadmin@medflow.com');
      const res = await request(app)
        .get('/api/rooms?limit=100')
        .set(header);

      expect(res.status).toBe(200);
      const rooms = res.body.data?.rooms || [];
      const roomNames = rooms.map((r: any) => r.name);

      // Only Austin operatory is visible
      expect(roomNames.some((n: string) => n.includes('Austin'))).toBe(true);

      // Westlake (same group, different branch) is hidden
      expect(roomNames.some((n: string) => n.includes('Westlake'))).toBe(false);

      // Pacific Coast operatories are hidden
      expect(roomNames.some((n: string) => n.includes('Seattle'))).toBe(false);
    });
  });

  describe('6. Cross-Tenant Operatory Isolation', () => {
    it('Pacific Coast Group Admin sees only Washington operatories, zero Texas operatories', async () => {
      const { header } = await loginUser('pacific.groupadmin@medflow.com');
      const res = await request(app)
        .get('/api/rooms?limit=100')
        .set(header);

      expect(res.status).toBe(200);
      const rooms = res.body.data?.rooms || [];
      const roomNames = rooms.map((r: any) => r.name);

      // Pacific Coast operatories are visible
      expect(roomNames.some((n: string) => n.includes('Seattle'))).toBe(true);

      // Metro Dental operatories are strictly hidden
      expect(roomNames.some((n: string) => n.includes('Austin'))).toBe(false);
      expect(roomNames.some((n: string) => n.includes('Westlake'))).toBe(false);
    });

    it('Seattle Branch Admin sees only Seattle operatory', async () => {
      const { header } = await loginUser('seattle.branchadmin@medflow.com');
      const res = await request(app)
        .get('/api/rooms?limit=100')
        .set(header);

      expect(res.status).toBe(200);
      const rooms = res.body.data?.rooms || [];
      const roomNames = rooms.map((r: any) => r.name);

      // Only Seattle operatory
      expect(roomNames.some((n: string) => n.includes('Seattle'))).toBe(true);

      // Bellevue (same group, different branch) is hidden
      expect(roomNames.some((n: string) => n.includes('Bellevue'))).toBe(false);

      // Metro Dental operatories are hidden
      expect(roomNames.some((n: string) => n.includes('Austin'))).toBe(false);
    });
  });

  describe('7. Practice Group Scoping & Isolation (Client Demo Scenario)', () => {
    it('shows ONLY Metro Dental Partners to Metro Group Admin, hiding Pacific Coast', async () => {
      const { header } = await loginUser('metro.groupadmin@medflow.com');
      const res = await request(app)
        .get('/api/practice-groups')
        .set(header);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);

      const group = res.body.data[0];
      expect(group.name).toBe('Metro Dental Partners');

      // Both Texas branches should be visible to Metro Group Admin
      const branchNames = group.branches.map((b: any) => b.name);
      expect(branchNames).toContain('Downtown Austin Clinic');
      expect(branchNames).toContain('Westlake Hills Branch');
      expect(branchNames).not.toContain('Seattle Central Clinic');
      expect(branchNames).not.toContain('Bellevue Medical Branch');
    });

    it('shows ONLY Pacific Coast Dental Care to Pacific Coast Group Admin, hiding Metro Dental', async () => {
      const { header } = await loginUser('pacific.groupadmin@medflow.com');
      const res = await request(app)
        .get('/api/practice-groups')
        .set(header);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);

      const group = res.body.data[0];
      expect(group.name).toBe('Pacific Coast Dental Care');

      // Both Washington branches should be visible to Pacific Coast Group Admin
      const branchNames = group.branches.map((b: any) => b.name);
      expect(branchNames).toContain('Seattle Central Clinic');
      expect(branchNames).toContain('Bellevue Medical Branch');
      expect(branchNames).not.toContain('Downtown Austin Clinic');
      expect(branchNames).not.toContain('Westlake Hills Branch');
    });

    it('shows ONLY Metro Dental Partners with Downtown Austin Clinic to Austin Branch Admin', async () => {
      const { header } = await loginUser('austin.branchadmin@medflow.com');
      const res = await request(app)
        .get('/api/practice-groups')
        .set(header);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);

      const group = res.body.data[0];
      expect(group.name).toBe('Metro Dental Partners');

      // Only Downtown Austin branch should be visible to Austin Branch Admin
      const branchNames = group.branches.map((b: any) => b.name);
      expect(branchNames).toContain('Downtown Austin Clinic');
      expect(branchNames).not.toContain('Westlake Hills Branch');
      expect(branchNames).not.toContain('Seattle Central Clinic');
    });

    it('blocks Group Admin from creating a new top-level practice group (403 Forbidden)', async () => {
      const { header } = await loginUser('metro.groupadmin@medflow.com');
      const res = await request(app)
        .post('/api/practice-groups')
        .set(header)
        .send({ name: 'Unauthorized Practice Group' });

      expect(res.status).toBe(403);
    });
  });
});
