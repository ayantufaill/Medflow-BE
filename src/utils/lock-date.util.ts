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
    const secLock = await prisma.security_lock.findUnique({
      where: { group_id: access.groupId },
    });
    
    if (secLock) {
      // Check if user is admin if includes_admins is false
      let enforceGroupLock = true;
      if (!secLock.includes_admins) {
        const isAdmin = await prisma.usergroupattach.findFirst({
          where: { 
            UserNum: BigInt(userId),
            usergroup: { Description: 'Admin' }
          }
        });
        if (isAdmin) enforceGroupLock = false;
      }

      if (enforceGroupLock) {
        if (secLock.lock_date) {
          const lockTime = secLock.lock_date.getTime();
          if (itemTime <= lockTime) {
            throw new LockedPeriodError(`Item date is before or on the group lock date`);
          }
        }
        if (secLock.lock_days && secLock.lock_days > 0) {
          const lockTime = now - (secLock.lock_days * 24 * 60 * 60 * 1000);
          if (itemTime <= lockTime) {
            throw new LockedPeriodError(`Item date is older than the group lock days (${secLock.lock_days})`);
          }
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
  const userGroups = await prisma.usergroupattach.findMany({
    where: { UserNum: BigInt(userId) },
    select: { UserGroupNum: true }
  });

  const userGroupNums = userGroups.map(ug => ug.UserGroupNum).filter((ug): ug is bigint => ug !== null);
  
  if (userGroupNums.length > 0) {
    const rolePerms = await prisma.role_permission.findMany({
      where: {
        role_id: { in: userGroupNums },
        permission_key: permissionKey
      }
    });

    let roleLockDays: number | null = null;
    let roleLockDate: Date | null = null;

    for (const perm of rolePerms) {
      if (perm.lock_days !== null) {
        if (roleLockDays === null || perm.lock_days > roleLockDays) {
          roleLockDays = perm.lock_days;
        }
      }
      if (perm.lock_date !== null) {
        if (roleLockDate === null || perm.lock_date < roleLockDate) {
          roleLockDate = perm.lock_date;
        }
      }
    }

    if (roleLockDays !== null && roleLockDays > 0) {
      const lockTime = now - (roleLockDays * 24 * 60 * 60 * 1000);
      if (itemTime <= lockTime) {
        throw new LockedPeriodError(`Item date is locked by role permission (${roleLockDays} days)`);
      }
    }
    if (roleLockDate !== null) {
      if (itemTime <= roleLockDate.getTime()) {
        throw new LockedPeriodError(`Item date is locked by role permission date`);
      }
    }
  }
}
