/**
 * Access-version service — bumps a user's tokenVersion so all existing JWTs
 * become stale and force a re-login on the next API call.
 *
 * Interim implementation: wraps getUserMeta / setUserMeta (same pattern as
 * user.service.ts ~L741). Person A will repoint this to a first-class column
 * when the AccessContext middleware lands (~hr 5).
 *
 * Contract: 00-SHARED-CONTRACTS.md §4.2
 *   bumpAccessVersion(userNum: bigint): Promise<void>
 */

import { getUserMeta, setUserMeta } from '../utils/opendental-auth.util';

/**
 * Increment the user's token version, invalidating all current JWTs.
 * Call this after: role assign/remove, permission edits, clinic changes,
 * activate/deactivate, sharing policy changes.
 */
export async function bumpAccessVersion(userNum: bigint): Promise<void> {
  const meta = await getUserMeta(userNum);
  const nextVersion = ((meta.tokenVersion as number) || 0) + 1;
  await setUserMeta(userNum, { ...meta, tokenVersion: nextVersion });
  
  try {
    const { prisma } = await import('../config/db');
    await prisma.user_access_profile.upsert({
      where: { user_num: userNum },
      update: { access_version: { increment: 1 } },
      create: { user_num: userNum, access_version: 1 },
    });
  } catch (error) {
    console.error(`Failed to bump access_version for user ${userNum}:`, error);
  }
}

/**
 * Bump access version for every user attached to a given role.
 * Used when a role's permissions change — all holders must re-authenticate.
 */
export async function bumpAccessVersionForRole(roleId: bigint): Promise<void> {
  // Dynamic import to avoid circular dependency with prisma client
  const { prisma } = await import('../config/db');

  const attachments = await prisma.usergroupattach.findMany({
    where: { UserGroupNum: roleId },
    select: { UserNum: true },
  });

  // UserNum is nullable in the schema; skip orphan rows
  const userNums = attachments
    .map((a) => a.UserNum)
    .filter((u): u is bigint => u !== null);

  await Promise.all(userNums.map((userNum) => bumpAccessVersion(userNum)));
}

/**
 * Bump access version for every user in a practice group.
 * Used when sharing policy changes affect all group members.
 */
export async function bumpAccessVersionForGroup(groupId: number): Promise<void> {
  const { prisma } = await import('../config/db');

  // clinic.GroupNum is a direct FK to practicegroup.id
  const clinics = await prisma.clinic.findMany({
    where: { GroupNum: groupId },
    select: { ClinicNum: true },
  });

  if (clinics.length === 0) return;

  const clinicNums = clinics.map((c) => c.ClinicNum);

  const userClinics = await prisma.userclinic.findMany({
    where: { ClinicNum: { in: clinicNums } },
    select: { UserNum: true },
  });

  // UserNum is nullable in the schema; deduplicate and skip nulls
  const uniqueUserNums = [
    ...new Set(
      userClinics
        .map((uc) => uc.UserNum)
        .filter((u): u is bigint => u !== null)
    ),
  ];

  await Promise.all(uniqueUserNums.map((userNum) => bumpAccessVersion(userNum)));
}
