import { prisma } from '../config/db';
import { BranchAccess } from '../types/auth.types';

export class LockedPeriodError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LockedPeriodError';
  }
}

/**
 * Checks if an item date is locked by either the group lock date or the user's role-level lock days.
 * @param userId The ID of the user performing the action
 * @param permissionKey The permission being exercised (e.g. 'payments.create')
 * @param itemDate The date of the item being modified
 * @param access The branch access object from req.branchAccess
 */
export async function assertNotLocked(
  userId: string,
  permissionKey: string,
  itemDate: Date,
  access: BranchAccess
): Promise<void> {
  const itemTime = itemDate.getTime();
  const now = Date.now();

  // 1. Group-level lock date
  if (access.groupId) {
    const group = await prisma.practicegroup.findUnique({
      where: { id: access.groupId },
      select: { config: true }
    });
    if (group?.config) {
      const config = group.config as any;
      if (config.lockDate) {
        const lockTime = new Date(config.lockDate).getTime();
        if (itemTime <= lockTime) {
          throw new LockedPeriodError(`Item date is before or on the group lock date (${config.lockDate})`);
        }
      }
      if (config.lockDays) {
        const lockTime = now - (config.lockDays * 24 * 60 * 60 * 1000);
        if (itemTime <= lockTime) {
          throw new LockedPeriodError(`Item date is older than the group lock days (${config.lockDays})`);
        }
      }
    }
  }

  // 2. Global lock date fallback (preference table)
  if (!access.groupId) {
    const globalLockDatePref = await prisma.preference.findFirst({ where: { PrefName: 'SecurityLockDate' } });
    const globalLockDaysPref = await prisma.preference.findFirst({ where: { PrefName: 'SecurityLockDays' } });
    
    if (globalLockDatePref?.ValueString) {
      const lockTime = new Date(globalLockDatePref.ValueString).getTime();
      if (itemTime <= lockTime) {
        throw new LockedPeriodError(`Item date is before the global lock date`);
      }
    }
    if (globalLockDaysPref?.ValueString && !isNaN(Number(globalLockDaysPref.ValueString))) {
      const days = Number(globalLockDaysPref.ValueString);
      if (days > 0) {
        const lockTime = now - (days * 24 * 60 * 60 * 1000);
        if (itemTime <= lockTime) {
          throw new LockedPeriodError(`Item date is older than the global lock days`);
        }
      }
    }
  }

  // 3. Role-level per-permission lock
  // We need to fetch the user's role metas to see if this permission has a lockDays override
  const userGroups = await prisma.usergroupattach.findMany({
    where: { UserNum: BigInt(userId) },
    select: { usergroup: { select: { UserGroupNum: true } } }
  });

  let roleLockDays: number | null = null;
  const userGroupNums = userGroups.map(ug => ug.usergroup?.UserGroupNum).filter(Boolean) as bigint[];

  for (const ugNum of userGroupNums) {
    const pref = await prisma.preference.findFirst({
      where: { PrefName: `usergroup_${ugNum.toString()}_meta` }
    });
    if (pref?.ValueString) {
      try {
        const meta = JSON.parse(pref.ValueString);
        const permValue = meta.permissions?.[permissionKey];
        if (typeof permValue === 'object' && permValue !== null && typeof permValue.lockDays === 'number') {
          // If multiple roles define lockDays for the same permission, we use the most lenient (smallest number)
          // Wait, actually F3 says "stricter of group lock and role-level lock". 
          // If a user has two roles, one says 14 days and one says 30 days, we should probably allow 30 days (most permissive of their roles).
          // But compared to group lock, we use the stricter of (group lock, role lock).
          if (roleLockDays === null || permValue.lockDays > roleLockDays) {
            roleLockDays = permValue.lockDays;
          }
        }
      } catch (e) {
        // Ignore JSON parse errors
      }
    }
  }

  if (roleLockDays !== null && roleLockDays > 0) {
    const lockTime = now - (roleLockDays * 24 * 60 * 60 * 1000);
    if (itemTime <= lockTime) {
      throw new LockedPeriodError(`Item date is locked by role permission (${roleLockDays} days)`);
    }
  }
}
