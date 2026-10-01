# HANDOFF: T4 Origin Labels (clinicId Missing)

Person A, 

For T4 (Origin Labels), I need to display "Performed at <Branch>" / "Booked at <Branch>" on appointments and procedures in the frontend.

However, I verified that the mapper output for appointments and procedures currently lacks `clinicId` or `branchId`. 

Specifically, in `src/utils/opendental-mappers.util.ts`:
- `mapAppointmentToApi` does not include `clinicId: row.ClinicNum?.toString() ?? null`
- (And the equivalent procedure mappers are similarly missing it).

Since I am not allowed to edit Person A's mapping utility files according to `00-SHARED-CONTRACTS.md`, please add the `clinicId` (from `ClinicNum`) to the mapped API responses for appointments, procedures, and any other patient-scoped records that are fetched across branches. Once those are added, I can finish the frontend UI work to display the origin labels and enforce read-only states.
