# HANDOFF: T3 Cross-Branch Read Paths

Person A, the new product requirement states that **within one practice group, staff at any branch can READ patient data created at any other branch** (patient appointments, procedure history, treatment plans, ledger).

I have audited the frontend and backend routes for Person B:
1. The frontend (React slices/services) does **NOT** apply `branchId` to patient-scoped views (e.g. chart, appointments, clinical history). It only applies `branchId` to branch-level views (calendar, schedules, users).
2. The backend controllers/routes (`getPatientAppointments`, etc.) also do not manually filter by `ClinicNum` unless requested by the frontend.
3. The `GET /api/patients/:patientId/appointments` route already exists and is wired up correctly.

**The blockage is entirely at the RLS / Tenant Context layer.**
Currently, `enterTenantContext` restricts all reads (except the `patient` table) to `req.branchAccess.clinicIds`.

### Actions Required by Person A:

1. **`src/middleware/tenantContext.middleware.ts` & `prisma/rls/*`**
   *Current behavior:* `clinicIds` governs reads on every RLS table except `patient`.
   *Needed:* You need to adjust the RLS policies in `03-policies-remaining.sql` (or `tenantContext.middleware.ts`) so that patient-scoped tables (`appointment`, `procedurelog`, `proctp`, `payplan`, `claim`, etc.) allow reads if the user is in the same `patientGroupId` as the patient.
   *Proposed change logic:* For `SELECT` on patient-linked tables, check if the patient's `GroupNum` matches `app.patient_group_id`.

2. **`src/services/appointment.service.ts`**
   - Line 804: `where.ClinicNum = BigInt(filters.branchId);`
   - Make sure this stays branch-scoped for schedule views, but ensure `getPatientAppointments` (Line 710 in `appointment.controller.ts`) is unaffected by any manual `ClinicNum` scoping, letting the RLS handle cross-branch visibility.

3. **`src/services/patient.service.ts`**
   - Line 121-125: Manual `where.ClinicNum` scoping for `getAllPatients`.
   - Ensure that `getPatientWorkspace` and other patient-scoped reads continue to bypass `ClinicNum` filtering.

Since I am not allowed to edit `appointment.service.ts`, `patient.service.ts`, `prisma/rls/*`, or `tenantContext.middleware.ts`, please apply these changes on your track to enable the cross-branch reading feature.
