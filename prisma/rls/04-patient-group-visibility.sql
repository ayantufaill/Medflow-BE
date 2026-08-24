-- Widens read-visibility on the `patient` table only: a patient registered
-- at one branch should be visible from any sibling branch in the same
-- practicegroup, not just their own branch — "shared patient identity",
-- previously missing entirely (patients carried a branchId but nothing ever
-- widened visibility beyond it, even for staff at a sibling branch).
--
-- Deliberately scoped to `patient` alone, not a blanket change to the
-- shared tenant_isolation policy every other RLS table uses (see
-- 02-policies.sql / 03-policies-remaining.sql) — widening those too would
-- silently expose appointments, claims, payments, etc. across branches,
-- which is a materially bigger decision than "patients are shared" and
-- was not asked for.
--
-- Reads use app.patient_clinic_ids (set by
-- src/middleware/tenantContext.middleware.ts from the caller's
-- groupClinicIds — every clinic in their practicegroup, for any role, not
-- just Group Admins). Writes (INSERT/UPDATE/DELETE) still enforce the
-- narrower app.clinic_ids (the caller's own branch assignment only) — this
-- is a read-visibility grant, not a write grant. A Branch B user can now
-- see a Branch A patient, but still cannot create or edit one while
-- scoped to Branch B.
--
-- Safe to re-run: DROP POLICY IF EXISTS before each CREATE POLICY.

DROP POLICY IF EXISTS tenant_isolation ON patient;

CREATE POLICY patient_read_group ON patient FOR SELECT
USING (
  "ClinicNum" IS NULL
  OR CASE
       WHEN current_setting('app.patient_clinic_ids', true) = '*' THEN true
       WHEN current_setting('app.patient_clinic_ids', true) IS NULL
            OR current_setting('app.patient_clinic_ids', true) = '' THEN false
       ELSE "ClinicNum" = ANY(string_to_array(current_setting('app.patient_clinic_ids', true), ',')::bigint[])
     END
);

CREATE POLICY patient_write_own ON patient FOR INSERT
WITH CHECK (
  "ClinicNum" IS NULL
  OR CASE
       WHEN current_setting('app.clinic_ids', true) = '*' THEN true
       WHEN current_setting('app.clinic_ids', true) IS NULL
            OR current_setting('app.clinic_ids', true) = '' THEN false
       ELSE "ClinicNum" = ANY(string_to_array(current_setting('app.clinic_ids', true), ',')::bigint[])
     END
);

CREATE POLICY patient_update_own ON patient FOR UPDATE
USING (
  "ClinicNum" IS NULL
  OR CASE
       WHEN current_setting('app.clinic_ids', true) = '*' THEN true
       WHEN current_setting('app.clinic_ids', true) IS NULL
            OR current_setting('app.clinic_ids', true) = '' THEN false
       ELSE "ClinicNum" = ANY(string_to_array(current_setting('app.clinic_ids', true), ',')::bigint[])
     END
)
WITH CHECK (
  "ClinicNum" IS NULL
  OR CASE
       WHEN current_setting('app.clinic_ids', true) = '*' THEN true
       WHEN current_setting('app.clinic_ids', true) IS NULL
            OR current_setting('app.clinic_ids', true) = '' THEN false
       ELSE "ClinicNum" = ANY(string_to_array(current_setting('app.clinic_ids', true), ',')::bigint[])
     END
);

CREATE POLICY patient_delete_own ON patient FOR DELETE
USING (
  "ClinicNum" IS NULL
  OR CASE
       WHEN current_setting('app.clinic_ids', true) = '*' THEN true
       WHEN current_setting('app.clinic_ids', true) IS NULL
            OR current_setting('app.clinic_ids', true) = '' THEN false
       ELSE "ClinicNum" = ANY(string_to_array(current_setting('app.clinic_ids', true), ',')::bigint[])
     END
);
