import { prisma } from '../config/db';
import { getRoleMeta, setRoleMeta } from '../utils/opendental-auth.util';

const GROUP_ADMIN_PERMISSIONS = {
  'clinical.cross_branch.view': true,
  'patients.read': true,
  'patients.create': true,
  'patients.update': true,
  'appointments.read': true,
  'appointments.create': true,
  'appointments.update': true,
  'appointments.delete': true,
  'appointments.schedule': true,
  'appointments.cancel': true,
  'clinical-notes.read': true,
  'clinical-notes.create': true,
  'clinical-notes.update': true,
  'clinical-notes.sign': true,
  'vital-signs.read': true,
  'vital-signs.create': true,
  'vital-signs.update': true,
  'prescriptions.read': true,
  'prescriptions.create': true,
  'prescriptions.update': true,
  'treatment-plans.read': true,
  'treatment-plans.create': true,
  'treatment-plans.update': true,
  'documents.read': true,
  'documents.create': true,
  'lab-orders.read': true,
  'lab-orders.create': true,
  'lab-orders.update': true,
  'lab-results.read': true,
  'referrals.read': true,
  'referrals.create': true,
  'referrals.update': true,
  'authorizations.read': true,
  'authorizations.create': true,
  'authorizations.update': true,
  'services.read': true,
  'insurance.read': true,
  'insurance.create': true,
  'insurance.update': true,
  'insurance.delete': true,
  'invoices.read': true,
  'invoices.create': true,
  'invoices.update': true,
  'invoices.delete': true,
  'invoices.process': true,
  'payments.read': true,
  'payments.create': true,
  'payments.update': true,
  'payments.delete': true,
  'payments.process': true,
  'claims.read': true,
  'claims.create': true,
  'claims.update': true,
  'claims.delete': true,
  'claims.process': true,
  'era.read': true,
  'era.create': true,
  'era.update': true,
  'era.delete': true,
  'era.process': true,
  'reports.read': true,
  'reports.financial': true,
  'reports.administrative': true,
  'group:view_analytics': true,
  'group:manage_users': true,
  'group:reassign_providers': true,
  'users.read': true,
  'users.create': true,
  'users.update': true,
  'reports.access': true,
  'reports.prod_income.all_providers': true,
  'security.audit.view': true,
  'sharing.manage': true,
  'branches.read': true,
  'branches.update': true,
  'practice-info.read': true,
  'practice-info.update': true,
};

const main = async () => {
  const role = await prisma.usergroup.findFirst({
    where: { Description: 'Group Admin' },
  });

  if (!role) {
    throw new Error('Missing role: Group Admin');
  }

  const existingMeta = await getRoleMeta(role.UserGroupNum);
  await setRoleMeta(role.UserGroupNum, {
    ...existingMeta,
    description: 'Multi-branch dental group administrator with operational access scoped to its practice group.',
    permissions: GROUP_ADMIN_PERMISSIONS,
    isSystemRole: existingMeta.isSystemRole ?? true,
    isActive: existingMeta.isActive ?? true,
  });

  console.log(`Updated Group Admin (${role.UserGroupNum.toString()})`);
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
