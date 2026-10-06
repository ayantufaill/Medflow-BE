-- Scopes every patient-owned table that has no ClinicNum of its own (clinical
-- notes in commlog, treatment plans, exams, vitals, allergies, statements,
-- insurance links, ...) to the patient's branch. Like `document` /
-- `PatientImage` in 06-shared-read.sql, visibility is decided through the
-- row's patient.
--
-- Before this file none of these tables had RLS: any caller holding the
-- matching read permission could read any patient's rows by id, including
-- patients in another practice group.
--
--   own_branch_fallback  read/write when the patient's ClinicNum is one of the
--                        caller's own branches (app.clinic_ids), or '*'.
--   shared_read          read-only across the caller's group when the group's
--                        sharing mode for the table's category (CLINICAL or
--                        FINANCIAL) is GROUP_READ and the patient is not
--                        cross_branch_restricted.
--
-- Rows with no patient (PatNum NULL or 0) stay visible: they are not tied to a
-- patient and some app paths write them.
--
-- Not covered on purpose: securitylog (append-only audit, scoped in the API),
-- and system/licensing tables that merely carry a PatNum column.
--
-- Safe to re-run: every policy is dropped before it is created. Tables missing
-- from a given schema are skipped.

DO $$
DECLARE
  t text;
  category text;
  scope_expr text := $e$
    "PatNum" IS NULL
    OR "PatNum" = 0
    OR EXISTS (
      SELECT 1 FROM patient p
      WHERE p."PatNum" = %1$I."PatNum"
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
  clinical_tables text[] := ARRAY[
    'commlog', 'treatplan', 'treatplanparam', 'allergy', 'disease', 'medicationpat',
    'vitalsign', 'vaccinepat', 'perioexam', 'labcase', 'labpanel', 'medlab', 'medicalorder',
    'examtoothstructure', 'examperiodontal', 'examradiographic', 'examairway', 'examdentofacial',
    'examheadneck', 'exammorphological', 'examtmj', 'famaging', 'toothinitial', 'orthochart',
    'orthochartlog', 'orthochartrow', 'orthohardware', 'procnote', 'procmultivisit', 'recall',
    'refattach', 'patientnote', 'patfield', 'patientrace', 'patrestriction', 'popup', 'formpat',
    'question', 'screenpat', 'familyhealth', 'encounter', 'intervention', 'ehramendment',
    'ehrcareplan', 'ehrlab', 'ehrmeasureevent', 'ehrnotperformed', 'ehrpatient', 'ehrsummaryccd',
    'erxlog', 'eform', 'eformfield', 'eclipboardimagecapture', 'mount', 'emailmessage',
    'commoptout', 'phonenumber', 'reactivation', 'shortlist', 'histappointment', 'hl7msg'
  ];
  financial_tables text[] := ARRAY[
    'statement', 'patplan', 'payplan', 'installmentplan', 'repeatcharge', 'discountplansub',
    'inspending', 'etrans', 'xchargetransaction', 'payconnectresponseweb', 'payortype'
  ];
BEGIN
  FOREACH t IN ARRAY clinical_tables || financial_tables LOOP
    category := CASE WHEN t = ANY(financial_tables) THEN 'FINANCIAL' ELSE 'CLINICAL' END;

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

    -- Text compare, not mf.group_id(): that helper casts app.patient_group_id
    -- to integer and raises 22P02 on the '*' a platform admin carries.
    EXECUTE format('DROP POLICY IF EXISTS shared_read ON %I', t);
    EXECUTE format($p$
      CREATE POLICY shared_read ON %1$I FOR SELECT
      USING (
        mf.shared_mode(%2$L) = 'GROUP_READ'
        AND EXISTS (
          SELECT 1 FROM patient p
          WHERE p."PatNum" = %1$I."PatNum"
            AND p."GroupNum"::text = current_setting('app.patient_group_id', true)
            AND NOT p.cross_branch_restricted
        )
      )
    $p$, t, category);

    -- Every policy above looks the patient up by PatNum.
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I ("PatNum")', 'idx_' || t || '_patnum', t);
  END LOOP;
END
$$;
