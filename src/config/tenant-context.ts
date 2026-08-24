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
   * The caller's own practicegroup id, or '*' for unrestricted — read-
   * visibility scope for the `patient` table only (see
   * prisma/rls/04-patient-group-visibility.sql), matched directly against
   * the stored patient.GroupNum column. Wider than clinicIds and role-
   * independent: any caller in a group sees every patient in that group, so
   * a patient registered at one branch is visible from any sibling branch.
   * Writes to patient still enforce clinicIds (own branch only) —
   * deliberately not widened, this is read-visibility, not a write grant.
   *
   * '*' here covers both a true system Admin and any caller with no
   * resolvable group (no clinic assignment at all, or assigned to a clinic
   * not yet linked to a practicegroup) — same "empty scope = unrestricted"
   * convention clinicIds uses for practices not yet onboarded onto
   * branches/groups.
   */
  patientGroupId: number | '*';
}

/**
 * Request-scoped tenant context, consumed by the Prisma client extension in
 * src/config/db.ts to SET LOCAL app.clinic_ids per request for Postgres RLS.
 * Entered by src/middleware/tenantContext.middleware.ts.
 */
export const tenantContextStorage = new AsyncLocalStorage<TenantContextValue>();
