CREATE SCHEMA IF NOT EXISTS mf;

CREATE OR REPLACE FUNCTION mf.group_id() RETURNS integer
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.patient_group_id', true), '')::integer;
$$;

CREATE OR REPLACE FUNCTION mf.user_id() RETURNS bigint
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::bigint;
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
