# 00 — Shared Contracts (RBAC hardening)

**Read this before writing any code.** Person A (`rbac-core`) and Person B (`rbac-surface`) both
build against this file. It is the only document that defines the boundary between our two halves.

If you need behaviour that is not specified here, **ask in the handoff channel — do not invent it
and do not edit the other person's files to get it.**

---

## 0. Ownership

| Person | Branch | Owns |
|---|---|---|
| **A** | `rbac-core` | `src/middleware/*`, `src/config/db.ts`, `src/config/security.ts`, `src/config/tenant-context.ts`, `prisma/rls/*`, `prisma/schema.prisma` (access models only), `src/constants/permission-catalog.ts`, `src/scripts/applyRls.ts`, `src/services/access-context.service.ts`, `src/services/user-clinic.service.ts`, `src/services/permission.service.ts`, `src/types/access.types.ts`, `src/utils/signed-url.util.ts`, `Dockerfile`, `render.yaml` |
| **B** | `rbac-surface` | all of `src/routes/*`, all `src/controllers/*`, `user.service.ts`, `role.service.ts`, `role.controller.ts`, `practice-group.service.ts`, `sharing.service.ts`, `lock-date.service.ts`, `audit.service.ts`, `activity-logger.util.ts`, and the entire `Medflow-FE` repo |

Shared: `integration`.

**Two known exceptions where we touch each other's files, both pre-agreed:**

1. A owns the `ClinicNum` scoping lines inside `patient.service.ts` / `patient.controller.ts`.
   B owns the SSN masking in the same patient mapper. Coordinate via handoff, don't refactor
   around each other.
2. B owns `practice-group.service.ts`. A's A3.5 needs `createGroupAdmin` to stop inventing a
   `Group Admin` role. **B makes that change**, on A's request.

---

## 1. Database and tenancy model

PostgreSQL. Confirmed — `prisma/schema.prisma`, `postgresql://` connection strings, RLS policies
in `prisma/rls/`. Nothing in this project is SQL Server / MySQL / Mongo.

```
Tenant   = practicegroup        ← hard isolation boundary
  └─ Clinic = clinic             ← scoping boundary, inside the wall
       └─ patients, appointments, claims, payments
```

**Clinic is not a tenant.** A DSO's patients are shared across its locations; group-wide reporting
depends on that. Do not model a clinic as a tenant.

### 1a. RLS is the backstop, not the primary control

The application layer (`WHERE ClinicNum IN (...)`) is the primary control and stays. RLS is the
database backstop that makes a *forgotten* clause non-exploitable. Both are required.

**Enforcement chain, in order:**

```
Request
  → authenticate                     (who)
  → AccessContext                    (what they may do, where)
  → requirePermission / requirePhiAccess   (route-level)
  → service rules                    (clinic, provider, age)
  → Prisma extension → SET LOCAL     (RLS backstop)
  → writeAudit                       (B)
```

### 1b. The startup guard (A0.3) — why the app refuses to boot

The app must connect as `medflow_app`, a `NOSUPERUSER` role that is **not** the table owner. A
superuser or a table owner bypasses RLS unconditionally regardless of policy.

On startup the app queries `pg_roles` and **exits non-zero** in production if:

- `rolsuper` is true, **or**
- `rolbypassrls` is true, **or**
- `pg_policies` count is 0

It **warns loudly** (does not exit) if the current user owns `patient`.

> **Why this matters more than it looks.** At the time of writing, `pg_policies` is **0** and
> `medflow_app` does not exist — the four files in `prisma/rls/` have never been executed, because
> no deploy path ran them. The guard exists so that state can never silently return. Do not add a
> bypass flag.

---

## 2. `AccessContext` (A4)

Single object, built **once per request** in `authenticate`, cached 60s in memory keyed
`` `${userId}:${tokenVersion}` ``. Everything downstream reads it and makes **zero** further
auth queries.

Type lives in `src/types/access.types.ts` — that file is the source of truth, this section is the
narrative. If they disagree, the `.ts` file wins and this section is a bug.

### Key invariant

> **An empty or missing clinic scope means DENY. Never "everything".**

`'*'` is a deliberate, server-controlled bypass. It is granted in exactly one place:
`enterTenantContext`, and only when `isPlatformAdmin || accessAllClinics`. No other code path may
produce `'*'`.

---

## 2a. PHI gate — `requirePhiAccess` (A1.4, ready ~hr 2.5)

```ts
import { requirePhiAccess } from '../middleware/phi.middleware';
```

Sits **after** `authenticate` and **before** `enterTenantContext` on every route that returns
protected health information (clinical notes, vitals, prescriptions, treatment plans, documents,
imaging, lab cases, allergies, progress notes, exam/management records, patient reports).

Grants access when the caller holds `clinical.cross_branch.view`, or is a platform admin.

Denial → **403**:

```json
{ "success": false, "error": { "code": "PHI_ACCESS_NOT_GRANTED", "message": "..." } }
```

> **Note on error shape.** The existing `errorHandler` (B's file) nests the code at
> `error.code`, not top-level `code`. The plan text says `{ code: '...' }` — that is shorthand.
> **Always nest under `error.code`**, or the frontend interceptor in F2 will not match.

B applies this to the 17 PHI route files listed in B1.3.

---

## 3. Clinic assignment — `setUserClinics` (A5, ready ~hr 7.5)

```ts
setUserClinics(
  userNum: bigint,
  input: { defaultId: string; restrictedIds: string[]; accessAll: boolean },
  actor: { userId: string; isPlatformAdmin: boolean }
): Promise<void>
```

Contract:

1. Only a platform admin, or a caller holding `security.admin`, may set `accessAll: true`.
   Anyone else attempting it gets **403**.
2. Writes `userclinic` rows, `userod.ClinicNum` (the default), and
   `user_access_profile.access_all_clinics` — in that order, one transaction.
3. Calls `bumpAccessVersion(userNum)` (B's service) so open sessions are invalidated.
4. Calls `writeAudit(CLINIC_ASSIGNED, ...)` (B's service).
5. Idempotent — a `restrictedIds` list replaces the previous set.

B wraps this at `PUT /api/users/:id/clinics`.

---

## 4. `bumpAccessVersion` (B owns, A consumes)

```ts
bumpAccessVersion(userNum: bigint): Promise<void>
```

Invalidates every session for a user. A's `AccessContext` cache key includes `tokenVersion`, so
this invalidates the cache on the next request with no extra plumbing.

A's extension: it must also increment `user_access_profile.access_version`. B's interim version only
bumps `tokenVersion`. **Either bump is sufficient to invalidate A's cache.**

Every role change, permission change, clinic change, and activate/deactivate **must** call this.

---

## 5. `writeAudit` (B owns, A calls)

```ts
writeAudit(entry: {
  permType: number;        // from src/constants/audit-types.ts, >= 1000
  userNum: bigint | null;
  patNum?: bigint | null;
  logSource: number;
  logText: Record<string, unknown>;
}): Promise<void>
```

Append-only, SHA-256 hash-chained via `securitylog` / `securityloghash`. A calls it from
`setUserClinics`; B calls it everywhere else.

---

## 6. `secured()` (A4, ready ~hr 7)

```ts
secured(permission?: string | string[], opts?: { phi?: boolean })
```

Composes, in order:

```
authenticate → requirePermission (if given) → requirePhiAccess (if opts.phi)
             → resolveBranchAccess → enterTenantContext
```

B migrates routes to this **only if** A4 is merged and the suite is green. The B1.3 explicit
per-route middleware is already sufficient on its own — `secured()` is convenience, not the
security mechanism. Do not treat its absence as a blocker.

---

## 7. Permission catalog (A3.2)

`src/constants/permission-catalog.ts` is the single source of truth.
`src/constants/permissions.ts` re-exports from it.

```ts
export interface CatalogEntry {
  key: string;              // 'patients.read'
  module: string;           // 'patients'
  description: string;
  isSensitive: boolean;     // drives the FE badge + lock-date UI
  lockDateAware: boolean;   // true for financial/clinical write perms
}
export const PERMISSION_CATALOG: Record<string, CatalogEntry>;  // keyed by `key`
```

**Rule: existing keys are never renamed.** 285 `requirePermission(...)` call sites depend on the
current spellings. Renaming is a later, separate task.

18 keys are used in routes but defined nowhere — they must be added, not renamed:

```
adjustments.create  adjustments.delete  adjustments.read  adjustments.update
audiences.read  audiences.write  authorizations.write  billing.write
claims.write  deposits.create  deposits.read  deposits.update
payment-plans.create  payment-plans.read  payment-plans.update
reports.write  settings.read  settings.update
```

A drift test scans `src/routes` and fails if any `requirePermission('x')` key is absent from the
catalog. This runs in CI and is the thing that stops the catalog rotting.

---

## 8. Error codes

| Code | Status | Meaning | Owner |
|---|---|---|---|
| `NO_BRANCH_ASSIGNED` | 403 | User has a role but no clinic. Not a bug — an onboarding state. | A |
| `PHI_ACCESS_NOT_GRANTED` | 403 | Caller lacks `clinical.cross_branch.view`. | A |
| `LOCKED_PERIOD` | 409 | Record date falls in a locked period. | B |
| `INVALID_PERMISSION_GRANT` | 403 | Actor tried to grant a role they don't fully hold. | B |

Always nested at `error.code` (see §2a).

`NO_BRANCH_ASSIGNED` and `PHI_ACCESS_NOT_GRANTED` are **not** generic 403s on purpose: B's frontend
interceptor renders a distinct actionable message for each ("contact your administrator" vs
"you don't have permission"). Keep them distinct.

---

## 9. Handoff schedule

| From A | ~Hour | B can start |
|---|---|---|
| `access.types.ts` | 0 | coding against `AccessContext` |
| fail-closed scope merged → `integration` | 2 | trusting B1.3 smoke tests |
| `requirePhiAccess` | 2.5 | PHI gate on 17 route files |
| tables + catalog | 5 | catalog endpoint, roles UI |
| `secured()` | 7 | route migration |
| `setUserClinics()` | 7.5 | clinics route + Clinics tab |

---

## 10. Known limits (agreed, not oversights)

1. **`ClinicNum IS NULL` rows are visible to every tenant.** ~100% of `payment`/`claim`/`proctp`
   rows and 97.6% of `patient` rows in the current database are untagged. Until backfilled, RLS
   protects almost nothing. This is tracked as a blocker on A7's "empty scope returns 0 rows"
   criterion — **not** a passing state.
2. `patient.GroupNum IS NULL` is likewise universally readable.
3. A Group Admin's clinic list is still the whole group at the RLS level.
4. Break-glass, `RELATIONSHIP_ONLY` visibility, DOB masking, group-scoped custom roles: next
   sprint.
5. `s3-local` document URLs are not yet signed. Patient images are (A2b).
6. The route-scope CI guard is a **text** check, not a real Express router-stack walk.
