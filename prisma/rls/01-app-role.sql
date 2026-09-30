-- Creates a restricted, non-superuser role for the running application to
-- connect through, so Postgres Row-Level Security policies (added in later
-- files in this directory) actually take effect. Superusers (the `postgres`
-- role the app used before this) unconditionally bypass RLS, so this step is
-- a hard prerequisite, not an optimization.
--
-- `postgres` keeps being used for schema migrations (`prisma db push`) via
-- DIRECT_DATABASE_URL — this role only needs DML rights, no DDL/ownership.
--
-- Idempotent — safe to re-run.
--
-- The password is NOT hard-coded here. `__APP_DB_PASSWORD__` is substituted by
-- src/scripts/applyRls.ts from the APP_DB_PASSWORD env var before execution,
-- wrapped and escaped as a SQL string literal by that script. Keep the
-- placeholder BARE — no surrounding quotes — or the script's own quoting
-- produces ''value'' and Postgres reads the password as empty.
-- Keeping a literal password in a tracked file meant anyone with repo read
-- access had the production DB credential.
-- The ALTER ROLE below also re-syncs the password on every deploy, so rotating
-- APP_DB_PASSWORD takes effect on the next deploy without a manual step.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'medflow_app') THEN
    CREATE ROLE medflow_app LOGIN PASSWORD __APP_DB_PASSWORD__ NOSUPERUSER NOCREATEDB NOCREATEROLE;
  END IF;
END
$$;

-- Role already exists (every re-run): rotate the password to the current value.
ALTER ROLE medflow_app WITH LOGIN PASSWORD __APP_DB_PASSWORD__ NOSUPERUSER NOCREATEDB NOCREATEROLE;

GRANT CONNECT ON DATABASE medflow_db TO medflow_app;
GRANT USAGE ON SCHEMA public TO medflow_app;

-- medflow_app deliberately has no CREATE on schema public (DML only, no
-- DDL) — `medflow_sequences` is now a real Prisma-managed model (schema.prisma)
-- created via `prisma db push` (run as postgres, through DIRECT_DATABASE_URL),
-- not bootstrapped ad-hoc at runtime by the app anymore.

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO medflow_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO medflow_app;

-- So future schema changes (new tables/sequences from `prisma db push`,
-- always run as `postgres`) don't silently leave medflow_app without access.
-- Explicit `FOR ROLE postgres` since default-privilege scope is otherwise
-- tied to whichever role executes this statement, which happens to also be
-- postgres here — spelled out so that isn't left implicit.
ALTER DEFAULT PRIVILEGES FOR ROLE medflow IN SCHEMA public GRANT ALL ON TABLES TO medflow_app;
ALTER DEFAULT PRIVILEGES FOR ROLE medflow IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO medflow_app;
