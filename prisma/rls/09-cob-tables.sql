-- Row-level security for the coordination-of-benefits tables.
--
-- Two shapes, because the COB tables fall into two groups:
--
--   PATIENT-SCOPED  cob_coverage_order, its positions and flags,
--                   cob_payer_reported_coverage, cob_coverage_detail,
--                   cob_primary_payment_detail, cob_responsibility_ledger,
--                   cob_invoice_liability. These name a patient's insurers
--                   and what they paid, so they are PHI and are scoped the
--                   same way 07-patient-scoped-tables.sql scopes patplan and
--                   statement: visibility follows the patient's branch.
--
--   MASTER DATA     cob_plan_profile, cob_plan_profile_version,
--                   cob_payer_profile. Properties of a plan or a carrier,
--                   shared across every branch exactly as insplan and carrier
--                   are. No RLS, matching the precedent those tables set — a
--                   plan's COB provision is not one branch's secret.
--
-- The patient-scoped tables reach their patient by different routes, which is
-- why this file is three blocks rather than one loop:
--
--   pat_num           direct (cob_coverage_order, cob_payer_reported_coverage,
--                     cob_responsibility_ledger)
--   order_id          through cob_coverage_order (positions, flags)
--   patplan_num       through patplan (cob_coverage_detail)
--   claim_num         through claim (cob_primary_payment_detail)
--   statement_num     through statement (cob_invoice_liability)
--
-- Safe to re-run: every policy is dropped before it is created, and a table
-- missing from the schema is skipped.

-- ── 1. Tables with their own pat_num ──────────────────────────────────────

DO $$
DECLARE
  t text;
  scope_expr text := $e$
    EXISTS (
      SELECT 1 FROM patient p
      WHERE p."PatNum" = %1$I.pat_num
        AND (
          p."ClinicNum" IS NULL
          OR CASE
               WHEN current_setting('app.clinic_ids', true) = '*' THEN true
               WHEN current_setting('app.clinic_ids', true) IS NULL OR current_setting('app.clinic_ids', true) = '' THEN false
               ELSE p."ClinicNum" = ANY(string_to_array(current_setting('app.clinic_ids', true), ',')::bigint[])
             END
        )
    )
  $e$;
  direct_tables text[] := ARRAY[
    'cob_coverage_order', 'cob_payer_reported_coverage', 'cob_responsibility_ledger'
  ];
BEGIN
  FOREACH t IN ARRAY direct_tables LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXCEPTION
      WHEN undefined_table THEN
        CONTINUE;
    END;

    EXECUTE format('DROP POLICY IF EXISTS own_branch_fallback ON %I', t);
    EXECUTE format(
      'CREATE POLICY own_branch_fallback ON %1$I FOR ALL USING (' || scope_expr || ') WITH CHECK (' || scope_expr || ')',
      t
    );

    -- FINANCIAL category: a coverage order decides who is billed, and the
    -- responsibility ledger is money. Matches statement/patplan in file 07.
    EXECUTE format('DROP POLICY IF EXISTS shared_read ON %I', t);
    EXECUTE format($p$
      CREATE POLICY shared_read ON %1$I FOR SELECT
      USING (
        mf.shared_mode('FINANCIAL') = 'GROUP_READ'
        AND EXISTS (
          SELECT 1 FROM patient p
          WHERE p."PatNum" = %1$I.pat_num
            AND p."GroupNum"::text = current_setting('app.patient_group_id', true)
            AND NOT p.cross_branch_restricted
        )
      )
    $p$, t);

    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (pat_num)', 'idx_' || t || '_patnum', t);
  END LOOP;
END
$$;

-- ── 2. Tables that reach their patient through one parent row ─────────────
--
-- Each entry is (table, local column, parent table, parent key, parent's
-- patient column). The parent is always itself scoped by file 07 or by the
-- block above, so a caller who cannot see the parent cannot see these either
-- — but the policy is restated here rather than relied upon, because RLS on
-- the parent does not propagate through a subquery run as the table owner.

DO $$
DECLARE
  spec record;
  scope_expr text;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('cob_coverage_order_position', 'order_id',     'cob_coverage_order', 'id',            'pat_num'),
      ('cob_coverage_order_flag',     'order_id',     'cob_coverage_order', 'id',            'pat_num'),
      ('cob_coverage_detail',         'patplan_num',  'patplan',            'PatPlanNum',    'PatNum'),
      ('cob_primary_payment_detail',  'claim_num',    'claim',              'ClaimNum',      'PatNum'),
      ('cob_invoice_liability',       'statement_num','statement',          'StatementNum',  'PatNum')
    ) AS t(child, child_col, parent, parent_key, parent_pat_col)
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', spec.child);
    EXCEPTION
      WHEN undefined_table THEN
        CONTINUE;
    END;

    scope_expr := format($e$
      EXISTS (
        SELECT 1
        FROM %2$I parent
        JOIN patient p ON p."PatNum" = parent.%5$I
        WHERE parent.%3$I = %1$I.%4$I
          AND (
            p."ClinicNum" IS NULL
            OR CASE
                 WHEN current_setting('app.clinic_ids', true) = '*' THEN true
                 WHEN current_setting('app.clinic_ids', true) IS NULL OR current_setting('app.clinic_ids', true) = '' THEN false
                 ELSE p."ClinicNum" = ANY(string_to_array(current_setting('app.clinic_ids', true), ',')::bigint[])
               END
          )
      )
      -- A parent row whose patient is NULL (or that is gone) stays visible:
      -- some app paths write claims and statements with no PatNum, and
      -- hiding the COB row while the parent is readable would be worse than
      -- showing it.
      OR NOT EXISTS (
        SELECT 1 FROM %2$I parent
        WHERE parent.%3$I = %1$I.%4$I AND parent.%5$I IS NOT NULL
      )
    $e$, spec.child, spec.parent, spec.parent_key, spec.child_col, spec.parent_pat_col);

    EXECUTE format('DROP POLICY IF EXISTS own_branch_fallback ON %I', spec.child);
    EXECUTE format(
      'CREATE POLICY own_branch_fallback ON %I FOR ALL USING (%s) WITH CHECK (%s)',
      spec.child, scope_expr, scope_expr
    );

    EXECUTE format(
      'DROP POLICY IF EXISTS shared_read ON %I', spec.child
    );
    EXECUTE format($p$
      CREATE POLICY shared_read ON %1$I FOR SELECT
      USING (
        mf.shared_mode('FINANCIAL') = 'GROUP_READ'
        AND EXISTS (
          SELECT 1
          FROM %2$I parent
          JOIN patient p ON p."PatNum" = parent.%5$I
          WHERE parent.%3$I = %1$I.%4$I
            AND p."GroupNum"::text = current_setting('app.patient_group_id', true)
            AND NOT p.cross_branch_restricted
        )
      )
    $p$, spec.child, spec.parent, spec.parent_key, spec.child_col, spec.parent_pat_col);

    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I (%I)',
      'idx_' || spec.child || '_' || spec.child_col, spec.child, spec.child_col
    );
  END LOOP;
END
$$;

-- ── 3. Master data: explicitly NOT row-scoped ─────────────────────────────
--
-- Recorded as a statement rather than an omission so a future audit of
-- "which tables have no policy" finds the reasoning instead of a gap.
-- cob_plan_profile / cob_plan_profile_version / cob_payer_profile describe
-- plans and carriers, which insplan and carrier already share across every
-- branch. Access is controlled by the insurance.plan_master.* permissions at
-- the API, exactly as it is for the tables they extend.

-- ── 4. Grants for the application role ────────────────────────────────────
-- 01-app-role.sql grants on all tables that exist when it runs, and sets
-- default privileges for future ones. This re-grant makes the file
-- self-sufficient when it is run on its own against a database where the COB
-- tables were pushed after the role was created.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'medflow_app') THEN
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO medflow_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO medflow_app;
  END IF;
END
$$;
