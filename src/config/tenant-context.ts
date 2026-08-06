import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContextValue {
  /**
   * ClinicNums the current request may access, or '*' for unrestricted.
   * '*' is used both for a true system Admin and for callers with no
   * resolved clinic scope at all (mirrors the app-layer's existing
   * "empty scope = unrestricted" convention — see branch.service.ts).
   */
  clinicIds: bigint[] | '*';
}

/**
 * Request-scoped tenant context, consumed by the Prisma client extension in
 * src/config/db.ts to SET LOCAL app.clinic_ids per request for Postgres RLS.
 * Entered by src/middleware/tenantContext.middleware.ts.
 */
export const tenantContextStorage = new AsyncLocalStorage<TenantContextValue>();
