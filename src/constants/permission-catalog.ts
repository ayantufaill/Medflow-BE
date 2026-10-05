import { PERMISSIONS } from './permissions';

export interface PermissionCatalogItem {
  key: string;
  module: string;
  description: string;
  isSensitive: boolean;
  lockDateAware: boolean;
}

const moduleName = (key: string): string => {
  const [prefix = 'system'] = key.split('.');
  return prefix
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const describe = (key: string): string => {
  const [resource = key, action = 'access'] = key.split('.');
  return `${action.replace(/[-_]/g, ' ')} ${resource.replace(/[-_]/g, ' ')}`;
};

const baseKeys = Object.values(PERMISSIONS).flatMap((group) => Object.values(group));

const requiredKeys = [
  'adjustments.create',
  'adjustments.delete',
  'adjustments.read',
  'adjustments.update',
  'audiences.read',
  'audiences.write',
  'authorizations.write',
  'billing.write',
  'claims.write',
  'deposits.create',
  'deposits.read',
  'deposits.update',
  'deposits.delete',
  'payment-plans.create',
  'payment-plans.read',
  'payment-plans.update',
  'reports.write',
  'settings.read',
  'settings.update',
  'security.admin',
  'security.audit.view',
  'security.lock_date.manage',
  'sharing.manage',
  'sharing.break_glass',
  'treatment-plans.read',
  'treatment-plans.create',
  'treatment-plans.update',
  'treatment-plans.delete',
  'platform:manage_practice_groups',
  'clinical.cross_branch.view',
  'financial.cross_branch.view',
  'patient.search.unrestricted',
  'patient.ssn.view',
  'patient.dob.view',
  'reports.access',
  'reports.prod_income.all_providers',
];

const sensitiveFragments = [
  'delete',
  'manage',
  'admin',
  'audit',
  'ssn',
  'dob',
  'cross_branch',
  'break_glass',
];

const lockDatePrefixes = ['payments.', 'adjustments.', 'claims.', 'invoices.'];

export const PERMISSION_CATALOG: PermissionCatalogItem[] = Array.from(
  new Set([...baseKeys, ...requiredKeys])
)
  .sort()
  .map((key) => ({
    key,
    module: moduleName(key),
    description: describe(key),
    isSensitive: sensitiveFragments.some((fragment) => key.includes(fragment)),
    lockDateAware: lockDatePrefixes.some((prefix) => key.startsWith(prefix)),
  }));

export const PERMISSION_MODULES = Object.values(
  PERMISSION_CATALOG.reduce<Record<string, { module: string; permissions: PermissionCatalogItem[] }>>(
    (acc, permission) => {
      acc[permission.module] ??= { module: permission.module, permissions: [] };
      acc[permission.module].permissions.push(permission);
      return acc;
    },
    {}
  )
).sort((a, b) => a.module.localeCompare(b.module));
