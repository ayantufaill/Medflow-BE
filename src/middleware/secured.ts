import type { RequestHandler } from 'express';
import { authenticate } from './auth.middleware';
import { resolveBranchAccess } from './branchAccess.middleware';
import { enterTenantContext } from './tenantContext.middleware';
import { requireAllPermissions, requireAnyPermission, requirePermission } from './permission.middleware';

interface SecuredOptions {
  permission?: string;
  anyOf?: string[];
  allOf?: string[];
  scope?: 'branch' | 'reference' | 'none';
}

export const secured = ({
  permission,
  anyOf,
  allOf,
  scope = 'branch',
}: SecuredOptions): RequestHandler[] => {
  const chain: RequestHandler[] = [authenticate];

  if (permission) chain.push(requirePermission(permission));
  if (anyOf?.length) chain.push(requireAnyPermission(...anyOf));
  if (allOf?.length) chain.push(requireAllPermissions(...allOf));

  if (scope === 'branch') {
    chain.push(resolveBranchAccess, enterTenantContext);
  }

  return chain;
};
