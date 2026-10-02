import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  getUserPermissions: vi.fn(),
  getBranchAccess: vi.fn(),
  getNewModelRoleForUser: vi.fn(),
}));

vi.mock('../src/services/permission.service', () => ({
  PermissionService: { getUserPermissions: mocks.getUserPermissions, getBranchAccess: mocks.getBranchAccess },
}));
vi.mock('../src/services/rbac.service', () => ({
  getNewModelRoleForUser: mocks.getNewModelRoleForUser,
  getNewModelRoleByKey: vi.fn(),
}));

import { getAssignableRoleRules } from '../src/services/role-elevation.service';

const actor = (roleKey: string | null, permissions: string[] = []) => {
  mocks.getUserPermissions.mockResolvedValue(new Set(permissions));
  mocks.getNewModelRoleForUser.mockResolvedValue(roleKey ? { roleKey } : null);
  mocks.getBranchAccess.mockResolvedValue({ isGroupAdmin: roleKey === 'group_admin', groupClinicIds: [1n], clinicIds: [1n] });
};

describe('getAssignableRoleRules (role picker matches role elevation)', () => {
  beforeEach(() => vi.resetAllMocks());

  it('never offers group_admin, even to a group admin', async () => {
    actor('group_admin');
    const rules = await getAssignableRoleRules('1');
    expect(rules.canAssign).toBe(true);
    expect(rules.blockedRoleKeys.has('group_admin')).toBe(true);
    expect(rules.blockedRoleKeys.has('branch_admin')).toBe(false);
  });

  it('also hides branch_admin and billing from a branch admin', async () => {
    actor('branch_admin');
    const rules = await getAssignableRoleRules('1');
    expect(rules.canAssign).toBe(true);
    for (const key of ['group_admin', 'branch_admin', 'billing']) expect(rules.blockedRoleKeys.has(key)).toBe(true);
    expect(rules.blockedRoleKeys.has('dentist')).toBe(false);
  });

  it('treats a legacy wildcard admin like a group admin', async () => {
    actor(null, ['*']);
    const rules = await getAssignableRoleRules('1');
    expect(rules.canAssign).toBe(true);
    expect(rules.blockedRoleKeys.has('group_admin')).toBe(true);
    expect(rules.blockedRoleKeys.has('billing')).toBe(false);
  });

  it('lets non-admins assign nothing', async () => {
    actor('dentist', ['patients.read']);
    expect((await getAssignableRoleRules('1')).canAssign).toBe(false);
  });
});
