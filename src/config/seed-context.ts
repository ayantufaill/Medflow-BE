/**
 * Side-effect module: enters an unrestricted tenant context for the whole
 * process. Import it (for its side effect, first thing) from CLI seed and
 * maintenance scripts — NEVER from server/request code.
 *
 * WHY THIS EXISTS
 * ---------------
 * The app connects as `medflow_app`, a role with no BYPASSRLS, so every write
 * goes through the policies in prisma/rls/. Those policies read
 * app.clinic_ids, which the Prisma extension in src/config/db.ts only sets
 * when a tenant context is present:
 *
 *     if (!ctx || !model) return query(args);   // no SET LOCAL at all
 *
 * A script with no context therefore runs with app.clinic_ids unset, which
 * every policy correctly reads as "no branches" — so INSERTs fail with
 * `42501 new row violates row-level security policy` and SELECTs return
 * nothing. Most seed scripts had no context and only appeared to work because
 * they are idempotent: against an already-seeded database every row exists,
 * so they skip the writes that would have been denied. On a fresh database
 * (`docker compose up` on an empty volume) the seed dies, which fails the
 * compose `seed` service and tears down the whole stack, because `api` is
 * declared `depends_on: seed: condition: service_completed_successfully`.
 *
 * enterWith (not run()) so a script needs one import line and no wrapping of
 * its entrypoint: the store is set for the remainder of this execution,
 * including the importing module's body and everything it awaits.
 *
 * '*' is the same sentinel the Super Admin path uses — correct here: a seed
 * script is provisioning every tenant, so it is not scoped to any one branch.
 */
import { tenantContextStorage } from './tenant-context';

tenantContextStorage.enterWith({ clinicIds: '*', patientGroupId: '*' });
