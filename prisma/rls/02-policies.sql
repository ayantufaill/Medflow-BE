-- Row-Level Security policies for ClinicNum-bearing tables. Applied via a
-- reusable template (not hand-copied per table) so every table gets the
-- identical rule.
--
-- Isolation semantics, deliberately mirroring the app-layer convention
-- already used in src/services/branch.service.ts (NOT_HIDDEN_FILTER) /
-- src/middleware/tenantContext.middleware.ts:
--   - ClinicNum IS NULL rows stay visible to everyone (basically all current
--     data — nothing is tagged to a clinic yet; this makes RLS a no-op for
--     today's single-practice deployment, as intended).
--   - current_setting('app.clinic_ids', true) = '*' is an explicit,
--     server-controlled bypass (system Admin, or no scope resolved at all).
--   - Otherwise ClinicNum must be in the caller's SET LOCAL'd clinic id list.
--
-- Because medflow_app is not the table owner (postgres is), plain
-- ENABLE ROW LEVEL SECURITY is sufficient — no FORCE needed. postgres-run
-- migrations/seed scripts (via DIRECT_DATABASE_URL) keep bypassing RLS
-- entirely, as intended.
--
-- Safe to re-run: DROP POLICY IF EXISTS before each CREATE POLICY.

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'patient', 'appointment', 'claim', 'claimproc', 'claimpayment', 'payment'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    -- CASE WHEN (unlike plain OR) guarantees short-circuit evaluation in
    -- Postgres, so the ::bigint[] cast is never attempted when the setting
    -- is '*' or unset/empty — plain OR does NOT guarantee this and was
    -- observed to still attempt (and fail) the cast on '*' in practice.
    EXECUTE format($p$
      CREATE POLICY tenant_isolation ON %I FOR ALL
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
      )
    $p$, t);
  END LOOP;
END
$$;
