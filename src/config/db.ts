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
            // binding for SET LOCAL values).
            const clinicIdsLiteral = ctx.clinicIds === '*' ? '*' : ctx.clinicIds.map(String).join(',');
            const patientGroupIdLiteral = ctx.patientGroupId === '*' ? '*' : String(ctx.patientGroupId);

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

const connectDB = async (): Promise<void> => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('');
    console.error('┌─────────────────────────────────────────────────────────┐');
    console.error('│  FATAL: DATABASE_URL environment variable is not set.   │');
    console.error('│                                                          │');
    console.error('│  Railway:  go to your project → Variables tab and add  │');
    console.error('│            DATABASE_URL = sqlserver://host:1433;...     │');
    console.error('│                                                          │');
    console.error('│  Render:   Settings → Environment → Add Env Var         │');
    console.error('│            DATABASE_URL = postgresql://user:pass@host/db │');
    console.error('└─────────────────────────────────────────────────────────┘');
    console.error('');
    process.exit(1);
  }

  try {
    await getBasePrisma().$connect();
    console.log('✅ Database connected successfully');
  } catch (error) {
    console.error('❌ Database connection failed:', (error as Error).message);
    console.error('   Check that DATABASE_URL points to a reachable database.');
    process.exit(1);
  }
};

export default connectDB;
