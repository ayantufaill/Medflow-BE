# ICD-10 PDF catalogue

The Edit Procedure drawer uses a dedicated ICD lookup API. The existing procedure-code API continues to supply the procedure header.

## Source and import

`src/data/icd10-pdf-data.json` contains all 71,486 unique codes from the supplied `icd-10-medical-diagnosis-codes.pdf` (2,966 pages), effective October 1, 2016. The manifest inside the dataset records the source SHA-256, edition, and extraction report. This is a historical catalogue, not a current-edition certification.

The importer uses the existing `icd10` table. No schema migration is required. It inserts missing codes and preserves existing rows and descriptions, including newer editions. It does not invent values for the legacy `IsCode` field.

```powershell
npm.cmd run seed:icd10 -- --dry-run
npm.cmd run seed:icd10 -- --apply
```

Dry run is the default. The importer rejects duplicate/invalid codes and overlong descriptions before writing. IDs are allocated in transaction-safe batches through `medflow_sequences`, preserving compatibility with `getNextId`. Conflicting existing descriptions are reported and preserved.

To reproduce extraction, install `pypdf` in a suitable Python environment, then:

```powershell
python scripts/extractIcd10Pdf.py <path-to-pdf> src/data/icd10-pdf-data.json
```

The extractor verifies the source edition, joins wrapped descriptions, keeps source page numbers, and stops on duplicate codes. The runtime seed reads JSON through `fs`; the large dataset is excluded from TypeScript compilation.

## Lookup and persistence

`GET /api/icd10-codes?search=K029&page=1&limit=50` searches codes and descriptions. `code=Z99.89` retrieves a saved selection outside the current results page. Authentication, branch access, and tenant middleware protect the endpoint. Maximum page size is 100. Both dotted and undotted input work; results and newly assigned diagnoses use dotted codes and string IDs.

The drawer debounces server searches, cancels stale requests, preserves the selected option, displays loading/errors/empty results, and supports clearing. It retains single selection.

Treatment-plan diagnoses persist in `proctp.Dx`. Completed linked procedures also receive `procedurelog.DiagnosticCode`. Appointment diagnoses persist in the existing procedure metadata and synchronize to `procedurelog.DiagnosticCode`; appointment reload mapping reads the saved value. Procedure identity is preferred over code when the same code occurs twice.

New or changed diagnoses must exist in the catalogue. An unchanged legacy diagnosis remains editable on its existing row, including legacy CDT values; these are not automatically converted. Clearing stores null. Updates that omit the diagnosis preserve the existing assignment.

## Verification

- The configured local `medflow_db` catalogue was initially empty; 71,486 records were imported.
- A read-only comparison found zero code/description mismatches against the extracted dataset.
- A second import preview found zero pending records and zero description conflicts.
- Twelve isolated backend tests cover dataset completeness, normalization, clearing, legacy preservation, server search, HTTP query validation, and route authentication wiring using doubles.
- Three frontend tests cover reload values, explicit clearing, and procedure identity when codes repeat.
- The route-scope check passed for all 73 route files.
- The frontend production build passed with existing bundle/dynamic-import warnings; focused lint passed with no warnings.
- Per-file TypeScript transpilation found zero syntax errors across eight changed/new backend source files; this is not semantic type-checking.
- A headless browser check used live local catalogue reads with intercepted HTTP responses and fixture-only saves. It passed saved-code hydration, undotted search, selection, fixture save/reload, and clear/reload without page errors. Screenshot: `artifacts/icd10-drawer.png`.

Run isolated tests:

```powershell
node node_modules/vitest/vitest.mjs run --config vitest.icd10.config.ts
```

The browser harness is `Medflow-FE/scripts/icd10-drawer-smoke.html`. To reproduce the check, run the frontend Vite server and invoke `src/scripts/verifyIcd10Drawer.ts` through tsx, passing a module that exports `puppeteer`. `FRONTEND_URL` and `CHROME_PATH` can override defaults.

Authenticated patient save/reload through the complete application has not been tested; browser saves above are fixture-only. Full and focused backend type-check attempts, and a low-memory whole-project emit attempt, exhausted Windows memory/page-file capacity; backend build and semantic type-checking are not verified. These checks do not establish release readiness.
