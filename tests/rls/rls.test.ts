import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { getNextId } from '../../src/utils/opendental-ids.util';

// The owner connection (bypasses RLS) is used only to seed the fixtures.
const ownerPrisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL },
  },
});

// The app connection (subject to RLS) is used for the tests themselves.
const rlsUrl = process.env.RLS_TEST_DATABASE_URL || 
  (process.env.DATABASE_URL ? process.env.DATABASE_URL.replace('medflow:', 'medflow_app:').replace('MedflowPass123!', process.env.APP_DB_PASSWORD || 'MedflowAppPass123!') : '');

const appPrisma = new PrismaClient({
  datasources: {
    db: { url: rlsUrl },
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
    // Cleanup with owner connection
    const allPatNums = [patA, patB, patD, patARestricted, patC, ...writeScopePatNums];
    await ownerPrisma.payment.deleteMany({ where: { PatNum: { in: allPatNums } } });
    await ownerPrisma.patient.deleteMany({ where: { PatNum: { in: allPatNums } } });
    await ownerPrisma.clinic.deleteMany({ where: { ClinicNum: { in: [branchANum, branchBNum, branchDNum, branchCNum] } } });
    await ownerPrisma.practicegroup.deleteMany({ where: { id: { in: [group1Id, group2Id] } } });
    await ownerPrisma.$disconnect();
    await appPrisma.$disconnect();
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

  it('FINANCIAL:GROUP_READ widens reads but not writes', async () => {
    // Branch A user
    await withRls(branchANum.toString(), group1Id.toString(), 'FINANCIAL:GROUP_READ', async (tx) => {
      // Can read Branch B payment
      const payments = await tx.payment.findMany({ where: { PatNum: patB } });
      expect(payments.length).toBe(1);
      
      // But cannot read Group 2 (Branch D) payment
      const dPayments = await tx.payment.findMany({ where: { PatNum: patD } });
      expect(dPayments.length).toBe(0);
    });

    // Without it, cannot read Branch B payment
    await withRls(branchANum.toString(), group1Id.toString(), '', async (tx) => {
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
      // every sibling ClinicNum pre-expanded into app.clinic_ids.
      await withRls(branchANum.toString(), group1Id.toString(), '', async (tx) => {
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
