import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { getNextId } from '../../src/utils/opendental-ids.util';

// The owner connection (bypasses RLS) is used only to seed the fixtures.
const ownerUrl = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL || '';

const ownerPrisma = new PrismaClient({
  datasources: {
    db: { url: ownerUrl },
  },
});

// The app connection (subject to RLS) is used for the tests themselves. It MUST
// resolve to the restricted medflow_app role — a superuser bypasses RLS
// unconditionally and every assertion below would pass vacuously.
//
// Deriving it from DATABASE_URL only works where that URL names the `medflow`
// owner (the Docker compose setup). Anywhere else — CI connects as `postgres` —
// the string replacements are a no-op and the derived URL is the *owner* URL,
// which used to sail through to the superuser probe in beforeAll and fail there
// with no hint of why. Detect that here instead and name the variable to set.
function resolveRlsUrl(): string {
  if (process.env.RLS_TEST_DATABASE_URL) return process.env.RLS_TEST_DATABASE_URL;
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'RLS tests need a database: set RLS_TEST_DATABASE_URL (medflow_app role) or DATABASE_URL.'
    );
  }
  const derived = process.env.DATABASE_URL
    .replace('medflow:', 'medflow_app:')
    .replace('MedflowPass123!', process.env.APP_DB_PASSWORD || 'MedflowAppPass123!');
  if (derived === process.env.DATABASE_URL) {
    throw new Error(
      [
        'Cannot derive an RLS (medflow_app) connection from DATABASE_URL —',
        'it does not name the `medflow` owner role, so the derived URL would be',
        'the owner connection and the tests would silently bypass RLS.',
        '',
        'Set RLS_TEST_DATABASE_URL to the medflow_app connection string, e.g.',
        '  postgresql://medflow_app:<APP_DB_PASSWORD>@localhost:5432/<db>',
        'and make sure `npm run rls:apply` has run against that database.',
      ].join('\n')
    );
  }
  return derived;
}

const appPrisma = new PrismaClient({
  datasources: {
    db: { url: resolveRlsUrl() },
  },
});

describe('Row Level Security (RLS)', () => {
  let group1Id: number;
  let group2Id: number;
  let branchANum: bigint;
  let branchBNum: bigint;
  let branchDNum: bigint;
  let branchCNum: bigint; // standalone clinic: GroupNum stays NULL, never assigned to a practicegroup

  let patA: bigint;
  let patB: bigint;
  let patD: bigint;
  let patARestricted: bigint;
  let patC: bigint; // belongs to the standalone clinic — GroupNum is NULL

  // Populated by the P0 write-scope test below so afterAll can clean up
  // whatever it managed to insert.
  const writeScopePatNums: bigint[] = [];

  beforeAll(async () => {
    // Assert current_user and rolsuper first
    const probe = await appPrisma.$queryRaw<Array<{ current_user: string; rolsuper: boolean }>>`
      SELECT current_user, r.rolsuper 
      FROM pg_roles r 
      WHERE r.rolname = current_user
    `;
    
    if (probe[0].rolsuper) {
      throw new Error('RLS test connection is a superuser! Tests would bypass RLS and be invalid.');
    }
    
    expect(probe[0].current_user).not.toBe('postgres');
    expect(probe[0].rolsuper).toBe(false);

    // Seed fixtures with the owner connection
    // Groups
    const g1 = await ownerPrisma.practicegroup.create({ data: { name: 'Group 1' } });
    const g2 = await ownerPrisma.practicegroup.create({ data: { name: 'Group 2' } });
    group1Id = g1.id;
    group2Id = g2.id;

    // Branches
    const clinicA = await ownerPrisma.clinic.create({ data: { ClinicNum: await getNextId('clinic', 'ClinicNum'), Description: 'Branch A', GroupNum: group1Id } });
    const clinicB = await ownerPrisma.clinic.create({ data: { ClinicNum: await getNextId('clinic', 'ClinicNum'), Description: 'Branch B', GroupNum: group1Id } });
    const clinicD = await ownerPrisma.clinic.create({ data: { ClinicNum: await getNextId('clinic', 'ClinicNum'), Description: 'Branch D', GroupNum: group2Id } });
    // Deliberately no GroupNum — reproduces the P0: any clinic not yet
    // assigned to a practicegroup.
    const clinicC = await ownerPrisma.clinic.create({ data: { ClinicNum: await getNextId('clinic', 'ClinicNum'), Description: 'Branch C (standalone)' } });
    branchANum = clinicA.ClinicNum;
    branchBNum = clinicB.ClinicNum;
    branchDNum = clinicD.ClinicNum;
    branchCNum = clinicC.ClinicNum;

    // Patients
    const pA = await ownerPrisma.patient.create({ data: { PatNum: await getNextId('patient', 'PatNum'), LName: 'Pat A', ClinicNum: branchANum, GroupNum: group1Id } });
    const pB = await ownerPrisma.patient.create({ data: { PatNum: await getNextId('patient', 'PatNum'), LName: 'Pat B', ClinicNum: branchBNum, GroupNum: group1Id } });
    const pD = await ownerPrisma.patient.create({ data: { PatNum: await getNextId('patient', 'PatNum'), LName: 'Pat D', ClinicNum: branchDNum, GroupNum: group2Id } });
    const pAR = await ownerPrisma.patient.create({ data: { PatNum: await getNextId('patient', 'PatNum'), LName: 'Pat A Restricted', ClinicNum: branchANum, GroupNum: group1Id, cross_branch_restricted: true } });
    const pC = await ownerPrisma.patient.create({ data: { PatNum: await getNextId('patient', 'PatNum'), LName: 'Pat C', ClinicNum: branchCNum, GroupNum: null } });
    patA = pA.PatNum;
    patB = pB.PatNum;
    patD = pD.PatNum;
    patARestricted = pAR.PatNum;
    patC = pC.PatNum;

    // Payments
    await ownerPrisma.payment.create({ data: { PayNum: await getNextId('payment', 'PayNum'), PatNum: patA, ClinicNum: branchANum, PayAmt: 100 } });
    await ownerPrisma.payment.create({ data: { PayNum: await getNextId('payment', 'PayNum'), PatNum: patB, ClinicNum: branchBNum, PayAmt: 200 } });
    await ownerPrisma.payment.create({ data: { PayNum: await getNextId('payment', 'PayNum'), PatNum: patD, ClinicNum: branchDNum, PayAmt: 400 } });
    await ownerPrisma.payment.create({ data: { PayNum: await getNextId('payment', 'PayNum'), PatNum: patARestricted, ClinicNum: branchANum, PayAmt: 800 } });
  });

  afterAll(async () => {
    // Every id here is `let`-declared and only assigned in beforeAll, so if
    // beforeAll threw part-way (or before its first insert) some are still
    // undefined. Passing those straight to `in:` raises a
    // PrismaClientValidationError that vitest reports *alongside* the real
    // beforeAll failure, which is how a plain "connection is a superuser"
    // turned into a confusing two-error build failure. Drop the blanks and
    // skip the delete entirely when there is nothing to clean up.
    const defined = <T>(ids: (T | undefined)[]): T[] => ids.filter((id): id is T => id !== undefined);

    const allPatNums = defined([patA, patB, patD, patARestricted, patC, ...writeScopePatNums]);
    const allClinicNums = defined([branchANum, branchBNum, branchDNum, branchCNum]);
    const allGroupIds = defined([group1Id, group2Id]);

    try {
      // Cleanup with owner connection. Ordered child-first: payments reference
      // patients, patients reference clinics, clinics reference practicegroups.
      if (allPatNums.length > 0) {
        await ownerPrisma.payment.deleteMany({ where: { PatNum: { in: allPatNums } } });
        await ownerPrisma.patient.deleteMany({ where: { PatNum: { in: allPatNums } } });
      }
      if (allClinicNums.length > 0) {
        await ownerPrisma.clinic.deleteMany({ where: { ClinicNum: { in: allClinicNums } } });
      }
      if (allGroupIds.length > 0) {
        await ownerPrisma.practicegroup.deleteMany({ where: { id: { in: allGroupIds } } });
      }
    } finally {
      // Always release both pools, even if cleanup failed — a leaked pool keeps
      // the vitest process alive after the run.
      await ownerPrisma.$disconnect();
      await appPrisma.$disconnect();
    }
  });

  const withRls = async (clinicIds: string, groupId: string, sharing: string, fn: (tx: any) => Promise<void>) => {
    return appPrisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT
          set_config('app.clinic_ids', ${clinicIds}, true),
          set_config('app.patient_group_id', ${groupId}, true),
          set_config('app.shared', ${sharing}, true)
      `;
      await fn(tx);
    });
  };

  it('empty scope returns nothing', async () => {
    await withRls('', '', '', async (tx) => {
      const patients = await tx.patient.findMany({ where: { PatNum: { in: [patA, patB, patD] } } });
      const payments = await tx.payment.findMany({ where: { PatNum: { in: [patA, patB, patD] } } });
      expect(patients.length).toBe(0);
      expect(payments.length).toBe(0);
    });
  });

  it('cross-group isolation is strictly enforced', async () => {
    // Branch A user in Group 1
    await withRls(branchANum.toString(), group1Id.toString(), '', async (tx) => {
      const patients = await tx.patient.findMany({ where: { PatNum: patD } });
      const payments = await tx.payment.findMany({ where: { PatNum: patD } });
      expect(patients.length).toBe(0);
      expect(payments.length).toBe(0);
    });
  });

  it('WITH CHECK blocks cross-branch writes', async () => {
    // Branch A user cannot insert for Branch B
    await withRls(branchANum.toString(), group1Id.toString(), 'FINANCIAL:GROUP_READ', async (tx) => {
      const payNum = await getNextId('payment', 'PayNum');
      await expect(
        tx.payment.create({ data: { PayNum: payNum, PatNum: patA, ClinicNum: branchBNum, PayAmt: 50 } })
      ).rejects.toThrow();
    });
  });

  it('\'*\' bypasses RLS', async () => {
    await withRls('*', '*', '', async (tx) => {
      const patients = await tx.patient.findMany({ where: { PatNum: { in: [patA, patB, patD] } } });
      expect(patients.length).toBeGreaterThanOrEqual(3);
    });
  });

  // KNOWN COUPLING — FINANCIAL:GROUP_READ is NOT independent of IDENTITY:GROUP_READ.
  //
  // 06-shared-read.sql's shared_read policy resolves the patient's group with
  // `EXISTS (SELECT 1 FROM patient p WHERE p."PatNum" = payment."PatNum" ...)`.
  // Postgres applies `patient`'s OWN row-level security inside that subquery, so
  // a caller who cannot see the patient row cannot see their payments either.
  // Once 04-patient-group-visibility.sql gated group-wide patient reads behind
  // mf.shared_mode('IDENTITY') = 'GROUP_READ', FINANCIAL:GROUP_READ stopped
  // widening anything on its own — the same applies to IMAGING:GROUP_READ.
  //
  // These tests pin the behaviour that is actually enforced today, not the
  // intent 06-shared-read.sql documents. Making the two switches independent
  // again needs a SECURITY DEFINER helper for the group check (so it is not
  // subject to patient RLS), which would WIDEN access and is a deliberate
  // decision, not a test fix.
  it('FINANCIAL + IDENTITY GROUP_READ widens reads but not writes', async () => {
    // Branch A user
    await withRls(branchANum.toString(), group1Id.toString(), 'FINANCIAL:GROUP_READ,IDENTITY:GROUP_READ', async (tx) => {
      // Can read Branch B payment
      const payments = await tx.payment.findMany({ where: { PatNum: patB } });
      expect(payments.length).toBe(1);

      // But cannot read Group 2 (Branch D) payment
      const dPayments = await tx.payment.findMany({ where: { PatNum: patD } });
      expect(dPayments.length).toBe(0);
    });

    // Without any sharing, cannot read Branch B payment
    await withRls(branchANum.toString(), group1Id.toString(), '', async (tx) => {
      const payments = await tx.payment.findMany({ where: { PatNum: patB } });
      expect(payments.length).toBe(0);
    });
  });

  it('FINANCIAL:GROUP_READ alone is currently inert (patient RLS gates the subquery)', async () => {
    await withRls(branchANum.toString(), group1Id.toString(), 'FINANCIAL:GROUP_READ', async (tx) => {
      // The sibling-branch patient is invisible (IDENTITY sharing is off), so
      // shared_read's EXISTS finds nothing and the payment stays hidden.
      const siblingPatient = await tx.patient.findMany({ where: { PatNum: patB } });
      expect(siblingPatient.length).toBe(0);

      const payments = await tx.payment.findMany({ where: { PatNum: patB } });
      expect(payments.length).toBe(0);
    });
  });

  it('IDENTITY:GROUP_READ widens reads for patient', async () => {
    await withRls(branchANum.toString(), group1Id.toString(), 'IDENTITY:GROUP_READ', async (tx) => {
      // Can read Branch B patient
      const patients = await tx.patient.findMany({ where: { PatNum: patB } });
      expect(patients.length).toBe(1);
      
      // But cannot read Group 2 (Branch D) patient
      const dPatients = await tx.patient.findMany({ where: { PatNum: patD } });
      expect(dPatients.length).toBe(0);
    });
  });

  it('cross_branch_restricted hides rows', async () => {
    // Branch B user attempting to view Branch A restricted patient's payment
    await withRls(branchBNum.toString(), group1Id.toString(), 'FINANCIAL:GROUP_READ', async (tx) => {
      const payments = await tx.payment.findMany({ where: { PatNum: patARestricted } });
      expect(payments.length).toBe(0); // Hidden
    });

    // Branch A user can still see it
    await withRls(branchANum.toString(), group1Id.toString(), 'FINANCIAL:GROUP_READ', async (tx) => {
      const payments = await tx.payment.findMany({ where: { PatNum: patARestricted } });
      expect(payments.length).toBe(1); // Visible to own branch
    });
  });

  // ── P0: patient_read_group had no own-branch fallback ─────────────────
  // clinic.GroupNum is nullable; a clinic not yet assigned to a
  // practicegroup used to make ALL patient reads for that clinic return
  // empty, because the SELECT policy only ever matched on GroupNum.
  describe('P0 fix: patient_read_group own-branch fallback', () => {
    it('scenario 1 — standalone clinic (GroupNum NULL) reads its own patients', async () => {
      // '0' is the sentinel src/config/db.ts now writes for a NULL GroupNum.
      await withRls(branchCNum.toString(), '0', '', async (tx) => {
        const own = await tx.patient.findMany({ where: { PatNum: patC } });
        expect(own.length).toBe(1);

        // Zero rows for a clinic that isn't theirs.
        const other = await tx.patient.findMany({ where: { PatNum: patA } });
        expect(other.length).toBe(0);
      });

      // Empty string must behave identically — it's what the GUC held
      // before the Step 5 defensive fix, and old sessions/paths may still
      // produce it.
      await withRls(branchCNum.toString(), '', '', async (tx) => {
        const own = await tx.patient.findMany({ where: { PatNum: patC } });
        expect(own.length).toBe(1);
      });
    });

    it('scenario 2 — grouped clinic sees sibling branches in the same group, not other groups', async () => {
      // Branch A user, scoped to their own clinic only — group-wide
      // visibility must come from app.patient_group_id, not from having
      // every sibling ClinicNum pre-expanded into app.clinic_ids. That is
      // what this scenario checks; IDENTITY:GROUP_READ is passed because
      // patient_read_group's group arm is gated on it (the HIPAA
      // minimum-necessary fix documented in 04-patient-group-visibility.sql),
      // and without it the sibling read below is denied before the mechanism
      // under test is ever exercised.
      await withRls(branchANum.toString(), group1Id.toString(), 'IDENTITY:GROUP_READ', async (tx) => {
        const ownBranch = await tx.patient.findMany({ where: { PatNum: patA } });
        expect(ownBranch.length).toBe(1);

        const siblingBranch = await tx.patient.findMany({ where: { PatNum: patB } });
        expect(siblingBranch.length).toBe(1);

        const otherGroup = await tx.patient.findMany({ where: { PatNum: patD } });
        expect(otherGroup.length).toBe(0);
      });
    });

    it('scenario 3 — cross-group isolation holds even when the caller names the other group directly', async () => {
      // Confirms this runs as the restricted medflow_app role (asserted in
      // beforeAll for the whole suite), not the superuser.
      await withRls(branchANum.toString(), group1Id.toString(), '', async (tx) => {
        const rows = await tx.patient.findMany({ where: { GroupNum: group2Id } });
        expect(rows.length).toBe(0);
      });
    });

    it('scenario 4 — group-wide reads do not widen writes: still branch-scoped only', async () => {
      await withRls(branchANum.toString(), group1Id.toString(), '', async (tx) => {
        // Own branch: allowed.
        const ownPatNum = await getNextId('patient', 'PatNum');
        const created = await tx.patient.create({
          data: { PatNum: ownPatNum, LName: 'Write Scope Own', ClinicNum: branchANum, GroupNum: group1Id },
        });
        writeScopePatNums.push(created.PatNum);

        // Sibling branch in the SAME group: still rejected, despite reads
        // being group-wide for this same caller (previous scenario).
        const siblingPatNum = await getNextId('patient', 'PatNum');
        await expect(
          tx.patient.create({
            data: { PatNum: siblingPatNum, LName: 'Write Scope Sibling', ClinicNum: branchBNum, GroupNum: group1Id },
          })
        ).rejects.toThrow();
      });
    });
  });
});
