-- Scopes `commlog` (clinical notes, exam history, communication log) to the
-- patient's branch. commlog has no ClinicNum, so — like `document` /
-- `PatientImage` in 06-shared-read.sql — visibility is decided through the
-- row's patient.
--
-- Before this file commlog had no RLS at all: any caller holding
-- clinical-notes.read could read any patient's notes by note id or patient id,
-- including patients in another practice group.
--
--   own_branch_fallback  read/write when the patient's ClinicNum is one of the
--                        caller's own branches (app.clinic_ids), or '*'.
--   shared_read          read-only across the caller's group, only when the
--                        group's CLINICAL sharing mode is GROUP_READ and the
--                        patient is not cross_branch_restricted.
--
-- Rows with no patient (PatNum NULL or 0) stay visible: they are not PHI tied
-- to a patient and some app paths write them.
--
-- Safe to re-run: every policy is dropped before it is created.

ALTER TABLE commlog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS own_branch_fallback ON commlog;
CREATE POLICY own_branch_fallback ON commlog FOR ALL
USING (
  commlog."PatNum" IS NULL
  OR commlog."PatNum" = 0
  OR EXISTS (
    SELECT 1 FROM patient p
    WHERE p."PatNum" = commlog."PatNum"
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
  commlog."PatNum" IS NULL
  OR commlog."PatNum" = 0
  OR EXISTS (
    SELECT 1 FROM patient p
    WHERE p."PatNum" = commlog."PatNum"
      AND (
        p."ClinicNum" IS NULL
        OR CASE
             WHEN current_setting('app.clinic_ids', true) = '*' THEN true
             WHEN current_setting('app.clinic_ids', true) IS NULL OR current_setting('app.clinic_ids', true) = '' THEN false
             ELSE p."ClinicNum" = ANY(string_to_array(current_setting('app.clinic_ids', true), ',')::bigint[])
           END
      )
  )
);

DROP POLICY IF EXISTS shared_read ON commlog;
CREATE POLICY shared_read ON commlog FOR SELECT
USING (
  mf.shared_mode('CLINICAL') = 'GROUP_READ'
  AND EXISTS (
    SELECT 1 FROM patient p
    WHERE p."PatNum" = commlog."PatNum"
      -- Text compare, not mf.group_id(): that helper casts app.patient_group_id
      -- to integer and raises 22P02 on the '*' a platform admin carries.
      AND p."GroupNum"::text = current_setting('app.patient_group_id', true)
      AND NOT p.cross_branch_restricted
  )
);

-- Every policy above looks the patient up by PatNum.
CREATE INDEX IF NOT EXISTS idx_commlog_patnum ON commlog ("PatNum");
