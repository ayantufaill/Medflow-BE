import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/config/db';
import { practiceGroupService } from '../../src/services/practice-group.service';
import { hashPassword } from '../../src/utils/password.util';
import { getUserMeta, setUserMeta } from '../../src/utils/opendental-auth.util';
import { getNextId } from '../../src/utils/opendental-ids.util';
import { uniqueToken } from './unique';

export type Tenant = {
  groupId: number;
  clinicId: string;
  userId: string;
  email: string;
  authHeader: { Authorization: string };
};

/**
 * Provisions a brand-new practice group + branch + logged-in Group Admin, entirely
 * outside the real onboarding UI's password flow — used by every cross-tenant
 * isolation test as "Tenant B" (or A) to prove a caller scoped to one group can't
 * reach another's data. Goes through the real service calls (createGroup/
 * createBranch/createGroupAdmin) so it exercises the same code path production
 * onboarding does, then activates the account + sets a known password directly
 * (the real flow emails a verification link, which tests can't click).
 */
export async function createTenant(prefix = 'tenant'): Promise<Tenant> {
  const token = uniqueToken(prefix);
  const group = await practiceGroupService.createGroup({ name: `Tenant ${token}` });
  const branch = await practiceGroupService.createBranch(group.id, { name: `Branch ${token}` });

  const email = `groupadmin.${token}@example.com`.toLowerCase();
  const password = 'TestPass123!';

  await practiceGroupService.createGroupAdmin(
    group.id,
    { email, firstName: 'Group', lastName: token, clinicId: branch.id },
    'system'
  );

  const user = await prisma.userod.findFirstOrThrow({ where: { UserName: email } });
  const passwordHash = await hashPassword(password);
  await prisma.userod.update({
    where: { UserNum: user.UserNum },
    data: { Password: passwordHash, IsHidden: 0 },
  });
  const meta = await getUserMeta(user.UserNum);
  await setUserMeta(user.UserNum, { ...meta, passwordHash, isActive: true });

  const loginRes = await request(app).post('/api/auth/login').send({ email, password });
  const authToken = loginRes.body?.data?.tokens?.accessToken;
  if (!authToken) {
    throw new Error(
      `createTenant: failed to log in as new Group Admin. Status ${loginRes.status}: ${JSON.stringify(loginRes.body)}`
    );
  }

  return {
    groupId: group.id,
    clinicId: branch.id,
    userId: user.UserNum.toString(),
    email,
    authHeader: { Authorization: `Bearer ${authToken}` },
  };
}

/**
 * A true platform operator — holds 'Super Admin' (which, unlike the per-practice
 * 'Admin' role, carries 'platform:manage_practice_groups' as an explicit named
 * permission rather than via the '*' wildcard) so assertCanOperateOnGroup's
 * platform-permission branch actually fires. Also attached to the literal
 * 'Admin' role, since practice-group.routes.ts gates on requireRoles('Admin')
 * exactly and has no 'Super Admin' allowance yet (a separate, already-flagged,
 * out-of-scope gap in the router itself — see its own top-of-file comment) —
 * without it this fixture couldn't even reach the controller to prove anything.
 */
export async function createSuperAdminAuthHeader(): Promise<{ Authorization: string }> {
  const token = uniqueToken('superadmin');
  const superAdminRole = await prisma.usergroup.findFirstOrThrow({ where: { Description: 'Super Admin' } });
  const adminRole = await prisma.usergroup.findFirstOrThrow({ where: { Description: 'Admin' } });

  const email = `superadmin.${token}@example.com`.toLowerCase();
  const password = 'TestPass123!';
  const passwordHash = await hashPassword(password);

  const nextUserId = await getNextId('userod', 'UserNum');
  const user = await prisma.userod.create({
    data: { UserNum: nextUserId, UserName: email, Password: passwordHash, IsHidden: 0 },
  });
  await setUserMeta(user.UserNum, {
    email,
    passwordHash,
    firstName: 'Super',
    lastName: 'Admin',
    isActive: true,
    tokenVersion: 0,
  });

  for (const role of [superAdminRole, adminRole]) {
    const attachId = await getNextId('usergroupattach', 'UserGroupAttachNum');
    await prisma.usergroupattach.create({
      data: { UserGroupAttachNum: attachId, UserNum: user.UserNum, UserGroupNum: role.UserGroupNum },
    });
  }

  const loginRes = await request(app).post('/api/auth/login').send({ email, password });
  const authToken = loginRes.body?.data?.tokens?.accessToken;
  if (!authToken) {
    throw new Error(
      `createSuperAdminAuthHeader: failed to log in. Status ${loginRes.status}: ${JSON.stringify(loginRes.body)}`
    );
  }

  return { Authorization: `Bearer ${authToken}` };
}

/**
 * Creates a plain member user (default role 'Staff') assigned via userclinic to
 * the given tenant's clinic — a target for cross-tenant user-management tests,
 * not a caller (no login needed, so no password/verification setup here).
 */
export async function createTenantMember(
  tenant: Tenant,
  roleName = 'Staff'
): Promise<{ userId: string; email: string }> {
  const token = uniqueToken('member');
  const role = await prisma.usergroup.findFirstOrThrow({ where: { Description: roleName } });

  const email = `member.${token}@example.com`.toLowerCase();
  const passwordHash = await hashPassword('TestPass123!');

  const nextUserId = await getNextId('userod', 'UserNum');
  const user = await prisma.userod.create({
    data: { UserNum: nextUserId, UserName: email, Password: passwordHash, IsHidden: 0 },
  });
  await setUserMeta(user.UserNum, {
    email,
    passwordHash,
    firstName: 'Tenant',
    lastName: 'Member',
    isActive: true,
    tokenVersion: 0,
  });

  const attachId = await getNextId('usergroupattach', 'UserGroupAttachNum');
  await prisma.usergroupattach.create({
    data: { UserGroupAttachNum: attachId, UserNum: user.UserNum, UserGroupNum: role.UserGroupNum },
  });

  const userClinicNum = await getNextId('userclinic', 'UserClinicNum');
  await prisma.userclinic.create({
    data: { UserClinicNum: userClinicNum, UserNum: user.UserNum, ClinicNum: BigInt(tenant.clinicId) },
  });

  return { userId: user.UserNum.toString(), email };
}

/**
 * Same shape as createTenant(), but the logged-in caller holds the literal
 * 'Admin' role (permissions: { '*': true }) scoped, via userclinic, to a single
 * clinic in a brand-new group — rather than 'Group Admin'. Several routers in
 * this app gate on requireRoles('Admin') exactly (not 'Group Admin'), so this is
 * the fixture that actually represents "a per-practice Admin from Tenant A" for
 * routes like practice-group.routes.ts. Built by hand (not via userService) so no
 * email-verification round trip is needed.
 */
export async function createTenantAdmin(prefix = 'admintenant'): Promise<Tenant> {
  const token = uniqueToken(prefix);
  const group = await practiceGroupService.createGroup({ name: `Tenant ${token}` });
  const branch = await practiceGroupService.createBranch(group.id, { name: `Branch ${token}` });

  const adminRole = await prisma.usergroup.findFirstOrThrow({ where: { Description: 'Admin' } });

  const email = `admin.${token}@example.com`.toLowerCase();
  const password = 'TestPass123!';
  const passwordHash = await hashPassword(password);

  const nextUserId = await getNextId('userod', 'UserNum');
  const user = await prisma.userod.create({
    data: { UserNum: nextUserId, UserName: email, Password: passwordHash, IsHidden: 0 },
  });
  await setUserMeta(user.UserNum, {
    email,
    passwordHash,
    firstName: 'Tenant',
    lastName: 'Admin',
    isActive: true,
    tokenVersion: 0,
  });

  const attachId = await getNextId('usergroupattach', 'UserGroupAttachNum');
  await prisma.usergroupattach.create({
    data: { UserGroupAttachNum: attachId, UserNum: user.UserNum, UserGroupNum: adminRole.UserGroupNum },
  });

  const userClinicNum = await getNextId('userclinic', 'UserClinicNum');
  await prisma.userclinic.create({
    data: { UserClinicNum: userClinicNum, UserNum: user.UserNum, ClinicNum: BigInt(branch.id) },
  });

  const loginRes = await request(app).post('/api/auth/login').send({ email, password });
  const authToken = loginRes.body?.data?.tokens?.accessToken;
  if (!authToken) {
    throw new Error(
      `createTenantAdmin: failed to log in. Status ${loginRes.status}: ${JSON.stringify(loginRes.body)}`
    );
  }

  return {
    groupId: group.id,
    clinicId: branch.id,
    userId: user.UserNum.toString(),
    email,
    authHeader: { Authorization: `Bearer ${authToken}` },
  };
}
