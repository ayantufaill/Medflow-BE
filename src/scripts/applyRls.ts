/**
 * Applies Postgres Row-Level Security to the database.
 *
 * WHY THIS EXISTS
 * ---------------
 * The SQL files in prisma/rls/ were written but never executed by any deploy
 * path. At the time of writing, pg_policies was 0 and the medflow_app role did
 * not exist — the app connected as a superuser, which bypasses RLS
 * unconditionally. This script is what makes that state impossible to keep.
 *
 * Runs on every deploy, after `prisma db push` (which must run first — it
 * creates the tables as the owner) and before the server boots.
 *
 * WHY `pg` AND NOT PRISMA
 * ----------------------
 * These files use DO $$ ... $$ blocks, i.e. multiple statements per file.
 * Prisma's $executeRaw is prepared-statement based and cannot run them. The
 * `pg` client's simple query protocol accepts a whole file at once. Note this
 * is also why we must NOT split on ';' — that would break the dollar-quoted
 * bodies and any semicolon inside a string literal.
 *
 * IDEMPOTENT
 * ----------
 * Every file is written to be re-runnable (DROP POLICY IF EXISTS before
 * CREATE, CREATE ROLE guarded by an existence check). Safe on every deploy.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';

/** Placeholder in prisma/rls/01-app-role.sql, replaced from APP_DB_PASSWORD. */
const PASSWORD_PLACEHOLDER = '__APP_DB_PASSWORD__';

type RoleInfo = {
  current_user: string;
  rolsuper: boolean;
  rolbypassrls: boolean;
  policy_count: string;
  owns_patient: boolean;
};
/**
 * Escape a value as a Postgres string literal. Doubling single quotes is the
 * only escaping Postgres performs inside '...' — backslashes are literal.
 * This matters: a password containing a quote would otherwise break the DO $$
 * block and, worse, could inject SQL.
 */
function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * Reject an empty password outright rather than letting it through.
 * An empty APP_DB_PASSWORD would otherwise silently set the role's password
 * to '' and produce a confusing "password authentication failed" at boot.
 */
function requireAppPassword(): string {
  const password = process.env.APP_DB_PASSWORD;
  if (!password || password.trim().length === 0) {
    throw new Error(
      [
        '',
        'FATAL: APP_DB_PASSWORD is not set.',
        '',
        'prisma/rls/01-app-role.sql no longer contains a hard-coded password —',
        'the medflow_app role password is injected from this variable instead.',
        '',
        'Set APP_DB_PASSWORD in your environment (Render dashboard / .env).',
        'Generate one with:  openssl rand -base64 32',
        '',
      ].join('\n')
    );
  }
  return password;
}

/**
 * Sanity-check the connection before applying anything. Connecting as a
 * superuser here is correct and expected — this is the migration path, not the
 * runtime path. The app itself is guarded separately in src/config/db.ts.
 */
async function assertOwnerConnection(client: Client): Promise<RoleInfo> {
  // Ownership of `patient` is read from pg_class.relowner, NOT pg_has_role —
  // pg_has_role resolves its second argument as a ROLE name, and "patient" is
  // a table, so it errors with `role "patient" does not exist`.
  const { rows } = await client.query<RoleInfo>(`
    SELECT
      current_user                                            AS current_user,
      r.rolsuper                                             AS rolsuper,
      r.rolbypassrls                                         AS rolbypassrls,
      (SELECT count(*) FROM pg_policies WHERE schemaname = 'public') AS policy_count,
      EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = 'patient'
          AND c.relkind = 'r'
          AND pg_get_userbyid(c.relowner) = current_user
      )                                                      AS owns_patient
    FROM pg_roles r
    WHERE r.rolname = current_user
  `);

  const info = rows[0];
  if (!info) {
    throw new Error('Could not read role information for the current database user.');
  }

  console.log(`  connected as      : ${info.current_user}`);
  console.log(`  rolsuper          : ${info.rolsuper}`);
  console.log(`  rolbypassrls      : ${info.rolbypassrls}`);
  console.log(`  existing policies : ${info.policy_count}`);

  if (!info.rolsuper && !info.owns_patient && Number(info.policy_count) === 0) {
    console.warn(
      [
        '',
        '  WARNING: this connection is neither a superuser nor the owner of',
        '  "patient", and no policies exist. If policies are not created below,',
        '  the app will refuse to boot in production (see src/config/db.ts).',
        '',
      ].join('\n')
    );
  }

  return info;
}

async function main(): Promise<void> {
  const connectionString = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'FATAL: neither DIRECT_DATABASE_URL nor DATABASE_URL is set. ' +
        'RLS must be applied as the database owner, not as medflow_app.'
    );
  }

  const appPassword = requireAppPassword();

  // ESM (package.json has "type": "module"), so __dirname does not exist.
  // Source runs from src/scripts/, compiled runs from dist/scripts/ — both are
  // two levels below the repo root, so one resolve handles each.
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(__dirname, '..', '..');
  const rlsDir = join(repoRoot, 'prisma', 'rls');

  let files: string[];
  try {
    files = readdirSync(rlsDir).filter((f) => f.endsWith('.sql')).sort();
  } catch (err) {
    throw new Error(
      `FATAL: could not read RLS directory at ${rlsDir}. ${(err as Error).message}\n` +
        'The prisma/ directory must be present in the runtime image.'
    );
  }

  if (files.length === 0) {
    throw new Error(`FATAL: no .sql files found in ${rlsDir}. Refusing to report success.`);
  }

  console.log(`\nApplying RLS from ${rlsDir}`);
  console.log(`  ${files.length} file(s): ${files.join(', ')}\n`);

  const client = new Client({ connectionString });
  await client.connect();

  try {
    await assertOwnerConnection(client);

    for (const file of files) {
      const raw = readFileSync(join(rlsDir, file), 'utf8');
      const sql = raw.split(PASSWORD_PLACEHOLDER).join(sqlLiteral(appPassword));

      if (raw.includes(PASSWORD_PLACEHOLDER) && sql === raw) {
        throw new Error(`FATAL: password placeholder was not substituted in ${file}.`);
      }

      // Whole file, one call — the simple query protocol handles multiple
      // statements and dollar-quoted bodies. Do not split on ';'.
      await client.query(sql);
      console.log(`  applied  ${file}`);
    }

    const { rows } = await client.query<{ count: string }>(
      `SELECT count(*) FROM pg_policies WHERE schemaname = 'public'`
    );
    const policyCount = Number(rows[0]?.count ?? 0);

    console.log(`\nDone. ${policyCount} polic(y|ies) now active in schema "public".`);

    if (policyCount === 0) {
      throw new Error(
        'FATAL: RLS run completed but zero policies exist. The app will refuse to ' +
          'start in production. This means the SQL did not take effect.'
      );
    }

    console.log(
      'Next: point DATABASE_URL at the medflow_app role so the app runs under RLS.\n' +
        '      DIRECT_DATABASE_URL stays on the owner (migrations + this script).\n'
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(`\n${(err as Error).message}\n`);
  process.exit(1);
});
