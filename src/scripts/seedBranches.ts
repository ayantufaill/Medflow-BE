import { prisma } from '../config/db';
import { getNextId } from '../utils/opendental-ids.util';
import { RoleService } from '../services/role.service';
import { providerService } from '../services/provider.service';
import { GROUP_ADMIN_PERMISSIONS } from '../types/auth.types';
import { tenantContextStorage } from '../config/tenant-context';

const roleService = new RoleService();

/**
 * Seeds two scenarios needed to exercise the multi-branch / multi-tenant model:
 *
 * 1. "Bright Smile Dental Group" — one practicegroup with TWO branches
 *    (the existing Default Clinic + a new Westside branch), plus a
 *    "Group Admin" role held by one user so central-oversight-across-branches
 *    can be tested. Tests the "branches of one company" scenario.
 *
 * 2. "Riverside Family Dentistry" — a second, INDEPENDENT practicegroup with
 *    its own single clinic, unrelated to #1. Tests that one practice's staff
 *    cannot see another, unrelated practice's branches (the cloud SaaS
 *    isolation scenario).
 *
 * Idempotent — safe to re-run.
 */
async function main() {
  console.log('Seeding branches/groups test scenario...');

  // ── Scenario 1: Bright Smile Dental Group (2 branches) ────────────────────
  let brightSmileGroup = await prisma.practicegroup.findFirst({ where: { name: 'Bright Smile Dental Group' } });
  if (!brightSmileGroup) {
    brightSmileGroup = await prisma.practicegroup.create({ data: { name: 'Bright Smile Dental Group' } });
    console.log(`Created practicegroup: ${brightSmileGroup.name} (id=${brightSmileGroup.id})`);
  } else {
    console.log(`practicegroup "${brightSmileGroup.name}" already exists. Skipping create...`);
  }

  const defaultClinic = await prisma.clinic.findUnique({ where: { ClinicNum: 1n } });
  if (defaultClinic && defaultClinic.GroupNum !== brightSmileGroup.id) {
    await prisma.clinic.update({ where: { ClinicNum: 1n }, data: { GroupNum: brightSmileGroup.id } });
    console.log('Linked Default Clinic (ClinicNum=1) to Bright Smile Dental Group.');
  }

  let westsideClinic = await prisma.clinic.findFirst({ where: { Description: 'Westside Branch' } });
  if (!westsideClinic) {
    const westsideClinicNum = await getNextId('clinic', 'ClinicNum');
    westsideClinic = await prisma.clinic.create({
      data: {
        ClinicNum: westsideClinicNum,
        Description: 'Westside Branch',
        City: 'Austin',
        State: 'TX',
        GroupNum: brightSmileGroup.id,
      },
    });
    console.log(`Created clinic: ${westsideClinic.Description} (ClinicNum=${westsideClinic.ClinicNum})`);
  } else {
    console.log(`Clinic "${westsideClinic.Description}" already exists. Skipping create...`);
  }

  // Assign james.patel to the Westside branch only (branch-scoped staff).
  const branchStaffUser = await prisma.userod.findFirst({ where: { UserName: 'james.patel@medflow.com' } });
  if (branchStaffUser) {
    const existingAssignment = await prisma.userclinic.findFirst({
      where: { UserNum: branchStaffUser.UserNum, ClinicNum: westsideClinic.ClinicNum },
    });
    if (!existingAssignment) {
      const userClinicNum = await getNextId('userclinic', 'UserClinicNum');
      await prisma.userclinic.create({
        data: { UserClinicNum: userClinicNum, UserNum: branchStaffUser.UserNum, ClinicNum: westsideClinic.ClinicNum },
      });
      console.log(`Assigned ${branchStaffUser.UserName} to Westside Branch.`);
    }
  }

  // Grant sarah.mitchell a "Group Admin" role + a clinic assignment inside
  // Bright Smile, so she can be tested as the central-oversight owner who
  // should see BOTH branches of her group (but not Riverside's).
  let groupAdminRole = await roleService.getRoleByName('Group Admin');
  if (!groupAdminRole) {
    groupAdminRole = await roleService.createRole({
      name: 'Group Admin',
      description: 'Views/manages across all branches within their practicegroup.',
      permissions: {
        [GROUP_ADMIN_PERMISSIONS.VIEW_ANALYTICS]: true,
        [GROUP_ADMIN_PERMISSIONS.MANAGE_USERS]: true,
        [GROUP_ADMIN_PERMISSIONS.REASSIGN_PROVIDERS]: true,
      },
    });
    console.log(`Created role: ${groupAdminRole.name}`);
  }

  const groupOwnerUser = await prisma.userod.findFirst({ where: { UserName: 'sarah.mitchell@medflow.com' } });
  if (groupOwnerUser) {
    const roleNum = BigInt(groupAdminRole._id);
    const existingAttach = await prisma.usergroupattach.findFirst({
      where: { UserNum: groupOwnerUser.UserNum, UserGroupNum: roleNum },
    });
    if (!existingAttach) {
      const attachNum = await getNextId('usergroupattach', 'UserGroupAttachNum');
      await prisma.usergroupattach.create({
        data: { UserGroupAttachNum: attachNum, UserNum: groupOwnerUser.UserNum, UserGroupNum: roleNum },
      });
      console.log(`Granted Group Admin role to ${groupOwnerUser.UserName}.`);
    }

    const existingOwnerAssignment = await prisma.userclinic.findFirst({
      where: { UserNum: groupOwnerUser.UserNum, ClinicNum: 1n },
    });
    if (!existingOwnerAssignment) {
      const userClinicNum = await getNextId('userclinic', 'UserClinicNum');
      await prisma.userclinic.create({
        data: { UserClinicNum: userClinicNum, UserNum: groupOwnerUser.UserNum, ClinicNum: 1n },
      });
      console.log(`Assigned ${groupOwnerUser.UserName} to Default Clinic (their home branch within the group).`);
    }
  }

  // ── Scenario 2: Riverside Family Dentistry (independent practice) ─────────
  let riversideGroup = await prisma.practicegroup.findFirst({ where: { name: 'Riverside Family Dentistry' } });
  if (!riversideGroup) {
    riversideGroup = await prisma.practicegroup.create({ data: { name: 'Riverside Family Dentistry' } });
    console.log(`Created practicegroup: ${riversideGroup.name} (id=${riversideGroup.id})`);
  } else {
    console.log(`practicegroup "${riversideGroup.name}" already exists. Skipping create...`);
  }

  let riversideClinic = await prisma.clinic.findFirst({ where: { Description: 'Riverside Clinic' } });
  if (!riversideClinic) {
    const riversideClinicNum = await getNextId('clinic', 'ClinicNum');
    riversideClinic = await prisma.clinic.create({
      data: {
        ClinicNum: riversideClinicNum,
        Description: 'Riverside Clinic',
        City: 'Round Rock',
        State: 'TX',
        GroupNum: riversideGroup.id,
      },
    });
    console.log(`Created clinic: ${riversideClinic.Description} (ClinicNum=${riversideClinic.ClinicNum})`);
  } else {
    console.log(`Clinic "${riversideClinic.Description}" already exists. Skipping create...`);
  }

  // Assign linda.chen to Riverside only — an entirely separate practice's staff.
  const independentPracticeUser = await prisma.userod.findFirst({ where: { UserName: 'linda.chen@medflow.com' } });
  if (independentPracticeUser) {
    const existingAssignment = await prisma.userclinic.findFirst({
      where: { UserNum: independentPracticeUser.UserNum, ClinicNum: riversideClinic.ClinicNum },
    });
    if (!existingAssignment) {
      const userClinicNum = await getNextId('userclinic', 'UserClinicNum');
      await prisma.userclinic.create({
        data: { UserClinicNum: userClinicNum, UserNum: independentPracticeUser.UserNum, ClinicNum: riversideClinic.ClinicNum },
      });
      console.log(`Assigned ${independentPracticeUser.UserName} to Riverside Clinic.`);
    }
  }

  // ── Scenario 3: assign existing providers/patients to their branches ──────
  // Gives seedAppointments.ts real branch/room data to book into, instead of
  // everything silently landing in the global default room. Must run after
  // seedProviders.ts and seedPatients.ts (needs their records to exist).
  const defaultClinicNum = '1';
  const westsideClinicNum = westsideClinic.ClinicNum.toString();
  const riversideClinicNum = riversideClinic.ClinicNum.toString();

  // Ensure Riverside has at least one room — it had none, unlike the other branches.
  let riversideRoom = await prisma.operatory.findFirst({ where: { ClinicNum: riversideClinic.ClinicNum } });
  if (!riversideRoom) {
    const operatoryNum = await getNextId('operatory', 'OperatoryNum');
    riversideRoom = await prisma.operatory.create({
      data: {
        OperatoryNum: operatoryNum,
        OpName: 'Riverside Room 1',
        Abbrev: 'Riverside Room 1',
        ItemOrder: 0,
        IsHidden: 0,
        ClinicNum: riversideClinic.ClinicNum,
      },
    });
    console.log(`Created operatory: ${riversideRoom.OpName} (ClinicNum=${riversideClinicNum})`);
  }

  // Provider NPI → branch, mirroring seedProviders.ts's provider order and
  // seedAppointments.ts's provider→patient grouping.
  const providerBranchByNpi: Record<string, string> = {
    '1234567890': defaultClinicNum,  // Mitchell — Default Clinic
    '2345678901': westsideClinicNum, // Patel — Westside Branch
    '3456789012': riversideClinicNum, // Chen — Riverside Clinic
    '4567890123': defaultClinicNum,  // Torres — Default Clinic
    '5678901234': westsideClinicNum, // Kim — Westside Branch
  };

  for (const [npi, branchId] of Object.entries(providerBranchByNpi)) {
    const provider = await prisma.provider.findFirst({ where: { NationalProvID: npi } });
    if (!provider) continue;
    await providerService.updateProviderBranches(provider.ProvNum.toString(), [branchId]);
    console.log(`Assigned provider NPI ${npi} to branch ${branchId}.`);
  }

  // Same patient→branch grouping as seedAppointments.ts's PATIENT_EMAILS
  // (index 0–4 → Mitchell/branch 1, 5–9 → Patel/branch 2, etc.)
  const patientBranchByEmail: Record<string, string> = {
    'james.harrison@example.com': defaultClinicNum,
    'maria.gonzalez@example.com': defaultClinicNum,
    'david.kim@example.com': defaultClinicNum,
    'patricia.williams@example.com': defaultClinicNum,
    'michael.thompson@example.com': defaultClinicNum,
    'jennifer.martinez@example.com': westsideClinicNum,
    'robert.johnson@example.com': westsideClinicNum,
    'ashley.brown@example.com': westsideClinicNum,
    'christopher.davis@example.com': westsideClinicNum,
    'amanda.wilson@example.com': westsideClinicNum,
    'matthew.anderson@example.com': riversideClinicNum,
    'sophia.taylor@example.com': riversideClinicNum,
    'daniel.jackson@example.com': riversideClinicNum,
    'emily.white@example.com': riversideClinicNum,
    'joshua.harris@example.com': riversideClinicNum,
    'olivia.martin@example.com': defaultClinicNum,
    'andrew.garcia@example.com': defaultClinicNum,
    'samantha.lee@example.com': defaultClinicNum,
    'kevin.robinson@example.com': defaultClinicNum,
    'lauren.clark@example.com': defaultClinicNum,
    'tyler.lewis@example.com': westsideClinicNum,
    'natalie.walker@example.com': westsideClinicNum,
    'brandon.hall@example.com': westsideClinicNum,
    'rachel.young@example.com': westsideClinicNum,
    'jason.allen@example.com': westsideClinicNum,
  };

  let patientsAssigned = 0;
  for (const [email, branchId] of Object.entries(patientBranchByEmail)) {
    const patient = await prisma.patient.findFirst({ where: { Email: email } });
    if (!patient) continue;
    if (patient.ClinicNum?.toString() === branchId) continue;
    await prisma.patient.update({ where: { PatNum: patient.PatNum }, data: { ClinicNum: BigInt(branchId) } });
    patientsAssigned++;
  }
  console.log(`Assigned ${patientsAssigned} patient(s) to their branch.`);

  console.log('Done.');
  console.log({
    brightSmileGroup: { id: brightSmileGroup.id, clinics: [1, westsideClinic.ClinicNum.toString()] },
    riversideGroup: { id: riversideGroup.id, clinics: [riversideClinic.ClinicNum.toString()] },
    branchStaffUser: branchStaffUser?.UserName,
    groupOwnerUser: groupOwnerUser?.UserName,
    independentPracticeUser: independentPracticeUser?.UserName,
  });
}

// patient/appointment/providerclinic/operatory are RLS-scoped by ClinicNum.
// A standalone script has no AsyncLocalStorage tenant context, so without
// this every branch-assignment read/write above would be invisible to (or
// rejected by) RLS — the '*' wildcard is the same bypass a true system
// Admin gets, not a way around RLS.
tenantContextStorage.run({ clinicIds: '*' }, () => main())
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
