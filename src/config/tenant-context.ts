import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContextValue {
  /**
   * ClinicNums the current request may access, or '*' for unrestricted.
   *
   * As of A1, '*' means EXACTLY ONE thing: a platform Super Admin (later,
   * isPlatformAdmin || accessAllClinics). It is never used as a fallback for
   * an empty or unresolved scope — that fallback granted a user with no
   * clinic assignment access to every practice's data. An empty array is a
   * DENY, answered upstream with 403 NO_BRANCH_ASSIGNED.
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
   * '*' here covers ONLY a platform Super Admin (later, isPlatformAdmin ||
   * accessAllClinics).
   *
   * `null` is distinct from both '*' and 0: it means the caller's clinic
   * could not be resolved to a practicegroup. It is serialised to '' in the
   * RLS GUC, and prisma/rls/04-patient-group-visibility.sql denies on ''
   * (as of A0.5a it also denies when the patient's own GroupNum is null).
   * A caller in that state therefore reads no patients at all, rather than
   * every patient in the system.
   */
  patientGroupId: number | '*' | null;
  userId?: string;
  sharing?: string;
}

/**
 * Request-scoped tenant context, consumed by the Prisma client extension in
 * src/config/db.ts to SET LOCAL app.clinic_ids per request for Postgres RLS.
 * Entered by src/middleware/tenantContext.middleware.ts.
 */
export const tenantContextStorage = new AsyncLocalStorage<TenantContextValue>();
