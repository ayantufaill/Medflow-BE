import type { JWTPayload, BranchAccess } from './auth.types';

// Tenant context attached by resolveTenant middleware
export interface TenantContext {
  /** The subdomain that identified this branch (e.g. "riverside") */
  subdomain: string;
  /** The physical Postgres schema name for this branch */
  schemaName: string;
  /** The Group this branch belongs to */
  groupId: number;
  /** The Branch ID */
  branchId: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
      userId?: string;
      /** Resolved by resolveTenant middleware — present on tenant-scoped routes */
      tenant?: TenantContext;
      /** Resolved by resolveBranchAccess middleware — present on clinic-scoped routes */
      branchAccess?: BranchAccess;
    }
  }
}

export {};

