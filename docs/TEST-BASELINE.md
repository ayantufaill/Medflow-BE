# Test Baseline — recorded by Person A at the start of the RBAC work

Branch: `rbac-core` · Date: 2026-09-30

## Environment

There is **no `.env.test`**. `tests/setup.ts` resolves env in this order:

```
.env.test  →  .env.docker  →  .env
```

so the suite currently runs against the **Docker** database
(`medflow_db` in the `medflow-be-db-1` container, user `medflow`),
**not** the host database at `localhost:5432/medflow`.

This matters when testing RLS: applying `prisma/rls/*.sql` to the host
database changes nothing about the test run, and vice versa. A7 must set
`RLS_TEST_DATABASE_URL` explicitly rather than relying on `.env`.

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
```

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
