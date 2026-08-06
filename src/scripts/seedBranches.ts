import { prisma } from '../config/db';
import { getNextId } from '../utils/opendental-ids.util';
import { RoleService } from '../services/role.service';
import { GROUP_ADMIN_PERMISSIONS } from '../types/auth.types';

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

  console.log('Done.');
  console.log({
    brightSmileGroup: { id: brightSmileGroup.id, clinics: [1, westsideClinic.ClinicNum.toString()] },
    riversideGroup: { id: riversideGroup.id, clinics: [riversideClinic.ClinicNum.toString()] },
    branchStaffUser: branchStaffUser?.UserName,
    groupOwnerUser: groupOwnerUser?.UserName,
    independentPracticeUser: independentPracticeUser?.UserName,
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
