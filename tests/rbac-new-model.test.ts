import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/config/db';
import { getNextId } from '../src/utils/opendental-ids.util';
import { generateAccessToken } from '../src/utils/jwt.util';
import { resolveEffectivePermissions } from '../src/services/rbac.service';

/**
 * Covers the 6 required scenarios for the new 8(+1)-role RBAC model.
 * Assumes seedNewModelRoles.ts has already run (it's wired into seedAll.ts,
 * which `npm run test:integration` runs before this file).
 */
describe('New RBAC model (group_admin/branch_admin/front_desk/etc.)', () => {
  let groupId: number;
  let branchA: bigint;
  let branchB: bigint;

  let groupAdminUserNum: bigint;
  let branchAdminUserNum: bigint; // scoped to branchA
  let targetInBranchA: bigint;
  let targetInBranchB: bigint;
  let frontDeskUserNum: bigint; // scoped to branchA, for the feature-flag test

  const authHeaderFor = (userNum: bigint) => {
    const token = generateAccessToken({ userId: userNum.toString(), email: `${userNum}@test.local`, tokenVersion: 0 });
    return { Authorization: `Bearer ${token}` };
  };

  const newModelRoleId = async (roleKey: string): Promise<bigint> => {
    const role = await prisma.usergroup.findFirst({ where: { Description: roleKey } });
    if (!role) throw new Error(`New-model role "${roleKey}" not seeded — run seedNewModelRoles.ts first.`);
    return role.UserGroupNum;
  };

  const attachRole = async (userNum: bigint, roleUserGroupNum: bigint) => {
    const attachId = await getNextId('usergroupattach', 'UserGroupAttachNum');
    await prisma.usergroupattach.create({
      data: { UserGroupAttachNum: attachId, UserNum: userNum, UserGroupNum: roleUserGroupNum },
    });
  };

  const createTestUser = async (clinicNum?: bigint): Promise<bigint> => {
    const userNum = await getNextId('userod', 'UserNum');
    await prisma.userod.create({
      data: { UserNum: userNum, UserName: `rbac-test-${userNum}@test.local`, ClinicNum: clinicNum ?? null },
    });
    return userNum;
  };

  beforeAll(async () => {
    const group = await prisma.practicegroup.create({ data: { name: `RBAC Test Group ${Date.now()}` } });
    groupId = group.id;

    branchA = await getNextId('clinic', 'ClinicNum');
    await prisma.clinic.create({ data: { ClinicNum: branchA, Description: 'RBAC Test Branch A', GroupNum: groupId } });

    branchB = await getNextId('clinic', 'ClinicNum');
    await prisma.clinic.create({ data: { ClinicNum: branchB, Description: 'RBAC Test Branch B', GroupNum: groupId } });

    const groupAdminRoleId = await newModelRoleId('group_admin');
    const branchAdminRoleId = await newModelRoleId('branch_admin');
    const frontDeskRoleId = await newModelRoleId('front_desk');

    groupAdminUserNum = await createTestUser(branchA); // home clinic just resolves groupId
    await attachRole(groupAdminUserNum, groupAdminRoleId);

    branchAdminUserNum = await createTestUser(branchA);
    await attachRole(branchAdminUserNum, branchAdminRoleId);
    const bAttachId = await getNextId('userclinic', 'UserClinicNum');
    await prisma.userclinic.create({ data: { UserClinicNum: bAttachId, UserNum: branchAdminUserNum, ClinicNum: branchA } });

    frontDeskUserNum = await createTestUser(branchA);
    await attachRole(frontDeskUserNum, frontDeskRoleId);

    targetInBranchA = await createTestUser(branchA);
    targetInBranchB = await createTestUser(branchB);
  });

  afterAll(async () => {
    // Best-effort cleanup — leaves the shared test DB clean for other suites.
    const userNums = [groupAdminUserNum, branchAdminUserNum, frontDeskUserNum, targetInBranchA, targetInBranchB].filter(Boolean);
    await prisma.usergroupattach.deleteMany({ where: { UserNum: { in: userNums } } });
    await prisma.userclinic.deleteMany({ where: { UserNum: { in: userNums } } });
    for (const userNum of userNums) {
      await prisma.$executeRawUnsafe(`DELETE FROM userodpref WHERE "UserNum" = $1`, userNum);
    }

    // These users make real HTTP calls, so they leave audit rows behind:
    // securityloghash references securitylog, which references userod, so both
    // have to go first, youngest first. writeAudit serializes its inserts
    // behind a pg advisory lock, so one can still commit after the first purge
    // — hence the retry rather than a single pass.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await prisma.securityloghash.deleteMany({
        where: { securitylog: { UserNum: { in: userNums } } },
      });
      await prisma.securitylog.deleteMany({ where: { UserNum: { in: userNums } } });
      try {
        await prisma.userod.deleteMany({ where: { UserNum: { in: userNums } } });
        break;
      } catch (error) {
        if (attempt === 2) throw error;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    await prisma.clinic.deleteMany({ where: { ClinicNum: { in: [branchA, branchB] } } });
    await prisma.practicegroup.deleteMany({ where: { id: groupId } });
  });

  // 1. group_admin of a 1-clinic... (here, N-clinic) group has branch_admin
  // permissions for its clinics without an explicit userclinic assignment.
  it('group_admin inherits branch_admin permissions for every branch in the group', async () => {
    const permissions = await resolveEffectivePermissions(groupAdminUserNum.toString());
    const branchAdminPerms = await resolveEffectivePermissions(branchAdminUserNum.toString());

    expect(permissions.has('appointments.create')).toBe(true); // a branch_admin permission
    for (const perm of branchAdminPerms) {
      expect(permissions.has(perm)).toBe(true);
    }
    // group_admin has no explicit userclinic row for branchB, yet should
    // still resolve it as part of their group's clinic scope.
    const { PermissionService } = await import('../src/services/permission.service');
    const access = await PermissionService.getBranchAccess(groupAdminUserNum.toString());
    expect(access.clinicIds.map(String)).toEqual(expect.arrayContaining([branchA.toString(), branchB.toString()]));
  });

  // 2. group_admin cannot assign group_admin role to another user.
  it('rejects a group_admin granting the group_admin role to someone else', async () => {
    const res = await request(app)
      .patch(`/api/users/${targetInBranchA}/role`)
      .set(authHeaderFor(groupAdminUserNum))
      .send({ roleSlug: 'group_admin' });

    expect(res.status).toBe(403);
  });

  // 3. branch_admin of Branch A cannot change a user's role in Branch B.
  it('rejects a branch_admin changing a role outside their own branch', async () => {
    const res = await request(app)
      .patch(`/api/users/${targetInBranchB}/role`)
      .set(authHeaderFor(branchAdminUserNum))
      .send({ roleSlug: 'dentist', branchId: Number(branchB) });

    expect(res.status).toBe(403);
  });

  it('allows a branch_admin to change a role within their own branch', async () => {
    const res = await request(app)
      .patch(`/api/users/${targetInBranchA}/role`)
      .set(authHeaderFor(branchAdminUserNum))
      .send({ roleSlug: 'dentist', branchId: Number(branchA) });

    expect(res.status).toBe(200);
    expect(res.body.data.newRole).toBe('dentist');
  });

  // 4. Toggling treatment_coordinator ON adds can_present_treatment_plan to
  // front_desk permissions in that branch and NOT in other branches.
  it('scopes can_present_treatment_plan to the branch where the flag is on', async () => {
    await request(app)
      .patch(`/api/branches/${branchA}/features`)
      .set(authHeaderFor(groupAdminUserNum))
      .send({ treatment_coordinator: true })
      .expect(200);

    const inBranchA = await resolveEffectivePermissions(frontDeskUserNum.toString(), { clinicId: branchA });
    const inBranchB = await resolveEffectivePermissions(frontDeskUserNum.toString(), { clinicId: branchB });

    expect(inBranchA.has('can_present_treatment_plan')).toBe(true);
    expect(inBranchB.has('can_present_treatment_plan')).toBe(false);
  });

  // 5. GET /roles?scope=assignable returns 0 platform roles.
  it('GET /roles?scope=assignable returns only new-model, non-platform roles', async () => {
    const res = await request(app)
      .get('/api/roles?scope=assignable')
      .set(authHeaderFor(groupAdminUserNum));

    expect(res.status).toBe(200);
    const roles = res.body.data.roles;
    expect(roles.length).toBeGreaterThan(0);
    for (const role of roles) {
      expect(role.isPlatformRole).not.toBe(true);
      expect(role.isNewModel).toBe(true);
    }
  });

  // 6. A user whose role changes stays signed in with the same JWT and is
  // authorised against the new role on the next request (bumpAccessVersion
  // drops the cached access context instead of revoking the token).
  it('keeps the target user signed in and applies the new role at once when their role changes', async () => {
    const session = authHeaderFor(targetInBranchB);
    await request(app).get('/api/auth/profile').set(session).expect(200);

    await request(app)
      .patch(`/api/users/${targetInBranchB}/role`)
      .set(authHeaderFor(groupAdminUserNum))
      .send({ roleSlug: 'hygienist', branchId: Number(branchB) })
      .expect(200);

    // Product decision: a role change must not log the user out. The same
    // token keeps working and the profile already reflects the new role, so
    // the frontend can refresh the user's screens in place.
    const res = await request(app).get('/api/auth/profile').set(session).expect(200);
    const roleNames = (res.body.data.user.roles ?? []).map((r: { name?: string } | string) => (typeof r === 'string' ? r : r.name));
    expect(roleNames).toContain('hygienist');
  });
});
