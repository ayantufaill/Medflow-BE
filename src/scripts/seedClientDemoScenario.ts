import { prisma } from '../config/db';
import { getNextId } from '../utils/opendental-ids.util';
import { hashPassword } from '../utils/password.util';
import { setUserMeta } from '../utils/opendental-auth.util';

const ensureRoleAttached = async (userNum: bigint, roleName: string) => {
  const role = await prisma.usergroup.findFirst({
    where: { Description: roleName },
  });
  if (!role) {
    console.warn(`Role "${roleName}" not found!`);
    return;
  }
  const existing = await prisma.usergroupattach.findFirst({
    where: { UserNum: userNum, UserGroupNum: role.UserGroupNum },
  });
  if (!existing) {
    const attachId = await getNextId('usergroupattach', 'UserGroupAttachNum');
    await prisma.usergroupattach.create({
      data: {
        UserGroupAttachNum: attachId,
        UserNum: userNum,
        UserGroupNum: role.UserGroupNum,
      },
    });
  }
};

const ensureUserClinic = async (userNum: bigint, clinicNum: bigint) => {
  const existing = await prisma.userclinic.findFirst({
    where: { UserNum: userNum, ClinicNum: clinicNum },
  });
  if (!existing) {
    const ucNum = await getNextId('userclinic', 'UserClinicNum');
    await prisma.userclinic.create({
      data: {
        UserClinicNum: ucNum,
        UserNum: userNum,
        ClinicNum: clinicNum,
      },
    });
  }
};

export async function seedClientDemoScenario() {
  console.log('🚀 Seeding US-Standard Multi-Tenant Client Demo Scenario...');

  const defaultPassword = 'Password123!';
  const passwordHash = await hashPassword(defaultPassword);

  // ══════════════════════════════════════════════════════════════════════════
  // GROUP 1: METRO DENTAL PARTNERS (Texas, USA)
  // ══════════════════════════════════════════════════════════════════════════
  let metroGroup = await prisma.practicegroup.findFirst({
    where: { name: 'Metro Dental Partners' },
  });
  if (!metroGroup) {
    metroGroup = await prisma.practicegroup.create({
      data: { name: 'Metro Dental Partners' },
    });
    console.log(`✅ Created Group: ${metroGroup.name} (ID: ${metroGroup.id})`);
  }

  // Branch 1: Downtown Austin Clinic
  let austinClinic = await prisma.clinic.findFirst({
    where: { Description: 'Downtown Austin Clinic' },
  });
  if (!austinClinic) {
    const clinicNum = await getNextId('clinic', 'ClinicNum');
    austinClinic = await prisma.clinic.create({
      data: {
        ClinicNum: clinicNum,
        Description: 'Downtown Austin Clinic',
        City: 'Austin',
        State: 'TX',
        GroupNum: metroGroup.id,
      },
    });
    console.log(`  🏢 Created Branch: Downtown Austin Clinic (ClinicNum: ${austinClinic.ClinicNum})`);
  } else if (austinClinic.GroupNum !== metroGroup.id) {
    await prisma.clinic.update({
      where: { ClinicNum: austinClinic.ClinicNum },
      data: { GroupNum: metroGroup.id },
    });
  }

  // Branch 2: Westlake Hills Branch
  let westlakeBranch = await prisma.clinic.findFirst({
    where: { Description: 'Westlake Hills Branch' },
  });
  if (!westlakeBranch) {
    const clinicNum = await getNextId('clinic', 'ClinicNum');
    westlakeBranch = await prisma.clinic.create({
      data: {
        ClinicNum: clinicNum,
        Description: 'Westlake Hills Branch',
        City: 'West Lake Hills',
        State: 'TX',
        GroupNum: metroGroup.id,
      },
    });
    console.log(`  🏢 Created Branch: Westlake Hills Branch (ClinicNum: ${westlakeBranch.ClinicNum})`);
  } else if (westlakeBranch.GroupNum !== metroGroup.id) {
    await prisma.clinic.update({
      where: { ClinicNum: westlakeBranch.ClinicNum },
      data: { GroupNum: metroGroup.id },
    });
  }

  // Operatory Rooms for Metro Dental
  let austinRoom = await prisma.operatory.findFirst({ where: { ClinicNum: austinClinic.ClinicNum } });
  if (!austinRoom) {
    const opNum = await getNextId('operatory', 'OperatoryNum');
    await prisma.operatory.create({
      data: {
        OperatoryNum: opNum,
        OpName: 'Austin Operatory 1',
        Abbrev: 'AUS-Op1',
        ClinicNum: austinClinic.ClinicNum,
        ItemOrder: 1,
        IsHidden: 0,
      },
    });
  }

  let westlakeRoom = await prisma.operatory.findFirst({ where: { ClinicNum: westlakeBranch.ClinicNum } });
  if (!westlakeRoom) {
    const opNum = await getNextId('operatory', 'OperatoryNum');
    await prisma.operatory.create({
      data: {
        OperatoryNum: opNum,
        OpName: 'Westlake Operatory 1',
        Abbrev: 'WL-Op1',
        ClinicNum: westlakeBranch.ClinicNum,
        ItemOrder: 1,
        IsHidden: 0,
      },
    });
  }

  // Users for Metro Dental Partners
  // 1A. David Miller (Group Admin)
  let davidUser = await prisma.userod.findFirst({ where: { UserName: 'metro.groupadmin@medflow.com' } });
  if (!davidUser) {
    const nextId = await getNextId('userod', 'UserNum');
    davidUser = await prisma.userod.create({
      data: {
        UserNum: nextId,
        UserName: 'metro.groupadmin@medflow.com',
        Password: passwordHash,
        ClinicNum: austinClinic.ClinicNum,
        IsHidden: 0,
      },
    });
  }
  await setUserMeta(davidUser.UserNum, {
    firstName: 'David',
    lastName: 'Miller',
    email: 'metro.groupadmin@medflow.com',
    isActive: true,
    passwordHash,
  });
  await ensureRoleAttached(davidUser.UserNum, 'Group Admin');
  await ensureUserClinic(davidUser.UserNum, austinClinic.ClinicNum);
  await ensureUserClinic(davidUser.UserNum, westlakeBranch.ClinicNum);

  // 1B. Austin Branch Admin (Branch Admin - Scoped to Austin only)
  let austinAdmin = await prisma.userod.findFirst({ where: { UserName: 'austin.branchadmin@medflow.com' } });
  if (!austinAdmin) {
    const nextId = await getNextId('userod', 'UserNum');
    austinAdmin = await prisma.userod.create({
      data: {
        UserNum: nextId,
        UserName: 'austin.branchadmin@medflow.com',
        Password: passwordHash,
        ClinicNum: austinClinic.ClinicNum,
        IsHidden: 0,
      },
    });
  }
  await setUserMeta(austinAdmin.UserNum, {
    firstName: 'Austin',
    lastName: 'Branch Admin',
    email: 'austin.branchadmin@medflow.com',
    isActive: true,
    passwordHash,
  });
  await ensureRoleAttached(austinAdmin.UserNum, 'Branch Admin');
  await ensureUserClinic(austinAdmin.UserNum, austinClinic.ClinicNum);

  // Patients for Metro Dental Partners
  const metroPatients = [
    { first: 'Michael', last: 'Johnson', clinic: austinClinic.ClinicNum },
    { first: 'Emily', last: 'Davis', clinic: westlakeBranch.ClinicNum },
    { first: 'Robert', last: 'Wilson', clinic: austinClinic.ClinicNum },
  ];
  for (const p of metroPatients) {
    const exists = await prisma.patient.findFirst({
      where: { FName: p.first, LName: p.last, GroupNum: metroGroup.id },
    });
    if (!exists) {
      const patNum = await getNextId('patient', 'PatNum');
      await prisma.patient.create({
        data: {
          PatNum: patNum,
          FName: p.first,
          LName: p.last,
          ClinicNum: p.clinic,
          GroupNum: metroGroup.id,
          PatStatus: 0,
          Birthdate: new Date('1988-04-12'),
        },
      });
      console.log(`    👤 Created Metro Dental Patient: ${p.first} ${p.last}`);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // GROUP 2: PACIFIC COAST DENTAL CARE (Washington, USA)
  // ══════════════════════════════════════════════════════════════════════════
  let pacificGroup = await prisma.practicegroup.findFirst({
    where: { name: 'Pacific Coast Dental Care' },
  });
  if (!pacificGroup) {
    pacificGroup = await prisma.practicegroup.create({
      data: { name: 'Pacific Coast Dental Care' },
    });
    console.log(`✅ Created Group: ${pacificGroup.name} (ID: ${pacificGroup.id})`);
  }

  // Branch 3: Seattle Central Clinic
  let seattleClinic = await prisma.clinic.findFirst({
    where: { Description: 'Seattle Central Clinic' },
  });
  if (!seattleClinic) {
    const clinicNum = await getNextId('clinic', 'ClinicNum');
    seattleClinic = await prisma.clinic.create({
      data: {
        ClinicNum: clinicNum,
        Description: 'Seattle Central Clinic',
        City: 'Seattle',
        State: 'WA',
        GroupNum: pacificGroup.id,
      },
    });
    console.log(`  🏢 Created Branch: Seattle Central Clinic (ClinicNum: ${seattleClinic.ClinicNum})`);
  } else if (seattleClinic.GroupNum !== pacificGroup.id) {
    await prisma.clinic.update({
      where: { ClinicNum: seattleClinic.ClinicNum },
      data: { GroupNum: pacificGroup.id },
    });
  }

  // Branch 4: Bellevue Medical Branch
  let bellevueBranch = await prisma.clinic.findFirst({
    where: { Description: 'Bellevue Medical Branch' },
  });
  if (!bellevueBranch) {
    const clinicNum = await getNextId('clinic', 'ClinicNum');
    bellevueBranch = await prisma.clinic.create({
      data: {
        ClinicNum: clinicNum,
        Description: 'Bellevue Medical Branch',
        City: 'Bellevue',
        State: 'WA',
        GroupNum: pacificGroup.id,
      },
    });
    console.log(`  🏢 Created Branch: Bellevue Medical Branch (ClinicNum: ${bellevueBranch.ClinicNum})`);
  } else if (bellevueBranch.GroupNum !== pacificGroup.id) {
    await prisma.clinic.update({
      where: { ClinicNum: bellevueBranch.ClinicNum },
      data: { GroupNum: pacificGroup.id },
    });
  }

  // Operatory Rooms for Pacific Coast
  let seattleRoom = await prisma.operatory.findFirst({ where: { ClinicNum: seattleClinic.ClinicNum } });
  if (!seattleRoom) {
    const opNum = await getNextId('operatory', 'OperatoryNum');
    await prisma.operatory.create({
      data: {
        OperatoryNum: opNum,
        OpName: 'Seattle Operatory 1',
        Abbrev: 'SEA-Op1',
        ClinicNum: seattleClinic.ClinicNum,
        ItemOrder: 1,
        IsHidden: 0,
      },
    });
  }

  let bellevueRoom = await prisma.operatory.findFirst({ where: { ClinicNum: bellevueBranch.ClinicNum } });
  if (!bellevueRoom) {
    const opNum = await getNextId('operatory', 'OperatoryNum');
    await prisma.operatory.create({
      data: {
        OperatoryNum: opNum,
        OpName: 'Bellevue Operatory 1',
        Abbrev: 'BEL-Op1',
        ClinicNum: bellevueBranch.ClinicNum,
        ItemOrder: 1,
        IsHidden: 0,
      },
    });
  }

  // Users for Pacific Coast Dental Care
  // 2A. Sarah Jenkins (Group Admin)
  let sarahUser = await prisma.userod.findFirst({ where: { UserName: 'pacific.groupadmin@medflow.com' } });
  if (!sarahUser) {
    const nextId = await getNextId('userod', 'UserNum');
    sarahUser = await prisma.userod.create({
      data: {
        UserNum: nextId,
        UserName: 'pacific.groupadmin@medflow.com',
        Password: passwordHash,
        ClinicNum: seattleClinic.ClinicNum,
        IsHidden: 0,
      },
    });
  }
  await setUserMeta(sarahUser.UserNum, {
    firstName: 'Sarah',
    lastName: 'Jenkins',
    email: 'pacific.groupadmin@medflow.com',
    isActive: true,
    passwordHash,
  });
  await ensureRoleAttached(sarahUser.UserNum, 'Group Admin');
  await ensureUserClinic(sarahUser.UserNum, seattleClinic.ClinicNum);
  await ensureUserClinic(sarahUser.UserNum, bellevueBranch.ClinicNum);

  // 2B. Seattle Branch Admin (Branch Admin - Scoped to Seattle only)
  let seattleAdmin = await prisma.userod.findFirst({ where: { UserName: 'seattle.branchadmin@medflow.com' } });
  if (!seattleAdmin) {
    const nextId = await getNextId('userod', 'UserNum');
    seattleAdmin = await prisma.userod.create({
      data: {
        UserNum: nextId,
        UserName: 'seattle.branchadmin@medflow.com',
        Password: passwordHash,
        ClinicNum: seattleClinic.ClinicNum,
        IsHidden: 0,
      },
    });
  }
  await setUserMeta(seattleAdmin.UserNum, {
    firstName: 'Seattle',
    lastName: 'Branch Admin',
    email: 'seattle.branchadmin@medflow.com',
    isActive: true,
    passwordHash,
  });
  await ensureRoleAttached(seattleAdmin.UserNum, 'Branch Admin');
  await ensureUserClinic(seattleAdmin.UserNum, seattleClinic.ClinicNum);

  // Patients for Pacific Coast Dental Care
  const pacificPatients = [
    { first: 'James', last: 'Anderson', clinic: seattleClinic.ClinicNum },
    { first: 'Olivia', last: 'Martinez', clinic: bellevueBranch.ClinicNum },
    { first: 'William', last: 'Taylor', clinic: seattleClinic.ClinicNum },
  ];
  for (const p of pacificPatients) {
    const exists = await prisma.patient.findFirst({
      where: { FName: p.first, LName: p.last, GroupNum: pacificGroup.id },
    });
    if (!exists) {
      const patNum = await getNextId('patient', 'PatNum');
      await prisma.patient.create({
        data: {
          PatNum: patNum,
          FName: p.first,
          LName: p.last,
          ClinicNum: p.clinic,
          GroupNum: pacificGroup.id,
          PatStatus: 0,
          Birthdate: new Date('1992-11-03'),
        },
      });
      console.log(`    👤 Created Pacific Coast Patient: ${p.first} ${p.last}`);
    }
  }

  console.log('\n✨ US Multi-Tenant Client Demo Scenario successfully seeded!');
  console.log('════════════════════════════════════════════════════════════');
  console.log('PLATFORM OWNER (Super Admin):');
  console.log('  Email:    superadmin@medflow.com');
  console.log('  Password: Password123!');
  console.log('  Sees:     Both Practice Groups & All 4 Branches');
  console.log('------------------------------------------------------------');
  console.log('TENANT 1: Metro Dental Partners (Texas, USA)');
  console.log('  Group Admin:  metro.groupadmin@medflow.com    (Sees Downtown Austin + Westlake Hills)');
  console.log('  Branch Admin: austin.branchadmin@medflow.com   (Sees Downtown Austin only)');
  console.log('  Patients:     Michael Johnson, Emily Davis, Robert Wilson');
  console.log('------------------------------------------------------------');
  console.log('TENANT 2: Pacific Coast Dental Care (Washington, USA)');
  console.log('  Group Admin:  pacific.groupadmin@medflow.com  (Sees Seattle Central + Bellevue Medical)');
  console.log('  Branch Admin: seattle.branchadmin@medflow.com  (Sees Seattle Central only)');
  console.log('  Patients:     James Anderson, Olivia Martinez, William Taylor');
  console.log('════════════════════════════════════════════════════════════');
}

seedClientDemoScenario()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
