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

  let patA: bigint;
  let patB: bigint;
  let patD: bigint;
  let patARestricted: bigint;

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
    branchANum = clinicA.ClinicNum;
    branchBNum = clinicB.ClinicNum;
    branchDNum = clinicD.ClinicNum;

    // Patients
    const pA = await ownerPrisma.patient.create({ data: { PatNum: await getNextId('patient', 'PatNum'), LName: 'Pat A', ClinicNum: branchANum, GroupNum: group1Id } });
    const pB = await ownerPrisma.patient.create({ data: { PatNum: await getNextId('patient', 'PatNum'), LName: 'Pat B', ClinicNum: branchBNum, GroupNum: group1Id } });
    const pD = await ownerPrisma.patient.create({ data: { PatNum: await getNextId('patient', 'PatNum'), LName: 'Pat D', ClinicNum: branchDNum, GroupNum: group2Id } });
    const pAR = await ownerPrisma.patient.create({ data: { PatNum: await getNextId('patient', 'PatNum'), LName: 'Pat A Restricted', ClinicNum: branchANum, GroupNum: group1Id, cross_branch_restricted: true } });
    patA = pA.PatNum;
    patB = pB.PatNum;
    patD = pD.PatNum;
    patARestricted = pAR.PatNum;

    // Payments
    await ownerPrisma.payment.create({ data: { PayNum: await getNextId('payment', 'PayNum'), PatNum: patA, ClinicNum: branchANum, PayAmt: 100 } });
    await ownerPrisma.payment.create({ data: { PayNum: await getNextId('payment', 'PayNum'), PatNum: patB, ClinicNum: branchBNum, PayAmt: 200 } });
    await ownerPrisma.payment.create({ data: { PayNum: await getNextId('payment', 'PayNum'), PatNum: patD, ClinicNum: branchDNum, PayAmt: 400 } });
    await ownerPrisma.payment.create({ data: { PayNum: await getNextId('payment', 'PayNum'), PatNum: patARestricted, ClinicNum: branchANum, PayAmt: 800 } });
  });

  afterAll(async () => {
    // Cleanup with owner connection
    await ownerPrisma.payment.deleteMany({ where: { PatNum: { in: [patA, patB, patD, patARestricted] } } });
    await ownerPrisma.patient.deleteMany({ where: { PatNum: { in: [patA, patB, patD, patARestricted] } } });
    await ownerPrisma.clinic.deleteMany({ where: { ClinicNum: { in: [branchANum, branchBNum, branchDNum] } } });
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
});
