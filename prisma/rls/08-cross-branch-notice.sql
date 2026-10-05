-- Masked cross-branch notice (UAT T-VIS-04).
--
-- When a clinician searches for a patient who is registered at another branch
-- of the same practice group, RLS correctly returns nothing. This function lets
-- the API say "a matching patient exists in another branch" without exposing
-- anything about them: it returns only a count.
--
-- SECURITY DEFINER so it can look past RLS; the caller's group and branches
-- are passed in by the API from its own resolved access context (never from
-- the request), and the result is a number, never a row. Only the same group
-- is searched — other groups stay invisible (T-VIS-03). Search terms shorter
-- than 3 characters return 0 to keep enumeration impractical.
--
-- Safe to re-run: CREATE OR REPLACE.

CREATE SCHEMA IF NOT EXISTS mf;
GRANT USAGE ON SCHEMA mf TO medflow_app;

CREATE OR REPLACE FUNCTION mf.count_other_branch_patients(
  p_group_id integer,
  p_own_clinic_ids bigint[],
  p_term text
) RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_group_id IS NULL OR p_term IS NULL OR length(trim(p_term)) < 3 THEN 0
    ELSE (
      SELECT count(*)::integer
      FROM patient p
      WHERE p."GroupNum" = p_group_id
        AND p."PatStatus" <> 2
        AND NOT (p."ClinicNum" = ANY(coalesce(p_own_clinic_ids, ARRAY[]::bigint[])))
        AND (
          (coalesce(p."FName", '') || ' ' || coalesce(p."LName", '')) ILIKE '%' || trim(p_term) || '%'
          OR (coalesce(p."LName", '') || ' ' || coalesce(p."FName", '')) ILIKE '%' || trim(p_term) || '%'
        )
    )
  END;
$$;

REVOKE ALL ON FUNCTION mf.count_other_branch_patients(integer, bigint[], text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mf.count_other_branch_patients(integer, bigint[], text) TO medflow_app;
