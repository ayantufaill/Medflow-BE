-- Extends the tenant_isolation policy (see 02-policies.sql for the full
-- rationale) to every remaining ClinicNum-bearing table, now that every
-- route touching one of these tables has resolveBranchAccess +
-- enterTenantContext wired (see src/routes/*.ts).
--
-- Deliberately EXCLUDED: userod, userodpref, userclinic. These are read
-- during/before authentication itself (resolving the caller's identity and
-- their branch access in the first place) — before any tenant context could
-- possibly exist yet. Enabling RLS on them would be a chicken-and-egg
-- lockout, not a safety net.
--
-- Safe to re-run: DROP POLICY IF EXISTS before each CREATE POLICY.

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'adjustment', 'alertitem', 'alertsub', 'apptgeneralmessagesent',
    'apptnewpatthankyousent', 'apptreminderrule', 'apptremindersent',
    'apptthankyousent', 'apptview', 'asapcomm', 'branding',
    'carecreditwebresponse', 'clearinghouse', 'clinicerx', 'clinicpref',
    'clockevent', 'computerpref', 'confirmationrequest', 'creditcard',
    'dunning', 'ebill', 'eclipboardimagecapturedef', 'eclipboardsheetdef',
    'emailhostingtemplate', 'emailsecure', 'emailsecureattach', 'erouting',
    'eroutingdef', 'fee', 'hieclinic', 'mobileappdevice',
    'mobilebrandingprofile', 'msgtopaysent', 'operatory', 'orthocase',
    'patientportalinvite', 'payplancharge', 'payplantemplate', 'paysplit',
    'payterminal', 'pharmclinic', 'procedurelog', 'proctp',
    'programproperty', 'promotion', 'promotionlog', 'providerclinic',
    'providercliniclink', 'recurringcharge', 'referralcliniclink', 'rxpat',
    'schedule', 'sheet', 'smsfrommobile', 'smsphone', 'smstomobile',
    'timeadjust', 'tsitranslog', 'userodapptview', 'webschedcarrierrule',
    'webschedrecall', 'xwebresponse'
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
