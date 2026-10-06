import { describe, it, expect } from 'vitest';

import { withLegacyRoleNames, getUserGroups } from '../src/types/user-group.types';

describe('withLegacyRoleNames', () => {
  it('adds the legacy names each new-model role answers to', () => {
    expect(withLegacyRoleNames(['dentist'])).toEqual(expect.arrayContaining(['dentist', 'Provider', 'Doctor']));
    expect(withLegacyRoleNames(['front_desk'])).toEqual(expect.arrayContaining(['Front Desk', 'Receptionist']));
    expect(withLegacyRoleNames(['billing'])).toEqual(expect.arrayContaining(['Biller', 'Billing Staff']));
    expect(withLegacyRoleNames(['branch_admin'])).toContain('Branch Admin');
    expect(withLegacyRoleNames(['group_admin'])).toContain('Group Admin');
  });

  it('leaves legacy and unknown roles untouched, without duplicates', () => {
    expect(withLegacyRoleNames(['Provider'])).toEqual(['Provider']);
    expect(withLegacyRoleNames(['dentist', 'Provider']).filter((r) => r === 'Provider')).toHaveLength(1);
    expect(withLegacyRoleNames(['something_else'])).toEqual(['something_else']);
    expect(withLegacyRoleNames(undefined as unknown as string[])).toEqual([]);
  });

  it('never maps a non-admin role into the admin group', () => {
    for (const role of ['dentist', 'hygienist', 'dental_assistant', 'front_desk', 'billing', 'lab']) {
      expect(getUserGroups(withLegacyRoleNames([role]))).not.toContain('ADMIN_GROUP');
    }
  });
});
