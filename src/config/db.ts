import { PrismaClient } from '@prisma/client';
import { tenantContextStorage } from './tenant-context';

let _basePrisma: PrismaClient | null = null;

const getBasePrisma = (): PrismaClient => {
  if (!_basePrisma) {
    _basePrisma = new PrismaClient({
      log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
    });
  }
  return _basePrisma;
};

// Client extension: for any request with an active tenant context (see
// src/middleware/tenantContext.middleware.ts), transparently reroutes model
// queries through a transaction that first does `SET LOCAL app.clinic_ids`,
// so Postgres Row-Level Security policies enforce tenant isolation even if a
// caller forgets to filter by ClinicNum. Scripts/jobs with no active request
// context (no AsyncLocalStorage store) run queries unmodified, same as today.
//
// Deliberately dispatches through the *base* client's own $transaction (not
// the extended client) inside the callback, so the wrapped operation isn't
// re-intercepted by this same extension — this is Prisma's documented
// pattern for exactly this row-level-security use case.
let _extendedPrisma: ReturnType<PrismaClient['$extends']> | null = null;

const getExtendedPrisma = () => {
  if (!_extendedPrisma) {
    const base = getBasePrisma();
    _extendedPrisma = base.$extends({
      name: 'tenant-rls-context',
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            const ctx = tenantContextStorage.getStore();
            if (!ctx || !model) {
              return query(args);
            }

            // ctx.clinicIds / ctx.patientGroupId are either our own resolved
            // values or the literal sentinel '*' — never raw user input —
            // safe to interpolate into SET LOCAL (Postgres has no parameter
            // binding for SET LOCAL values). A4 replaces this with a single
            // parameterized set_config() call.
            const clinicIdsLiteral = ctx.clinicIds === '*' ? '*' : ctx.clinicIds.map(String).join(',');
            // null means "group could not be resolved" and must serialise to
            // the EMPTY STRING, not to the text "null": the RLS policies
            // treat '' as deny, whereas 'null' would reach the ::int cast and
            // raise instead of quietly denying.
            const patientGroupIdLiteral =
              ctx.patientGroupId === null ? '' : String(ctx.patientGroupId);

            return base.$transaction(async (tx) => {
              await tx.$executeRawUnsafe(`SET LOCAL app.clinic_ids = '${clinicIdsLiteral}'`);
              // Second GUC, consumed only by the patient table's read policy
              // (prisma/rls/04-patient-group-visibility.sql), compared
              // directly against the stored patient.GroupNum column — every
              // other RLS-protected table still enforces app.clinic_ids only.
              await tx.$executeRawUnsafe(`SET LOCAL app.patient_group_id = '${patientGroupIdLiteral}'`);
              return (tx as any)[model][operation](args);
            }, {
              maxWait: 10000,
              timeout: 30000,
            });
          },
        },
      },
    });
  }
  return _extendedPrisma;
};

// Lazy proxy — avoids instantiating PrismaClient at module load time.
// This prevents crashes when DATABASE_URL is not set before the module is imported.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return (getExtendedPrisma() as any)[prop];
  },
});

// ─── Row-Level Security startup guard ──────────────────────────────────────
//
// WHY THIS EXISTS
// ---------------
// Postgres RLS is bypassed unconditionally by superusers, by roles with
// BYPASSRLS, and by the owner of a table (unless FORCE ROW LEVEL SECURITY is
// set). So a misconfigured DATABASE_URL pointing at `postgres` — the owner of
// all ~460 tables here — silently disables every policy in prisma/rls/ while the
// app still appears to work. The SET LOCAL calls in the extension above would
// be doing nothing at all.
//
// This guard turns that silent failure into a loud one: in production, refuse
// to boot. Outside production it warns, so local development against a
// superuser is still possible (and is the current default in .env).
//
// Deliberately NO bypass env var. If RLS is not effective in production, the
// correct response is to fix DATABASE_URL or run applyRls — not to skip a check.

class RlsStartupCheckError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RlsStartupCheckError';
  }
}

type RlsProbe = {
  current_user: string;
  rolsuper: boolean;
  rolbypassrls: boolean;
  policy_count: string;
  owns_patient: boolean;
  rls_enabled_count: string;
};

/**
 * Ownership of `patient` is read from pg_class.relowner, NOT pg_has_role —
 * pg_has_role resolves its second argument as a ROLE name, and "patient" is a
 * table, so it errors with `role "patient" does not exist`.
 */
const probeRls = async (): Promise<RlsProbe> => {
  const rows = await getBasePrisma().$queryRaw<RlsProbe[]>`
    SELECT
      current_user                                                AS current_user,
      r.rolsuper                                                 AS rolsuper,
      r.rolbypassrls                                             AS rolbypassrls,
      (SELECT count(*) FROM pg_policies WHERE schemaname = 'public') AS policy_count,
      EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = 'patient'
          AND c.relkind = 'r'
          AND pg_get_userbyid(c.relowner) = current_user
      )                                                        AS owns_patient,
      (SELECT count(*)
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
          AND c.relrowsecurity)                                 AS rls_enabled_count
    FROM pg_roles r
    WHERE r.rolname = current_user
  `;
  return rows[0];
};

const banner = (lines: string[]) => {
  // Wrap rather than pad: several messages exceed one terminal row, and a
  // fixed padEnd produces a box that does not line up.
  const WIDTH = 56;
  console.error('');
  console.error('┌' + '─'.repeat(WIDTH + 2) + '┐');
  for (const line of lines) {
    if (line.length <= WIDTH) {
      console.error(`│  ${line.padEnd(WIDTH)}  │`);
    } else {
      console.error(`│  ${line}`);
      console.error(`│  ${' '.repeat(WIDTH)}  │`);
    }
  }
  console.error('└' + '─'.repeat(WIDTH + 2) + '┘');
  console.error('');
};

const assertRowLevelSecurityIsEffective = async (): Promise<void> => {
  let probe: RlsProbe;
  try {
    probe = await probeRls();
  } catch (err) {
    // Never block startup on a probe failure in dev/test — e.g. a database
    // where pg_policies is unreadable. In production, treat it as fatal,
    // because "I could not verify RLS" must not mean "RLS is fine".
    if (process.env.NODE_ENV === 'production') {
      throw new RlsStartupCheckError(
        `Could not verify RLS state: ${(err as Error).message}`
      );
    }
    console.warn(`⚠️  Could not verify RLS state: ${(err as Error).message}`);
    return;
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const policyCount = Number(probe.policy_count);
  const rlsTableCount = Number(probe.rls_enabled_count);

  const blockers: string[] = [];
  if (probe.rolsuper) {
    blockers.push(`user "${probe.current_user}" is a SUPERUSER`);
  }
  if (probe.rolbypassrls) {
    blockers.push(`user "${probe.current_user}" has BYPASSRLS`);
  }
  if (policyCount === 0) {
    blockers.push('no RLS policies exist in schema "public" (prisma/rls/ not applied)');
  }

  if (blockers.length > 0) {
    if (isProduction) {
      banner([
        'FATAL: Refusing to start — RLS is not effective.',
        '',
        ...blockers,
        '',
        'Every SET LOCAL in src/config/db.ts is a no-op in this state, so',
        'branch isolation relies entirely on application-layer WHERE',
        'clauses. One missed filter exposes another practice data.',
        '',
        'Fix: point DATABASE_URL at the medflow_app role, and run',
        '  node dist/scripts/applyRls.js   (owner / DIRECT_DATABASE_URL)',
        'before starting the server.',
      ]);
      throw new RlsStartupCheckError(blockers.join('; '));
    }

    console.warn('');
    console.warn('┌──────────────────────────────────────────────────────────┐');
    console.warn('│  ⚠️  RLS IS NOT EFFECTIVE — branch isolation is NOT      │');
    console.warn('│      enforced by the database in this environment.      │');
    console.warn('└──────────────────────────────────────────────────────────┘');
    for (const b of blockers) console.warn(`     • ${b}`);
    console.warn('');
  }

  // Table ownership is a warning, not a blocker: an owner bypasses RLS on
  // tables it owns unless FORCE ROW LEVEL SECURITY is set, but the policies in
  // prisma/rls/ rely on the app role NOT owning the tables (01-app-role.sql
  // grants medflow_app DML only, never ownership). Worth surfacing loudly
  // because it is a subtler failure than a superuser.
  if (probe.owns_patient) {
    const message =
      `user "${probe.current_user}" OWNS the "patient" table — table owners ` +
      `bypass RLS unless FORCE ROW LEVEL SECURITY is set (${rlsTableCount} table(s) ` +
      `currently have RLS enabled).`;
    if (isProduction) {
      banner(['FATAL: Refusing to start — table ownership bypasses RLS.', '', message]);
      throw new RlsStartupCheckError(message);
    }
    console.warn(`⚠️  ${message}`);
    console.warn('');
  }

  if (process.env.RLS_STARTUP_LOG === 'true') {
    console.log(
      `🔒 RLS check: user=${probe.current_user} superuser=${probe.rolsuper} ` +
        `bypassrls=${probe.rolbypassrls} policies=${policyCount} rls_tables=${rlsTableCount} ` +
        `owns_patient=${probe.owns_patient}`
    );
  }
};

const connectDB = async (): Promise<void> => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('');
    console.error('┌─────────────────────────────────────────────────────────┐');
    console.error('│  FATAL: DATABASE_URL environment variable is not set.   │');
    console.error('│                                                          │');
    console.error('│  Render:   Settings → Environment → Add Env Var         │');
    console.error('│            DATABASE_URL = postgresql://user:pass@host/db │');
    console.error('│                                                          │');
    console.error('│  Set the USER to medflow_app — NOT postgres. The app    │');
    console.error('│  must not run as a superuser or it will bypass RLS.     │');
    console.error('└─────────────────────────────────────────────────────────┘');
    console.error('');
    process.exit(1);
  }

  try {
    await getBasePrisma().$connect();
    await assertRowLevelSecurityIsEffective();
    console.log('✅ Database connected successfully');
  } catch (error) {
    if (error instanceof RlsStartupCheckError) {
      console.error('');
      console.error('┌─────────────────────────────────────────────────────────┐');
      console.error('│  FATAL: Refusing to start — RLS is not effective.       │');
      console.error('└─────────────────────────────────────────────────────────┘');
      console.error('');
      process.exit(1);
    }
    console.error('❌ Database connection failed:', (error as Error).message);
    console.error('   Check that DATABASE_URL points to a reachable database.');
    process.exit(1);
  }
};

export default connectDB;
