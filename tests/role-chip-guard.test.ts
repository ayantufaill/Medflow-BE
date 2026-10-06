import { describe, it, expect, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({
  hasRole: vi.fn(),
  rules: vi.fn(),
  perms: vi.fn(),
  findRole: vi.fn(),
  meta: vi.fn(),
}));
vi.mock('../src/config/db', () => ({ prisma: { usergroup: { findUnique: m.findRole } } }));
vi.mock('../src/services/permission.service', () => ({ PermissionService: { hasRole: m.hasRole } }));
vi.mock('../src/services/role-elevation.service', () => ({ getAssignableRoleRules: m.rules }));
vi.mock('../src/services/rbac.service', () => ({ resolveEffectivePermissions: m.perms }));
vi.mock('../src/utils/opendental-auth.util', async (orig) => ({ ...(await orig<object>()), getRoleMeta: m.meta }));

import { assertMayChangeRoles } from '../src/services/user.service';

const ROLES: Record<string, { name: string; meta: object }> = {
  '1': { name: 'Super Admin', meta: { permissions: { '*': true } } },
  '2': { name: 'Branch Admin', meta: { permissions: { '*': true } } },
  '3': { name: 'Group Admin', meta: { permissions: { 'patients.read': true } } },
  '4': { name: 'group_admin', meta: { roleKey: 'group_admin', permissions: {} } },
  '5': { name: 'dentist', meta: { roleKey: 'dentist', permissions: { 'clinical-notes.sign': true } } },
  '6': { name: 'billing', meta: { roleKey: 'billing', permissions: {} } },
  '7': { name: 'Biller', meta: { permissions: { 'invoices.delete': true } } },
};

const actor = (kind: 'super' | 'group' | 'branch' | 'staff') => {
  m.hasRole.mockResolvedValue(kind === 'super');
  const blocked = new Set(['group_admin', ...(kind === 'branch' ? ['branch_admin', 'billing'] : [])]);
  m.rules.mockResolvedValue({ canAssign: kind === 'group' || kind === 'branch', blockedRoleKeys: blocked });
  m.perms.mockResolvedValue(new Set(['patients.read', 'users.update']));
};

describe('role chips follow the role picker rules (no privilege escalation)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    m.findRole.mockImplementation(async ({ where }) => ({ Description: ROLES[String(where.UserGroupNum)].name }));
    m.meta.mockImplementation(async (n: bigint) => ROLES[String(n)].meta);
  });

  it('only a Super Admin can grant platform or wildcard roles', async () => {
    actor('group');
    await expect(assertMayChangeRoles('10', [1n])).rejects.toThrow(/Only a Super Admin/);
    await expect(assertMayChangeRoles('10', [2n])).rejects.toThrow(/Only a Super Admin/);
    actor('super');
    await expect(assertMayChangeRoles('10', [1n, 2n])).resolves.toBeUndefined();
  });

  it('nobody but Super Admin hands out Group Admin, legacy or new model', async () => {
    actor('group');
    await expect(assertMayChangeRoles('10', [3n])).rejects.toThrow(/cannot assign or remove/);
    await expect(assertMayChangeRoles('10', [4n])).rejects.toThrow(/cannot assign or remove/);
  });

  it('a group admin can assign clinical roles; a branch admin cannot touch billing', async () => {
    actor('group');
    await expect(assertMayChangeRoles('10', [5n, 6n])).resolves.toBeUndefined();
    actor('branch');
    await expect(assertMayChangeRoles('10', [6n])).rejects.toThrow(/cannot assign or remove/);
  });

  it('legacy roles need every permission the role holds', async () => {
    actor('group');
    await expect(assertMayChangeRoles('10', [7n])).rejects.toThrow(/permissions you don't have/);
  });

  it('non-admins cannot change roles at all', async () => {
    actor('staff');
    await expect(assertMayChangeRoles('10', [5n])).rejects.toThrow(/not allowed/);
  });
});
