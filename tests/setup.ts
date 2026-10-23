// MUST be the first import: enters an unrestricted tenant context for the
// whole test process, before any module can issue a query.
//
// WHY TESTS NEED THIS
// -------------------
// The app connects as `medflow_app`, a role with no BYPASSRLS, so every write
// goes through the policies in prisma/rls/. Those policies read
// `app.clinic_ids`, which the Prisma extension in src/config/db.ts only sets
// when a tenant context is present. A test that calls Prisma DIRECTLY — which
// every fixture in tests/helpers/fixtures.ts does — has no context, so
// `app.clinic_ids` is unset, which every policy correctly reads as "no
// branches". The fixture's INSERT then dies with:
//
//   42501 new row violates row-level security policy for table "patient"
//
// That is the single cause behind the bulk of the suite's failures: the test
// never gets as far as the behaviour it is asserting, because it cannot
// create the patient it needs.
//
// WHY THIS DOES NOT WEAKEN THE ISOLATION TESTS
// --------------------------------------------
// This is deliberately safe for the cross-tenant tests. Requests made through
// supertest go through tenantContext.middleware.ts, which calls
// `tenantContextStorage.run({...})` — `run` creates a NESTED context that
// overrides this ambient one for the duration of that request. So an HTTP
// caller is still scoped to its own branches and
// tests/client-demo-multitenant.test.ts keeps proving real isolation. Only
// direct Prisma calls from test bodies and fixtures see the unrestricted
// context, which is exactly the setup code that needs it.
//
// Production is unaffected: nothing imports this file outside the test run.
import '../src/config/seed-context';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { afterAll, beforeAll } from 'vitest';
import connectDB, { prisma } from '../src/config/db';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const testEnv = path.join(rootDir, '.env.test');
const dockerEnv = path.join(rootDir, '.env.docker');
const defaultEnv = path.join(rootDir, '.env');
const envPath = fs.existsSync(testEnv)
  ? testEnv
  : fs.existsSync(dockerEnv)
    ? dockerEnv
    : defaultEnv;

process.env.DOTENV_CONFIG_PATH = envPath;
// `override` is required: importing src/config/db.ts pulls in @prisma/client,
// which has already loaded the project `.env` by the time this module body
// runs (ESM hoists the import above). Without override, `.env`'s stale
// DATABASE_URL wins for every key the two files share, and the suite silently
// connects to the wrong database. See docs/TEST-BASELINE.md.
dotenv.config({ path: envPath, override: true });

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.EMAIL_PROVIDER = process.env.EMAIL_PROVIDER || 'console';
process.env.OCR_MOCK = process.env.OCR_MOCK || 'true';

let prismaRef: { $disconnect: () => Promise<void> } | null = null;

beforeAll(async () => {
  prismaRef = prisma;
  await connectDB();
});

afterAll(async () => {
  if (prismaRef) {
    await prismaRef.$disconnect();
  }
});