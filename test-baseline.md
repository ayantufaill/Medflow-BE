# Test Baseline (T0)

- Branch: `rbac-surface`
- Date: 2026-09-30

## Results

```
 Test Files  9 failed | 66 passed (75)
      Tests  35 failed | 576 passed (611)
```

### Failed Tests
- `tests/recare-due-dates.test.ts` (Multiple failures related to expected vs received dates)
- `tests/rooms.test.ts` (creates a room and finds it in the list)
- `tests/services/treatment-plan.service.test.ts` (PrismaClientKnownRequestError: Foreign key constraint violated on `fk_proctp_1_TreatPlanNum`)
- More...

We will track these as the baseline and make sure we do not regress.
