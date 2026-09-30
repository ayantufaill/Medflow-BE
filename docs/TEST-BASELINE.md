# Test Baseline — recorded by Person A at the start of the RBAC work

Branch: `rbac-core` · Date: 2026-09-30

## Environment — measured, not assumed

There is **no `.env.test`**, and `tests/setup.ts` prefers
`.env.test` → `.env.docker` → `.env`. That ordering is misleading: even
though `.env.docker` is the file it loads, the suite actually connects to the
**host** database, not the Docker one.

Measured from inside a vitest run:

```
current_database() = medflow
current_user       = postgres
server port        = 5432
patient count      = 1353
```

and cross-checked directly:

```
host    localhost:5432/medflow  (user postgres) -> 1353 patients
docker  medflow_db               (user medflow)  ->   28 patients
```

The Docker `medflow_db` is reached as host `db:5432`, which does not resolve
outside the compose network, and the host Postgres already owns port 5432, so
the container's published port is shadowed. The connection therefore lands on
the host database.

**Consequences:**

- The suite runs as **`postgres` (a superuser)**, so RLS is bypassed for every
  test regardless of what `prisma/rls/*.sql` says. A7 must not rely on this
  setup; it needs its own `RLS_TEST_DATABASE_URL` pointed at `medflow_app`.
- Applying or removing RLS on the host database **does** affect the suite, so
  A0.5a's policy change was validated against real test traffic.
- Anyone re-running this baseline should re-measure rather than trust the
  `.env` precedence chain, because the precedence and the actual connection
  disagree.

## Result (clean checkout, before any A-block changes)

```
Test Files  10 failed | 68 passed (78)
     Tests  41 failed | 655 passed (696)
  Duration  ~258s
```

## Pre-existing failures — NOT caused by the RBAC work

```
tests/appointment-payments.test.ts
tests/client-demo-multitenant.test.ts
tests/deductible-lifecycle.integration.test.ts
tests/deposits.test.ts
tests/insurance-underpayment.test.ts
tests/lab-case.service.test.ts
tests/patients.test.ts
tests/recare-due-dates.test.ts
tests/rooms.test.ts
tests/services/treatment-plan.service.test.ts
tests/vital-signs.test.ts   (intermittent — see below)
```

### `vital-signs.test.ts` — verified pre-existing, order-dependent

`> lists a vital sign created in the DB` asserts on `item.notes`, but
`createVitalSignRecord` in `tests/helpers/fixtures.ts` writes the notes into
the `Documentation` JSON column. The row is written correctly (32 such rows
exist); the assertion reads the wrong field.

Confirmed unrelated to RBAC by re-running it with all A1 changes stashed —
it fails identically. It appears in some full-suite runs and not others
because the record it looks for is only visible once enough rows exist,
which depends on what earlier tests left behind.

Most are **foreign-key constraint violations during test cleanup**
(`fk_proctp_1_TreatPlanNum` and similar) — rows left behind by an earlier
test, not assertions about RBAC behaviour. Because `fileParallelism: false`
and the suite shares one database, these are order-dependent and the exact
failure count drifts by 1-2 between runs on an unchanged tree.

**Do not treat the raw pass/fail count as a regression signal.** Compare the
*set of failing files* instead:

```bash
npm test 2>&1 | grep FAIL | sed 's/.*tests\//tests\//;s/ >.*//' | sort -u
```

An RBAC change is a regression only if that list gains a file, or if a file
that was passing starts failing for an access-control reason.

## Note for Person B

Please re-record this baseline on `rbac-surface` before starting. The two
branches will not match exactly, and the drift-test + route-sweep work in
B1/B3 is far more likely to move this list than the middleware work in A.
