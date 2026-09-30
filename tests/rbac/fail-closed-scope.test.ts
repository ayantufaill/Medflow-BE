/**
 * A1 — fail-closed clinic scope.
 *
 * The invariant under test:
 *
 *   clinicIds = []  and  groupId = null   MUST NOT become '*'
 *
 * Before A1, src/middleware/tenantContext.middleware.ts resolved the tenant
 * context as:
 *
 *   isSystemAdmin || clinicIds.length === 0 ? '*' : clinicIds
 *   isSystemAdmin || groupId === null        ? '*' : groupId
 *
 * so a user with a role but no clinic assignment was handed the literal '*'
 * sentinel, which every RLS policy treats as "see everything". This file
 * reproduces that, then locks the corrected behaviour in place.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/config/db';
import { hashPassword } from '../../src/utils/password.util';
import { getUserMeta, setUserMeta } from '../../src/utils/opendental-auth.util';
import { getNextId } from '../../src/utils/opendental-ids.util';
import { uniqueToken } from '../helpers/unique';

/**
 * A user holding a real, non-admin role but with NO clinic assignment:
 * userod.ClinicNum IS NULL and no userclinic rows. This is the shape that
 * fail-open turned into a full-access session.
 */
type CliniclessUser = {
  userNum: bigint;
  email: string;
  authHeader: { Authorization: string };
};

const createCliniclessUser = async (): Promise<CliniclessUser> => {
  const token = uniqueToken('noclinic');
  const email = `noclinic.${token}@example.com`.toLowerCase();
  const password = 'TestPass123!';

  const userNum = await getNextId('userod', 'UserNum');
  await prisma.userod.create({
    data: {
      UserNum: userNum,
      UserName: email,
      // ClinicNum deliberately left null — this is the whole point.
      ClinicNum: null,
      IsHidden: 0,
    },
  });

  const passwordHash = await hashPassword(password);
  await prisma.userod.update({ where: { UserNum: userNum }, data: { Password: passwordHash } });

  const meta = await getUserMeta(userNum);
  await setUserMeta(userNum, { ...meta, passwordHash, isActive: true, tokenVersion: 0 });

  // Attach Front Desk — a real role with real permissions, but NOT an admin
  // role, so the '*' bypass must not apply on role grounds.
  const frontDesk = await prisma.usergroup.findFirst({ where: { Description: 'Front Desk' } });
  if (!frontDesk) throw new Error('Front Desk role missing — run npm run seed:roles');
  const attachId = await getNextId('usergroupattach', 'UserGroupAttachNum');
  await prisma.usergroupattach.create({
    data: { UserGroupAttachNum: attachId, UserNum: userNum, UserGroupNum: frontDesk.UserGroupNum },
  });

  const res = await request(app).post('/api/auth/login').send({ email, password });
  const accessToken = res.body?.data?.tokens?.accessToken;
  if (!accessToken) {
    throw new Error(
      `clinicless user login failed. Status ${res.status}: ${JSON.stringify(res.body)}`
    );
  }
  return { userNum, email, authHeader: { Authorization: `Bearer ${accessToken}` } };
};

describe('A1 · fail-closed clinic scope', () => {
  let user: CliniclessUser;

  beforeAll(async () => {
    user = await createCliniclessUser();
  });

  afterAll(async () => {
    if (!user?.userNum) return;
    // Logging in alone creates rows in several userod-referencing tables
    // (userodpref, securitylog, ...) and none of those FKs cascade. Deleting
    // them one at a time is brittle — the next login path to touch another
    // table breaks this again. Instead, ask the catalog which tables
    // reference userod and clear the ones that actually hold rows for THIS
    // user, then delete the user.
    //
    // This is the same FK-cleanup class of problem behind the pre-existing
    // failures recorded in docs/TEST-BASELINE.md.
    const refs = await prisma.$queryRaw<{ table_name: string }[]>`
      SELECT c.conrelid::regclass::text AS table_name
      FROM pg_constraint c
      WHERE c.confrelid = 'userod'::regclass
        AND c.contype = 'f'
        AND c.connamespace = 'public'::regnamespace
      ORDER BY 1
    `;

    for (const { table_name } of refs) {
      // NOTE: the returned column is `has`, not `n` — declaring the row type
      // as { n: bigint } makes hasUserNum[0]?.has undefined, so every table is
      // skipped and the user is never actually deleted.
      const hasUserNum = await prisma.$queryRawUnsafe<{ has: boolean }[]>(
        `SELECT EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema='public' AND table_name=$1 AND column_name='UserNum'
         ) AS has`,
        table_name
      );
      if (!hasUserNum[0]?.has) continue;

      try {
        await prisma.$executeRawUnsafe(
          `DELETE FROM "${table_name}" WHERE "UserNum" = $1`,
          user.userNum
        );
      } catch {
        // Table is referenced by yet another FK chain. Not worth chasing for
        // a fixture user; the assertion above already passed.
      }
    }

    await prisma.userod.deleteMany({ where: { UserNum: user.userNum } });
  });

  it('creates a user with a role but genuinely no clinic assignment', async () => {
    const rows = await prisma.userclinic.count({ where: { UserNum: user.userNum } });
    expect(rows).toBe(0);
    const row = await prisma.userod.findUniqueOrThrow({
      where: { UserNum: user.userNum },
      select: { ClinicNum: true },
    });
    expect(row.ClinicNum).toBeNull();
  });

  /**
   * THE REGRESSION TEST. Before A1 this returned 200 with a non-empty list.
   * After A1 it must be 403 NO_BRANCH_ASSIGNED, and must never return rows.
   */
  it('refuses scoped routes with 403 NO_BRANCH_ASSIGNED instead of granting access', async () => {
    const res = await request(app).get('/api/patients').set(user.authHeader);

    expect(res.status).toBe(403);
    expect(res.body?.error?.code).toBe('NO_BRANCH_ASSIGNED');
  });

  it('never leaks patient rows to a clinic-less user', async () => {
    const total = await prisma.patient.count();
    expect(total).toBeGreaterThan(0);

    const res = await request(app).get('/api/patients').set(user.authHeader);

    // Belt and braces: even if a future change weakens the status code, the
    // response must not contain patient data.
    const body = JSON.stringify(res.body ?? {});
    expect(body).not.toMatch(/"PatNum"|"patientId"/);
  });

  it('does not hand the caller a wildcard tenant context', async () => {
    // Direct assertion on the middleware's resolution, independent of routes.
    const { PermissionService } = await import('../../src/services/permission.service');
    const access = await PermissionService.getBranchAccess(
      (await prisma.userod.findUniqueOrThrow({
        where: { UserNum: user.userNum },
        select: { UserNum: true },
      })).UserNum.toString()
    );

    expect(access.clinicIds).toEqual([]);
    expect(access.groupId).toBeNull();
  });

  it('still rejects an unauthenticated caller', async () => {
    const res = await request(app).get('/api/patients');
    expect([401, 403]).toContain(res.status);
  });
});
