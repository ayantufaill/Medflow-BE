export const normalizeGroupNumber = (value: unknown): string => String(value ?? '').trim().toUpperCase();
export const normalizeGroupName = (value: unknown): string => String(value ?? '').trim();

export const validateGroupFields = (input: {
  groupNumber?: unknown;
  groupName?: unknown;
}): { groupNumber: string; groupName: string; errors: Record<string, string> } => {
  const groupNumber = normalizeGroupNumber(input.groupNumber);
  const groupName = normalizeGroupName(input.groupName);
  const errors: Record<string, string> = {};

  if (!groupNumber) {
    errors.groupNumber = 'Group Number is required';
  } else if (groupNumber.length < 3 || groupNumber.length > 20) {
    errors.groupNumber = 'Group Number must be 3 to 20 characters';
  } else if (!/^[A-Z0-9-]+$/.test(groupNumber) ||
    groupNumber.startsWith('-') || groupNumber.endsWith('-') || groupNumber.includes('--')) {
    errors.groupNumber = 'Group Number may contain letters, numbers, and single inner hyphens';
  }
  if (!groupName) {
    errors.groupName = 'Group Name is required';
  } else if (groupName.length < 2 || groupName.length > 50) {
    errors.groupName = 'Group Name must be 2 to 50 characters';
  } else if (!/^[A-Za-z0-9 .&,-]+$/.test(groupName)) {
    errors.groupName = 'Group Name contains unsupported characters';
  }
  return { groupNumber, groupName, errors };
};
