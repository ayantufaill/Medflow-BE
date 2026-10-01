-- A separate permissive FOR SELECT policy; Postgres ORs permissive policies together.

DO $$
DECLARE
  t text;
  financial_tables text[] := ARRAY['payment', 'paysplit', 'adjustment', 'claim', 'claimproc', 'payplancharge'];
  imaging_tables text[] := ARRAY['document', 'PatientImage'];
BEGIN
  -- FINANCIAL policies
  FOREACH t IN ARRAY financial_tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS shared_read ON %I', t);
    EXECUTE format($p$
      CREATE POLICY shared_read ON %I FOR SELECT
      USING (
        mf.shared_mode('FINANCIAL') = 'GROUP_READ'
        AND EXISTS (
          SELECT 1 FROM patient p
          WHERE p."PatNum" = %I."PatNum"
            AND p."GroupNum" = mf.group_id()
            AND NOT p.cross_branch_restricted
        )
      )
    $p$, t, t);
  END LOOP;

  -- IMAGING policies
  FOREACH t IN ARRAY imaging_tables LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXCEPTION
      WHEN undefined_table THEN
        -- Ignore if table does not exist in schema yet
        CONTINUE;
    END;

    EXECUTE format('DROP POLICY IF EXISTS shared_read ON %I', t);
    EXECUTE format($p$
      CREATE POLICY shared_read ON %I FOR SELECT
      USING (
        mf.shared_mode('IMAGING') = 'GROUP_READ'
        AND EXISTS (
          SELECT 1 FROM patient p
          WHERE p."PatNum" = %I."PatNum"
            AND p."GroupNum" = mf.group_id()
            AND NOT p.cross_branch_restricted
        )
      )
    $p$, t, t);
    
    -- For imaging tables, we must also add an OWN_BRANCH policy first, 
    -- otherwise enabling RLS locks everyone out entirely since they don't have ClinicNum.
    EXECUTE format('DROP POLICY IF EXISTS own_branch_fallback ON %I', t);
    EXECUTE format($p$
      CREATE POLICY own_branch_fallback ON %I FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM patient p
          WHERE p."PatNum" = %I."PatNum"
            AND (
              p."ClinicNum" IS NULL
              OR CASE
                   WHEN current_setting('app.clinic_ids', true) = '*' THEN true
                   WHEN current_setting('app.clinic_ids', true) IS NULL OR current_setting('app.clinic_ids', true) = '' THEN false
                   ELSE p."ClinicNum" = ANY(string_to_array(current_setting('app.clinic_ids', true), ',')::bigint[])
                 END
            )
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM patient p
          WHERE p."PatNum" = %I."PatNum"
            AND (
              p."ClinicNum" IS NULL
              OR CASE
                   WHEN current_setting('app.clinic_ids', true) = '*' THEN true
                   WHEN current_setting('app.clinic_ids', true) IS NULL OR current_setting('app.clinic_ids', true) = '' THEN false
                   ELSE p."ClinicNum" = ANY(string_to_array(current_setting('app.clinic_ids', true), ',')::bigint[])
                 END
            )
        )
      )
    $p$, t, t, t);
  END LOOP;
END
$$;
