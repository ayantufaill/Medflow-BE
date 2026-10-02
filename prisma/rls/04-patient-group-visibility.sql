-- Widens read-visibility on the `patient` table only: a patient registered
-- at one branch should be visible from any sibling branch in the same
-- practicegroup, not just their own branch — "shared patient identity".
--
-- Note: an untagged patient (GroupNum IS NULL) is now DENIED to everyone
-- except a '*' caller. See the A0.5a note above patient_read_group.
--
-- Deliberately scoped to `patient` alone, not a blanket change to the
-- shared tenant_isolation policy every other RLS table uses (see
-- 02-policies.sql / 03-policies-remaining.sql) — widening those too would
-- silently expose appointments, claims, payments, etc. across branches,
-- which is a materially bigger decision than "patients are shared" and
-- was not asked for.
--
-- Reads compare directly against the stored patient.GroupNum column (kept
-- in sync with ClinicNum by src/services/patient.service.ts's
-- createPatient/updatePatient — see src/scripts/backfillPatientGroups.ts
-- for the one-off backfill onto pre-existing rows) against
-- app.patient_group_id (set by src/middleware/tenantContext.middleware.ts
-- from the caller's own groupId, for any role, not just Group Admins). This
-- replaced an earlier version of this policy that instead compared
-- ClinicNum against a list of every clinic in the caller's group,
-- reconstructed at request time — GroupNum being a real stored column now
-- makes that per-request reconstruction unnecessary. Writes (INSERT/UPDATE/
-- DELETE) still enforce the narrower app.clinic_ids (the caller's own
-- branch assignment only) — this is a read-visibility grant, not a write
-- grant. A Branch B user can now see a Branch A patient, but still cannot
-- create or edit one while scoped to Branch B.
--
-- Safe to re-run: DROP POLICY IF EXISTS before each CREATE POLICY. Note this
-- file creates FIVE policies, not one — every one of them must be dropped
-- first, or the second run aborts with
-- `policy "patient_write_own" for table "patient" already exists`
-- partway through and the remaining policies are never (re)created.
-- Because the whole file is sent as one simple-query batch, a single failure
-- rolls back the entire file, leaving the table with stale policies.

-- Defensive, idempotent copy of 05-mf-helpers.sql's mf.shared_mode() —
-- applyRls.ts runs files in alphabetical order, and "04-" runs before "05-",
-- but this file's patient_read_group policy (below) now calls
-- mf.shared_mode('IDENTITY'). CREATE POLICY validates the referenced
-- function exists at creation time, not just at query time, so without this
-- the whole file would fail to apply whenever it runs before 05. Not moving
-- or renaming either file — 05-mf-helpers.sql stays the canonical owner of
-- this function; CREATE OR REPLACE here is a no-op once 05 runs right after
-- and redefines the identical body. Keep these two copies in sync if the
-- parsing logic ever changes.
CREATE SCHEMA IF NOT EXISTS mf;

CREATE OR REPLACE FUNCTION mf.shared_mode(category text) RETURNS text
LANGUAGE plpgsql STABLE AS $$
DECLARE
  shared_str text;
  idx integer;
  end_idx integer;
  cat_search text;
  result text;
BEGIN
  shared_str := current_setting('app.shared', true);
  IF shared_str IS NULL OR shared_str = '' THEN
    RETURN 'OWN_BRANCH';
  END IF;

  cat_search := category || ':';
  idx := strpos(shared_str, cat_search);
  IF idx = 0 THEN
    RETURN 'OWN_BRANCH';
  END IF;

  idx := idx + length(cat_search);
  end_idx := strpos(substr(shared_str, idx), ',');

  IF end_idx = 0 THEN
    result := substr(shared_str, idx);
  ELSE
    result := substr(shared_str, idx, end_idx - 1);
  END IF;

  RETURN result;
END;
$$;

-- mf.clinic_ids(): app.clinic_ids parsed to bigint[], with '*'/''/NULL
-- collapsed to NULL instead of being cast.
--
-- WHY A FUNCTION AND NOT AN INLINE CASE
-- -------------------------------------
-- Everywhere else (arms 1 below, 02/03-policies.sql) a CASE around the cast is
-- enough, because those quals are evaluated per-row against the scanned table
-- and CASE really does skip its unused arms. That is NOT enough inside the
-- EXISTS subquery of arm 3: the array expression there is uncorrelated, so it
-- is evaluated once when the SubPlan is set up rather than per row, and the
-- enclosing CASE never gets to guard it. The observed symptom was
-- `invalid input syntax for type bigint: "*"` on EVERY select from patient
-- under a '*' scope — i.e. every seed script (seedBranches.ts was the first to
-- die, which then aborted `npm run seed:all`, failed the compose `seed`
-- service, and tore the whole stack down via api's
-- depends_on: service_completed_successfully) and every superadmin request.
--
-- MUST stay LANGUAGE plpgsql, not sql: a SQL-language function would be
-- inlined by the planner, putting the raw cast straight back into the
-- subquery and reinstating the bug. plpgsql is a black box to the planner.
-- 05-mf-helpers.sql is the canonical owner; this copy exists for the same
-- file-ordering reason as mf.shared_mode above.
CREATE OR REPLACE FUNCTION mf.clinic_ids() RETURNS bigint[]
LANGUAGE plpgsql STABLE AS $$
DECLARE
  raw text;
BEGIN
  raw := current_setting('app.clinic_ids', true);
  -- '*' (superadmin/seed bypass), '' and NULL are all "no id list". They must
  -- never reach the ::bigint[] cast — '*' raises 22P02 and kills the query.
  IF raw IS NULL OR raw = '' OR raw = '*' THEN
    RETURN NULL;  -- = ANY(NULL) is NULL, i.e. "matches nothing", never an error
  END IF;
  RETURN string_to_array(raw, ',')::bigint[];
END;
$$;

DROP POLICY IF EXISTS tenant_isolation ON patient;
DROP POLICY IF EXISTS patient_read_group ON patient;
DROP POLICY IF EXISTS patient_write_own ON patient;
DROP POLICY IF EXISTS patient_update_own ON patient;
DROP POLICY IF EXISTS patient_delete_own ON patient;

-- A0.5a: the "GroupNum" IS NULL escape hatch is REMOVED here.
--
-- It used to grant every caller read access to any patient with no group,
-- which combined with sequential BigInt PatNum values to allow a by-ID read of
-- another practice's records. The patient LIST was never affected (it filters
-- on ClinicNum in the service layer), so this closes a real exposure without
-- changing anything visible in the UI.
--
-- Scope note — this is deliberately the ONLY table changed. The same
-- "ClinicNum IS NULL OR ..." escape hatch still exists in 02-policies.sql and
-- 03-policies-remaining.sql and is intentionally left alone for now, because
-- removing it there would hide large amounts of legitimate untagged data:
--   appointment 1190/1337, procedurelog 388/388, paysplit 322/322,
--   payment 315/315, claimpayment 135/135, operatory 105/106
-- Notably 521 of those appointments belong to patients who ARE tagged, and
-- operatory is the chairs/rooms table, which room.service.ts reads with no
-- clinic filter. Attributing those tables is a separate workstream (A0.5b),
-- not an edit to this file.
--
-- Sharing-gate fix: arm 2 (group-wide visibility) used to be unconditional —
-- any caller whose clinic resolved to a group could read every patient in
-- that group, with no way to turn it off. That contradicts the 8-role
-- model's own design: only group_admin is meant to be cross-branch,
-- everything else (branch_admin, dentist, hygienist, dental_assistant,
-- front_desk, billing, lab) is scoped to its own branch, and this policy
-- didn't check role at all, so all of them got group-wide patient reads
-- regardless. It's also a HIPAA minimum-necessary-access gap, not just an
-- inconsistency — this whole role model was built off a HIPAA compliance
-- review, and an always-on cross-branch patient read undermines that.
-- Gated on mf.shared_mode('IDENTITY') now, same mechanism 06-shared-read.sql
-- already uses for FINANCIAL/IMAGING — defaults OFF (DEFAULT_SHARING_POLICY,
-- access.types.ts), opt-in per practice group. group_admin's own cross-branch
-- reach is unaffected: that comes from clinicIds covering every branch in
-- their group (see PermissionService.getBranchAccess), not from this arm.
--
-- P0 fix: this policy used to be GroupNum-only, with no own-branch fallback.
-- clinic.GroupNum is nullable — any clinic not yet assigned to a
-- practicegroup has GroupNum = NULL, so app.patient_group_id resolves to ''
-- (see src/config/db.ts) for every one of its users, and the GroupNum match
-- always failed. Every patient read for a standalone/ungrouped clinic came
-- back empty. Own-branch visibility (arm 1, ClinicNum against
-- app.clinic_ids) is now unconditional and matches every other RLS table;
-- group-wide visibility (arm 2, GroupNum against app.patient_group_id) is
-- strictly additive on top of it, exactly like 02/03-policies use ClinicNum.
-- '' and '0' are both treated as "no group" — '' is what
-- src/config/db.ts has always serialised a NULL GroupNum to, '0' is the
-- explicit sentinel it now also writes defensively (see comment there) —
-- neither may reach the ::int cast, which would otherwise throw on '' or
-- silently match a real GroupNum of 0.
CREATE POLICY patient_read_group ON patient FOR SELECT
USING (
  -- 1. Always: own-branch visibility. Identical shape to the ClinicNum
  --    check the write policies below (and 02/03-policies.sql) already use —
  --    this alone makes standalone clinics with no group work correctly.
  CASE
    WHEN current_setting('app.clinic_ids', true) = '*' THEN true
    WHEN current_setting('app.clinic_ids', true) IS NULL
         OR current_setting('app.clinic_ids', true) = '' THEN false
    ELSE "ClinicNum" = ANY(string_to_array(current_setting('app.clinic_ids', true), ',')::bigint[])
  END
  OR
  -- 2. Additive: group-wide visibility, only when a real group is resolved
  --    AND the group has opted into IDENTITY sharing (see note above this
  --    policy). Guards '' and '0' explicitly rather than relying on NULLIF —
  --    both are live "no group" values depending on which layer produced
  --    them (see src/config/db.ts), and casting either straight to ::int is
  --    wrong: '' raises, and an unguarded '0' would match a literal
  --    GroupNum = 0.
  CASE
    WHEN current_setting('app.patient_group_id', true) = '*' THEN true
    WHEN current_setting('app.patient_group_id', true) IS NULL
         OR current_setting('app.patient_group_id', true) IN ('', '0') THEN false
    WHEN mf.shared_mode('IDENTITY') != 'GROUP_READ' THEN false
    ELSE "GroupNum" = current_setting('app.patient_group_id', true)::int
  END
  OR
  -- 3. Additive: a one-off, per-patient exception recorded in
  --    patient_branch_grant — read-only, independent of the group's general
  --    IDENTITY sharing setting. Created when Front Desk resolves a
  --    cross-branch duplicate-check match by choosing to use the existing
  --    patient instead of creating a new one (src/services/patient.service.ts's
  --    createPatientBranchGrant). Deliberately NOT mirrored into the write
  --    policies below — this only ever grants read access; editing still
  --    requires being assigned to the patient's own ClinicNum.
  --
  --    Wrapped in CASE for the same reason arms 1 and 2 are: AND does NOT
  --    guarantee left-to-right evaluation in Postgres, so the plain
  --    `NOT IN ('', '*') AND ... ::bigint[]` form this used to have still
  --    attempted the cast for a '*' caller and raised
  --    `invalid input syntax for type bigint: "*"` on every SELECT from
  --    patient — which is every seed script and every superadmin request.
  --    A '*' caller is already allowed by arm 1, and an unset/empty scope
  --    can match no grant, so returning false here loses nothing.
  EXISTS (
    SELECT 1 FROM patient_branch_grant g
    WHERE g.pat_num = "PatNum"
      AND g.granted_clinic_num = ANY(mf.clinic_ids())
  )
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
