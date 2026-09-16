import { prisma } from '../config/db';
import { getNextId } from '../utils/opendental-ids.util';
import { setRoleMeta } from '../utils/opendental-auth.util';

// ─── PURE 4-GROUP PERMISSION SETS ─────────────────────────────────────────────

const ADMIN_GROUP_PERMISSIONS = {
  '*': true,
};

const CLINICAL_GROUP_PERMISSIONS = {
  'patients.read': true,
  'appointments.read': true,
  'appointments.update': true,
  'appointments.schedule': true,
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
  'documents.upload': true,
  'lab-orders.read': true,
  'lab-orders.create': true,
  'lab-orders.update': true,
  'lab-results.read': true,
  'referrals.read': true,
  'referrals.create': true,
  'referrals.update': true,
  'authorizations.read': true,
  'authorizations.create': true,
  'services.read': true,
  'insurance.read': true,
};

const OPERATIONS_GROUP_PERMISSIONS = {
  'patients.read': true,
  'patients.create': true,
  'patients.update': true,
  'appointments.read': true,
  'appointments.create': true,
  'appointments.update': true,
  'appointments.delete': true,
  'appointments.schedule': true,
  'appointments.cancel': true,
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
  'insurance.read': true,
  'insurance.create': true,
  'insurance.update': true,
  'insurance.delete': true,
  'authorizations.read': true,
  'authorizations.create': true,
  'authorizations.update': true,
  'documents.read': true,
  'documents.upload': true,
  'lab-orders.read': true,
  'lab-orders.create': true,
  'lab-orders.update': true,
  'lab-results.read': true,
  'lab-results.create': true,
  'lab-results.update': true,
  'services.read': true,
};

const PATIENT_GROUP_PERMISSIONS = {
  'profile.read': true,
  'profile.update': true,
  'appointments.read': true,
  'appointments.schedule': true,
  'invoices.read': true,
  'documents.read': true,
};

const roles = [
  // ─── Group 1: Administrative Group (ADMIN_GROUP) ───────────────────────────
  {
    name: 'Super Admin',
    description: 'Root platform administrator with full universal system authority.',
    permissions: {
      ...ADMIN_GROUP_PERMISSIONS,
      'platform:manage_practice_groups': true,
    },
    isSystemRole: true,
  },
  {
    name: 'Group Admin',
    description: 'Multi-branch dental group administrator with full platform authority.',
    permissions: ADMIN_GROUP_PERMISSIONS,
    isSystemRole: true,
  },
  {
    name: 'Branch Admin',
    description: 'Branch clinic administrator with full platform authority.',
    permissions: ADMIN_GROUP_PERMISSIONS,
    isSystemRole: true,
  },
  {
    name: 'Admin',
    description: 'Legacy Administrator role with universal authority.',
    permissions: ADMIN_GROUP_PERMISSIONS,
    isSystemRole: true,
  },

  // ─── Group 2: Clinical Group (CLINICAL_GROUP) ──────────────────────────────
  {
    name: 'Provider',
    description: 'Dentist / Healthcare Provider — clinical charting, notes, signing, and patient care.',
    permissions: CLINICAL_GROUP_PERMISSIONS,
    isSystemRole: true,
  },
  {
    name: 'Doctor',
    description: 'Doctor / Dentist — clinical charting, notes, signing, and patient care.',
    permissions: CLINICAL_GROUP_PERMISSIONS,
    isSystemRole: true,
  },
  {
    name: 'Hygienist',
    description: 'Dental Hygienist — clinical charting, notes, signing, and patient care.',
    permissions: CLINICAL_GROUP_PERMISSIONS,
    isSystemRole: true,
  },
  {
    name: 'Assistant',
    description: 'Dental Assistant — clinical charting, notes, signing, and patient care.',
    permissions: CLINICAL_GROUP_PERMISSIONS,
    isSystemRole: true,
  },
  {
    name: 'Dental Assistant',
    description: 'Dental Assistant — clinical charting, notes, signing, and patient care.',
    permissions: CLINICAL_GROUP_PERMISSIONS,
    isSystemRole: true,
  },
  {
    name: 'Clinical Staff',
    description: 'Clinical support staff — clinical charting, notes, signing, and patient care.',
    permissions: CLINICAL_GROUP_PERMISSIONS,
    isSystemRole: true,
  },

  // ─── Group 3: Operational & Business Group (OPERATIONS_GROUP) ───────────────
  {
    name: 'Front Desk',
    description: 'Front Desk Coordinator — scheduling, intake, billing, reports, and operations.',
    permissions: OPERATIONS_GROUP_PERMISSIONS,
    isSystemRole: true,
  },
  {
    name: 'Receptionist',
    description: 'Receptionist — scheduling, intake, billing, reports, and operations.',
    permissions: OPERATIONS_GROUP_PERMISSIONS,
    isSystemRole: true,
  },
  {
    name: 'Biller',
    description: 'Billing Specialist — scheduling, intake, billing, reports, and operations.',
    permissions: OPERATIONS_GROUP_PERMISSIONS,
    isSystemRole: true,
  },
  {
    name: 'Billing Staff',
    description: 'Billing Staff — scheduling, intake, billing, reports, and operations.',
    permissions: OPERATIONS_GROUP_PERMISSIONS,
    isSystemRole: true,
  },
  {
    name: 'Lab',
    description: 'Dental Lab Technician — scheduling, intake, billing, reports, and operations.',
    permissions: OPERATIONS_GROUP_PERMISSIONS,
    isSystemRole: true,
  },
  {
    name: 'Lab Technician',
    description: 'Dental Lab Technician — scheduling, intake, billing, reports, and operations.',
    permissions: OPERATIONS_GROUP_PERMISSIONS,
    isSystemRole: true,
  },

  // ─── Group 4: Patient Portal Group (PATIENT_GROUP) ─────────────────────────
  {
    name: 'Patient',
    description: 'Patient Portal Account — self-service portal access.',
    permissions: PATIENT_GROUP_PERMISSIONS,
    isSystemRole: true,
  },
];

const seedRoles = async () => {
  try {
    for (const roleData of roles) {
      const existing = await prisma.usergroup.findFirst({
        where: { Description: roleData.name },
      });
      if (!existing) {
        const nextId = await getNextId('usergroup', 'UserGroupNum');
        const role = await prisma.usergroup.create({
          data: {
            UserGroupNum: nextId,
            Description: roleData.name,
          },
        });
        await setRoleMeta(role.UserGroupNum, {
          description: roleData.description,
          permissions: roleData.permissions,
          isSystemRole: roleData.isSystemRole,
          isActive: true,
        });
      } else {
        await setRoleMeta(existing.UserGroupNum, {
          description: roleData.description,
          permissions: roleData.permissions,
          isSystemRole: roleData.isSystemRole,
          isActive: true,
        });
      }
    }
    console.log('Roles seeded successfully with Pure 4-Group permissions!');
  } catch (error) {
    console.error('Error seeding roles:', error);
  } finally {
    await prisma.$disconnect();
  }
};

seedRoles();
