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

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'medflow_app') THEN
    CREATE ROLE medflow_app LOGIN PASSWORD 'MedflowApp!2026Secure' NOSUPERUSER NOCREATEDB NOCREATEROLE;
  END IF;
END
$$;

GRANT CONNECT ON DATABASE medflow TO medflow_app;
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
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO medflow_app;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO medflow_app;
