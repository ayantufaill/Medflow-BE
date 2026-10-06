/**
 * UAT fixtures for the "MedFlow RBAC Validation & Sign-Off Guide":
 *   Group 1 Sunrise Dental Group — Branch A (Sunrise Downtown), Branch B (Sunrise Uptown)
 *   Group 2 City Smiles          — City Smiles Main (single-clinic edge case)
 * plus one account per role (new 8-role model), the three test patients,
 * providers for the dentists/hygienist, and an operatory per branch.
 *
 * Idempotent: re-running reuses existing rows, re-attaches roles/branches and
 * resets every test password, so it can be used to reset UAT between rounds.
 * Requires seed:roles and seedNewModelRoles to have run (both are in seed:all).
 *
 * Usage: npm run seed:uat-rbac
 */
// Unrestricted tenant context for RLS — must be imported before any query.
import '../config/seed-context';
import { prisma } from '../config/db';
import { getNextId } from '../utils/opendental-ids.util';
import { hashPassword } from '../utils/password.util';
import { setUserMeta } from '../utils/opendental-auth.util';

const PASSWORD = process.env.UAT_PASSWORD || 'MedFlow@Test1!';

type BranchKey = 'A' | 'B' | 'CS';

interface TestUser {
  email: string;
  firstName: string;
  lastName: string;
  role: string; // usergroup.Description
  branches: BranchKey[];
  provider?: { abbr: string; isHygienist?: boolean };
}

const USERS: TestUser[] = [
  { email: 'sarah.admin@sunrisedental.test', firstName: 'Sarah', lastName: 'Malik', role: 'group_admin', branches: ['A', 'B'] },
  { email: 'james.downtown@sunrisedental.test', firstName: 'James', lastName: 'Porter', role: 'branch_admin', branches: ['A'] },
  { email: 'dr.ahmed@sunrisedental.test', firstName: 'Ahmed', lastName: 'Raza', role: 'dentist', branches: ['A'], provider: { abbr: 'DRAHM' } },
  { email: 'lisa.hygiene@sunrisedental.test', firstName: 'Lisa', lastName: 'Torres', role: 'hygienist', branches: ['A'], provider: { abbr: 'HYLIS', isHygienist: true } },
  { email: 'mike.assist@sunrisedental.test', firstName: 'Mike', lastName: 'Farooq', role: 'dental_assistant', branches: ['A'] },
  { email: 'nadia.fd@sunrisedental.test', firstName: 'Nadia', lastName: 'Khan', role: 'front_desk', branches: ['A'] },
  { email: 'omar.billing@sunrisedental.test', firstName: 'Omar', lastName: 'Billing', role: 'billing', branches: ['A'] },
  { email: 'emma.uptown@sunrisedental.test', firstName: 'Emma', lastName: 'Uptown', role: 'branch_admin', branches: ['B'] },
  { email: 'dr.chen@sunrisedental.test', firstName: 'Sarah', lastName: 'Chen', role: 'dentist', branches: ['B'], provider: { abbr: 'DRCHN' } },
  { email: 'owner@citysmiles.test', firstName: 'Raj', lastName: 'Patel', role: 'group_admin', branches: ['CS'] },
  // Portals
  { email: 'ali.tariq@patient.test', firstName: 'Ali', lastName: 'Tariq', role: 'Patient', branches: ['A'] },
  { email: 'lab@crownlab.test', firstName: 'Crown Lab', lastName: 'Co.', role: 'Lab', branches: ['A'] },
];

// The patient portal finds the patient by matching the login email to patient.Email.
const PATIENTS = [
  { first: 'Ali', last: 'Tariq', email: 'ali.tariq@patient.test', branch: 'A' as BranchKey, label: 'PT-001' },
  { first: 'Sara', last: 'Khan', email: 'sara.khan@patient.test', branch: 'B' as BranchKey, label: 'PT-002' },
  { first: 'John', last: 'Doe', email: 'john.doe@patient.test', branch: 'CS' as BranchKey, label: 'PT-003' },
  // Extra patients so lists look real. No name contains "ali", "sara" or "john":
  // the visibility checks search for exactly those three.
  { first: 'Usman', last: 'Qureshi', email: 'usman.qureshi@patient.test', branch: 'A' as BranchKey, label: 'PT-004' },
  { first: 'Hina', last: 'Baig', email: 'hina.baig@patient.test', branch: 'A' as BranchKey, label: 'PT-005' },
  { first: 'Daniel', last: 'Brooks', email: 'daniel.brooks@patient.test', branch: 'A' as BranchKey, label: 'PT-006' },
  { first: 'Maria', last: 'Lopez', email: 'maria.lopez@patient.test', branch: 'A' as BranchKey, label: 'PT-007' },
  { first: 'Bilal', last: 'Chaudhry', email: 'bilal.chaudhry@patient.test', branch: 'A' as BranchKey, label: 'PT-008' },
  { first: 'Emily', last: 'Carter', email: 'emily.carter@patient.test', branch: 'A' as BranchKey, label: 'PT-009' },
  { first: 'Fatima', last: 'Noor', email: 'fatima.noor@patient.test', branch: 'A' as BranchKey, label: 'PT-010' },
  { first: 'Ayesha', last: 'Siddiqui', email: 'ayesha.siddiqui@patient.test', branch: 'B' as BranchKey, label: 'PT-011' },
  { first: 'Ryan', last: 'Cooper', email: 'ryan.cooper@patient.test', branch: 'B' as BranchKey, label: 'PT-012' },
  { first: 'Hamza', last: 'Rehman', email: 'hamza.rehman@patient.test', branch: 'B' as BranchKey, label: 'PT-013' },
  { first: 'Olivia', last: 'Green', email: 'olivia.green@patient.test', branch: 'B' as BranchKey, label: 'PT-014' },
  { first: 'Kamran', last: 'Butt', email: 'kamran.butt@patient.test', branch: 'B' as BranchKey, label: 'PT-015' },
  { first: 'Grace', last: 'Kim', email: 'grace.kim@patient.test', branch: 'B' as BranchKey, label: 'PT-016' },
  { first: 'Imran', last: 'Shah', email: 'imran.shah@patient.test', branch: 'CS' as BranchKey, label: 'PT-017' },
  { first: 'Rabia', last: 'Aslam', email: 'rabia.aslam@patient.test', branch: 'CS' as BranchKey, label: 'PT-018' },
  { first: 'Thomas', last: 'Reed', email: 'thomas.reed@patient.test', branch: 'CS' as BranchKey, label: 'PT-019' },
  { first: 'Zoe', last: 'Turner', email: 'zoe.turner@patient.test', branch: 'CS' as BranchKey, label: 'PT-020' },
];

const findOrCreateGroup = async (name: string) =>
  (await prisma.practicegroup.findFirst({ where: { name } })) ??
  (await prisma.practicegroup.create({ data: { name } }));

const findOrCreateClinic = async (description: string, groupId: number, city: string, state: string) => {
  const existing = await prisma.clinic.findFirst({ where: { Description: description } });
  // Feature flags start off (T-FD-02 turns treatment_coordinator on for Branch A).
  const data = { GroupNum: groupId, City: city, State: state, IsHidden: 0, features: { treatment_coordinator: false } };
  if (existing) return prisma.clinic.update({ where: { ClinicNum: existing.ClinicNum }, data });
  return prisma.clinic.create({
    data: { ClinicNum: await getNextId('clinic', 'ClinicNum'), Description: description, ...data },
  });
};

const ensureOperatory = async (clinicNum: bigint, name: string, abbrev: string) => {
  const existing = await prisma.operatory.findFirst({ where: { ClinicNum: clinicNum, OpName: name } });
  if (existing) return;
  await prisma.operatory.create({
    data: {
      OperatoryNum: await getNextId('operatory', 'OperatoryNum'),
      OpName: name,
      Abbrev: abbrev,
      ClinicNum: clinicNum,
      ItemOrder: 1,
      IsHidden: 0,
    },
  });
};

const ensureProvider = async (user: TestUser, clinicNums: bigint[]) => {
  const { abbr, isHygienist } = user.provider!;
  let provider = await prisma.provider.findFirst({ where: { Abbr: abbr } });
  if (!provider) {
    provider = await prisma.provider.create({
      data: {
        ProvNum: await getNextId('provider', 'ProvNum'),
        Abbr: abbr,
        FName: user.firstName,
        LName: user.lastName,
        IsHidden: 0,
        IsSecondary: isHygienist ? 1 : 0,
      },
    });
  }
  for (const clinicNum of clinicNums) {
    const linked = await prisma.providerclinic.findFirst({ where: { ProvNum: provider.ProvNum, ClinicNum: clinicNum } });
    if (!linked) {
      await prisma.providerclinic.create({
        data: { ProviderClinicNum: await getNextId('providerclinic', 'ProviderClinicNum'), ProvNum: provider.ProvNum, ClinicNum: clinicNum },
      });
      await prisma.providercliniclink.create({
        data: { ProviderClinicLinkNum: await getNextId('providercliniclink', 'ProviderClinicLinkNum'), ProvNum: provider.ProvNum, ClinicNum: clinicNum },
      });
    }
  }
  return provider.ProvNum;
};

async function main() {
  const passwordHash = await hashPassword(PASSWORD);

  const sunrise = await findOrCreateGroup('Sunrise Dental Group');
  const citySmiles = await findOrCreateGroup('City Smiles');

  const clinics: Record<BranchKey, { ClinicNum: bigint }> = {
    A: await findOrCreateClinic('Sunrise Downtown', sunrise.id, 'Austin', 'TX'),
    B: await findOrCreateClinic('Sunrise Uptown', sunrise.id, 'Austin', 'TX'),
    CS: await findOrCreateClinic('City Smiles Main', citySmiles.id, 'Dallas', 'TX'),
  };
  await ensureOperatory(clinics.A.ClinicNum, 'Downtown Op 1', 'DT-1');
  await ensureOperatory(clinics.B.ClinicNum, 'Uptown Op 1', 'UT-1');
  await ensureOperatory(clinics.CS.ClinicNum, 'City Smiles Op 1', 'CS-1');

  const roles = await prisma.usergroup.findMany({
    where: { Description: { in: [...new Set(USERS.map((u) => u.role))] } },
  });
  const roleByName = new Map(roles.map((r) => [r.Description, r.UserGroupNum]));
  const missingRoles = USERS.map((u) => u.role).filter((r) => !roleByName.has(r));
  if (missingRoles.length) {
    throw new Error(`Missing roles: ${[...new Set(missingRoles)].join(', ')}. Run "npm run seed:roles" and "npx tsx src/scripts/seedNewModelRoles.ts" first.`);
  }

  for (const user of USERS) {
    const clinicNums = user.branches.map((b) => clinics[b].ClinicNum);
    const provNum = user.provider ? await ensureProvider(user, clinicNums) : null;

    let row = await prisma.userod.findFirst({ where: { UserName: user.email } });
    const userData = { Password: passwordHash, ClinicNum: clinicNums[0], ProvNum: provNum, IsHidden: 0 };
    row = row
      ? await prisma.userod.update({ where: { UserNum: row.UserNum }, data: userData })
      : await prisma.userod.create({ data: { UserNum: await getNextId('userod', 'UserNum'), UserName: user.email, ...userData } });

    await setUserMeta(row.UserNum, {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      isActive: true,
      passwordHash,
      failedLoginAttempts: 0,
      accountLockedUntil: null,
    });

    // Exactly one role per test user, so a previous run with a different role can't linger.
    await prisma.usergroupattach.deleteMany({ where: { UserNum: row.UserNum } });
    await prisma.usergroupattach.create({
      data: {
        UserGroupAttachNum: await getNextId('usergroupattach', 'UserGroupAttachNum'),
        UserNum: row.UserNum,
        UserGroupNum: roleByName.get(user.role)!,
      },
    });

    await prisma.userclinic.deleteMany({ where: { UserNum: row.UserNum } });
    for (const clinicNum of clinicNums) {
      await prisma.userclinic.create({
        data: { UserClinicNum: await getNextId('userclinic', 'UserClinicNum'), UserNum: row.UserNum, ClinicNum: clinicNum },
      });
    }
  }

  const patientRows: { label: string; name: string; patNum: bigint; branch: string }[] = [];
  for (const p of PATIENTS) {
    const clinic = clinics[p.branch];
    const groupId = p.branch === 'CS' ? citySmiles.id : sunrise.id;
    const data = { FName: p.first, LName: p.last, Email: p.email, ClinicNum: clinic.ClinicNum, GroupNum: groupId, PatStatus: 0, Birthdate: new Date(Date.UTC(1960 + ((patientRows.length * 7) % 45), (patientRows.length * 5) % 12, 1 + ((patientRows.length * 11) % 27))) };
    const existing = await prisma.patient.findFirst({ where: { Email: p.email } });
    const patient = existing
      ? await prisma.patient.update({ where: { PatNum: existing.PatNum }, data })
      : await prisma.patient.create({ data: { PatNum: await getNextId('patient', 'PatNum'), ...data } });
    patientRows.push({ label: p.label, name: `${p.first} ${p.last}`, patNum: patient.PatNum, branch: p.branch });
  }

  const branchName: Record<BranchKey, string> = { A: 'Sunrise Downtown', B: 'Sunrise Uptown', CS: 'City Smiles Main' };
  console.log('\n✅ UAT RBAC fixtures ready');
  console.log(`   Password for every account: ${PASSWORD}\n`);
  console.log('   Branches (guide ClinicNum → actual):');
  console.log(`     Branch A  ${branchName.A.padEnd(18)} ClinicNum ${clinics.A.ClinicNum}  GroupNum ${sunrise.id}`);
  console.log(`     Branch B  ${branchName.B.padEnd(18)} ClinicNum ${clinics.B.ClinicNum}  GroupNum ${sunrise.id}`);
  console.log(`     City      ${branchName.CS.padEnd(18)} ClinicNum ${clinics.CS.ClinicNum}  GroupNum ${citySmiles.id}`);
  console.log('\n   Patients (guide PT-xxx → actual PatNum):');
  for (const p of patientRows) {
    console.log(`     ${p.label}  ${p.name.padEnd(10)} PatNum ${p.patNum}  (${branchName[p.branch as BranchKey]})`);
  }
  console.log('\n   Accounts:');
  for (const u of USERS) console.log(`     ${u.role.padEnd(16)} ${u.email}`);
}

main()
  .catch((err) => {
    console.error('Failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
