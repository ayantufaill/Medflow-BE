CREATE SCHEMA IF NOT EXISTS mf;

-- Policy expressions are evaluated with the privileges of the *querying* role,
-- not the policy owner, so medflow_app must be able to reach these helpers.
-- A freshly created schema grants nothing to PUBLIC, and 01-app-role.sql only
-- covers schema `public` — without this, every policy calling mf.* fails with
-- "permission denied for schema mf". Idempotent; repeated in 04 and 05 because
-- either may run first against a database that has neither.
GRANT USAGE ON SCHEMA mf TO medflow_app;

CREATE OR REPLACE FUNCTION mf.group_id() RETURNS integer
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.patient_group_id', true), '')::integer;
$$;

CREATE OR REPLACE FUNCTION mf.user_id() RETURNS bigint
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::bigint;
$$;

-- app.clinic_ids parsed to bigint[]; '*' (bypass), '' and NULL all collapse to
-- NULL ("matches nothing") rather than reaching the cast, which raises 22P02
-- on '*'. MUST stay plpgsql — a LANGUAGE sql body would be inlined by the
-- planner and the cast would escape its guard. See the long note in
-- 04-patient-group-visibility.sql, which keeps a defensive copy of this.
CREATE OR REPLACE FUNCTION mf.clinic_ids() RETURNS bigint[]
LANGUAGE plpgsql STABLE AS $$
DECLARE
  raw text;
BEGIN
  raw := current_setting('app.clinic_ids', true);
  IF raw IS NULL OR raw = '' OR raw = '*' THEN
    RETURN NULL;
  END IF;
  RETURN string_to_array(raw, ',')::bigint[];
END;
$$;

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
