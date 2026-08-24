import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContextValue {
  /**
   * ClinicNums the current request may access, or '*' for unrestricted.
   * '*' is used both for a true system Admin and for callers with no
   * resolved clinic scope at all (mirrors the app-layer's existing
   * "empty scope = unrestricted" convention — see branch.service.ts).
   */
  clinicIds: bigint[] | '*';
  /**
   * Wider than clinicIds: every ClinicNum in the caller's practicegroup,
   * regardless of role — read-visibility scope for the `patient` table only
   * (see prisma/rls/04-patient-group-visibility.sql), so a patient
   * registered at one branch is visible from any sibling branch in the same
   * group. Writes to patient still enforce clinicIds (own branch only) —
   * deliberately not widened, this is read-visibility, not a write grant.
   */
  patientClinicIds: bigint[] | '*';
}

/**
 * Request-scoped tenant context, consumed by the Prisma client extension in
 * src/config/db.ts to SET LOCAL app.clinic_ids per request for Postgres RLS.
 * Entered by src/middleware/tenantContext.middleware.ts.
 */
export const tenantContextStorage = new AsyncLocalStorage<TenantContextValue>();
