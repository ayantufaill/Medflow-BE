export type UserGroup = 'ADMIN_GROUP' | 'CLINICAL_GROUP' | 'OPERATIONS_GROUP' | 'PATIENT_GROUP';

// Each group lists BOTH the legacy display names ('Group Admin') and the
// new-model role keys seeded by src/scripts/seedNewModelRoles.ts
// ('group_admin'), because usergroup.Description stores whichever the account
// was created with. Without the new-model keys here a group_admin resolves to
// no group at all, and every requireRoles / requireGroups gate answers 403.
export const USER_GROUPS: Record<UserGroup, string[]> = {
  ADMIN_GROUP: [
    'Super Admin', 'Group Admin', 'Branch Admin', 'Admin',
    'group_admin', 'branch_admin',
  ],
  CLINICAL_GROUP: [
    'Provider', 'Doctor', 'Hygienist', 'Assistant', 'Dental Assistant', 'Clinical Staff',
    'dentist', 'hygienist', 'dental_assistant',
  ],
  OPERATIONS_GROUP: [
    'Front Desk', 'Receptionist', 'Biller', 'Billing Staff', 'Lab', 'Lab Technician',
    'front_desk', 'billing', 'lab',
  ],
  PATIENT_GROUP: ['Patient', 'patient'],
};

/**
 * Legacy role names each new-model role key answers to. Many routes still gate
 * on specific legacy names (e.g. requireRoles('Provider', 'Front Desk', ...)),
 * so without this a 'dentist' or 'front_desk' account was refused by them
 * despite holding the right permissions. Name checks only — what a role can
 * actually do still comes from its own permission set.
 */
export const NEW_MODEL_ROLE_EQUIVALENTS: Record<string, string[]> = {
  group_admin: ['Group Admin'],
  branch_admin: ['Branch Admin'],
  dentist: ['Provider', 'Doctor'],
  hygienist: ['Hygienist'],
  dental_assistant: ['Dental Assistant', 'Assistant'],
  front_desk: ['Front Desk', 'Receptionist'],
  billing: ['Biller', 'Billing Staff'],
  lab: ['Lab', 'Lab Technician'],
};

/** The user's role names plus the legacy names their new-model roles answer to. */
export const withLegacyRoleNames = (roles: string[]): string[] => {
  if (!Array.isArray(roles)) return [];
  const expanded = new Set(roles);
  for (const role of roles) {
    for (const legacy of NEW_MODEL_ROLE_EQUIVALENTS[role] ?? []) expanded.add(legacy);
  }
  return Array.from(expanded);
};

export const ROLE_TO_GROUP_MAP: Record<string, UserGroup> = Object.entries(USER_GROUPS).reduce(
  (acc, [group, roles]) => {
    for (const role of roles) {
      acc[role] = group as UserGroup;
    }
    return acc;
  },
  {} as Record<string, UserGroup>
);

export const getUserGroups = (roles: string[]): UserGroup[] => {
  if (!roles || !Array.isArray(roles)) return [];
  const groups = new Set<UserGroup>();

  for (const role of roles) {
    const group = ROLE_TO_GROUP_MAP[role];
    if (group) {
      groups.add(group);
    }
  }

  return Array.from(groups);
};

export const isUserInGroup = (roles: string[], targetGroup: UserGroup): boolean => {
  const groups = getUserGroups(roles);
  return groups.includes(targetGroup);
};

export const isUserInAnyGroup = (roles: string[], targetGroups: UserGroup[]): boolean => {
  const groups = getUserGroups(roles);
  return targetGroups.some((tg) => groups.includes(tg));
};
