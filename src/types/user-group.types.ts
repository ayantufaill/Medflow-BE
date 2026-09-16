export type UserGroup = 'ADMIN_GROUP' | 'CLINICAL_GROUP' | 'OPERATIONS_GROUP' | 'PATIENT_GROUP';

export const USER_GROUPS: Record<UserGroup, string[]> = {
  ADMIN_GROUP: ['Super Admin', 'Group Admin', 'Branch Admin', 'Admin'],
  CLINICAL_GROUP: ['Provider', 'Doctor', 'Hygienist', 'Assistant', 'Dental Assistant', 'Clinical Staff'],
  OPERATIONS_GROUP: ['Front Desk', 'Receptionist', 'Biller', 'Billing Staff', 'Lab', 'Lab Technician'],
  PATIENT_GROUP: ['Patient'],
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
