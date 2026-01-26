import dotenv from 'dotenv';
import connectDB from '../config/db';
import { RoleModel } from '../models/role.model';
import { PERMISSIONS } from '../constants/permissions';

dotenv.config();

const defaultRoles = [
  {
    name: 'Admin',
    description: 'System administrator with full access to all features',
    permissions: new Map([
      // User Management
      [PERMISSIONS.USERS.CREATE, true],
      [PERMISSIONS.USERS.READ, true],
      [PERMISSIONS.USERS.UPDATE, true],
      [PERMISSIONS.USERS.DELETE, true],
      [PERMISSIONS.USERS.MANAGE, true],
      // Role Management
      [PERMISSIONS.ROLES.CREATE, true],
      [PERMISSIONS.ROLES.READ, true],
      [PERMISSIONS.ROLES.UPDATE, true],
      [PERMISSIONS.ROLES.DELETE, true],
      [PERMISSIONS.ROLES.MANAGE, true],
      // Patient Management
      [PERMISSIONS.PATIENTS.CREATE, true],
      [PERMISSIONS.PATIENTS.READ, true],
      [PERMISSIONS.PATIENTS.UPDATE, true],
      [PERMISSIONS.PATIENTS.DELETE, true],
      [PERMISSIONS.PATIENTS.VIEW_ALL, true],
      // Appointment Management
      [PERMISSIONS.APPOINTMENTS.CREATE, true],
      [PERMISSIONS.APPOINTMENTS.READ, true],
      [PERMISSIONS.APPOINTMENTS.UPDATE, true],
      [PERMISSIONS.APPOINTMENTS.DELETE, true],
      [PERMISSIONS.APPOINTMENTS.SCHEDULE, true],
      [PERMISSIONS.APPOINTMENTS.CANCEL, true],
      // Clinical Notes
      [PERMISSIONS.CLINICAL_NOTES.CREATE, true],
      [PERMISSIONS.CLINICAL_NOTES.READ, true],
      [PERMISSIONS.CLINICAL_NOTES.UPDATE, true],
      [PERMISSIONS.CLINICAL_NOTES.DELETE, true],
      [PERMISSIONS.CLINICAL_NOTES.SIGN, true],
      // Vital Signs
      [PERMISSIONS.VITAL_SIGNS.CREATE, true],
      [PERMISSIONS.VITAL_SIGNS.READ, true],
      [PERMISSIONS.VITAL_SIGNS.UPDATE, true],
      [PERMISSIONS.VITAL_SIGNS.DELETE, true],
      // Prescriptions
      [PERMISSIONS.PRESCRIPTIONS.CREATE, true],
      [PERMISSIONS.PRESCRIPTIONS.READ, true],
      [PERMISSIONS.PRESCRIPTIONS.UPDATE, true],
      [PERMISSIONS.PRESCRIPTIONS.DELETE, true],
      // Billing & Invoices
      [PERMISSIONS.INVOICES.CREATE, true],
      [PERMISSIONS.INVOICES.READ, true],
      [PERMISSIONS.INVOICES.UPDATE, true],
      [PERMISSIONS.INVOICES.DELETE, true],
      [PERMISSIONS.INVOICES.PROCESS, true],
      // Payments
      [PERMISSIONS.PAYMENTS.CREATE, true],
      [PERMISSIONS.PAYMENTS.READ, true],
      [PERMISSIONS.PAYMENTS.UPDATE, true],
      [PERMISSIONS.PAYMENTS.DELETE, true],
      [PERMISSIONS.PAYMENTS.PROCESS, true],
      // Reports
      [PERMISSIONS.REPORTS.FINANCIAL, true],
      [PERMISSIONS.REPORTS.CLINICAL, true],
      [PERMISSIONS.REPORTS.ADMINISTRATIVE, true],
      // System Settings
      [PERMISSIONS.SYSTEM.SETTINGS, true],
      [PERMISSIONS.SYSTEM.CONFIGURE, true],
      // Documents
      [PERMISSIONS.DOCUMENTS.CREATE, true],
      [PERMISSIONS.DOCUMENTS.READ, true],
      [PERMISSIONS.DOCUMENTS.UPDATE, true],
      [PERMISSIONS.DOCUMENTS.DELETE, true],
      [PERMISSIONS.DOCUMENTS.UPLOAD, true],
      // Lab Orders
      [PERMISSIONS.LAB_ORDERS.CREATE, true],
      [PERMISSIONS.LAB_ORDERS.READ, true],
      [PERMISSIONS.LAB_ORDERS.UPDATE, true],
      [PERMISSIONS.LAB_ORDERS.DELETE, true],
      // Lab Results
      [PERMISSIONS.LAB_RESULTS.CREATE, true],
      [PERMISSIONS.LAB_RESULTS.READ, true],
      [PERMISSIONS.LAB_RESULTS.UPDATE, true],
      [PERMISSIONS.LAB_RESULTS.DELETE, true],
      // Referrals
      [PERMISSIONS.REFERRALS.CREATE, true],
      [PERMISSIONS.REFERRALS.READ, true],
      [PERMISSIONS.REFERRALS.UPDATE, true],
      [PERMISSIONS.REFERRALS.DELETE, true],
      // Authorizations
      [PERMISSIONS.AUTHORIZATIONS.CREATE, true],
      [PERMISSIONS.AUTHORIZATIONS.READ, true],
      [PERMISSIONS.AUTHORIZATIONS.UPDATE, true],
      [PERMISSIONS.AUTHORIZATIONS.DELETE, true],
      // Providers
      [PERMISSIONS.PROVIDERS.CREATE, true],
      [PERMISSIONS.PROVIDERS.READ, true],
      [PERMISSIONS.PROVIDERS.UPDATE, true],
      [PERMISSIONS.PROVIDERS.DELETE, true],
      // Services
      [PERMISSIONS.SERVICES.CREATE, true],
      [PERMISSIONS.SERVICES.READ, true],
      [PERMISSIONS.SERVICES.UPDATE, true],
      [PERMISSIONS.SERVICES.DELETE, true],
      // Insurance
      [PERMISSIONS.INSURANCE.CREATE, true],
      [PERMISSIONS.INSURANCE.READ, true],
      [PERMISSIONS.INSURANCE.UPDATE, true],
      [PERMISSIONS.INSURANCE.DELETE, true],
    ]),
    isSystemRole: true,
    isActive: true,
  },
  {
    name: 'Doctor',
    description: 'Medical doctor with patient care and clinical access',
    permissions: new Map([
      // Patient Management - View All Patients, Edit Patient Info
      [PERMISSIONS.PATIENTS.READ, true],
      [PERMISSIONS.PATIENTS.UPDATE, true],
      [PERMISSIONS.PATIENTS.VIEW_ALL, true],
      // Appointment Management - Schedule Appointments
      [PERMISSIONS.APPOINTMENTS.CREATE, true],
      [PERMISSIONS.APPOINTMENTS.READ, true],
      [PERMISSIONS.APPOINTMENTS.UPDATE, true],
      [PERMISSIONS.APPOINTMENTS.SCHEDULE, true],
      [PERMISSIONS.APPOINTMENTS.CANCEL, true],
      // Clinical Notes - Write Clinical Notes
      [PERMISSIONS.CLINICAL_NOTES.CREATE, true],
      [PERMISSIONS.CLINICAL_NOTES.READ, true],
      [PERMISSIONS.CLINICAL_NOTES.UPDATE, true],
      [PERMISSIONS.CLINICAL_NOTES.SIGN, true],
      // Vital Signs
      [PERMISSIONS.VITAL_SIGNS.CREATE, true],
      [PERMISSIONS.VITAL_SIGNS.READ, true],
      [PERMISSIONS.VITAL_SIGNS.UPDATE, true],
      [PERMISSIONS.VITAL_SIGNS.DELETE, true],
      // Prescriptions
      [PERMISSIONS.PRESCRIPTIONS.CREATE, true],
      [PERMISSIONS.PRESCRIPTIONS.READ, true],
      [PERMISSIONS.PRESCRIPTIONS.UPDATE, true],
      // Billing - Process Billing (Partial)
      [PERMISSIONS.INVOICES.READ, true],
      [PERMISSIONS.INVOICES.UPDATE, true],
      [PERMISSIONS.PAYMENTS.READ, true],
      // Reports - View Financial Reports
      [PERMISSIONS.REPORTS.FINANCIAL, true],
      [PERMISSIONS.REPORTS.CLINICAL, true],
      // Documents
      [PERMISSIONS.DOCUMENTS.READ, true],
      [PERMISSIONS.DOCUMENTS.CREATE, true],
      // Referrals
      [PERMISSIONS.REFERRALS.CREATE, true],
      [PERMISSIONS.REFERRALS.READ, true],
      [PERMISSIONS.REFERRALS.UPDATE, true],
      // Authorizations
      [PERMISSIONS.AUTHORIZATIONS.CREATE, true],
      [PERMISSIONS.AUTHORIZATIONS.READ, true],
      [PERMISSIONS.AUTHORIZATIONS.UPDATE, true],
      // Lab Orders
      [PERMISSIONS.LAB_ORDERS.CREATE, true],
      [PERMISSIONS.LAB_ORDERS.READ, true],
      // Lab Results
      [PERMISSIONS.LAB_RESULTS.READ, true],
    ]),
    isSystemRole: true,
    isActive: true,
  },
  {
    name: 'Receptionist',
    description: 'Front desk staff with scheduling and patient management access',
    permissions: new Map([
      // Patient Management - View All Patients, Edit Patient Info
      [PERMISSIONS.PATIENTS.CREATE, true],
      [PERMISSIONS.PATIENTS.READ, true],
      [PERMISSIONS.PATIENTS.UPDATE, true],
      [PERMISSIONS.PATIENTS.VIEW_ALL, true],
      // Appointment Management - Schedule Appointments
      [PERMISSIONS.APPOINTMENTS.CREATE, true],
      [PERMISSIONS.APPOINTMENTS.READ, true],
      [PERMISSIONS.APPOINTMENTS.UPDATE, true],
      [PERMISSIONS.APPOINTMENTS.SCHEDULE, true],
      [PERMISSIONS.APPOINTMENTS.CANCEL, true],
      // Documents
      [PERMISSIONS.DOCUMENTS.READ, true],
      [PERMISSIONS.DOCUMENTS.UPLOAD, true],
    ]),
    isSystemRole: true,
    isActive: true,
  },
  {
    name: 'Billing Staff',
    description: 'Billing department with financial and patient viewing access',
    permissions: new Map([
      // Patient Management - View All Patients (read-only)
      [PERMISSIONS.PATIENTS.READ, true],
      [PERMISSIONS.PATIENTS.VIEW_ALL, true],
      // Billing & Invoices - Process Billing
      [PERMISSIONS.INVOICES.CREATE, true],
      [PERMISSIONS.INVOICES.READ, true],
      [PERMISSIONS.INVOICES.UPDATE, true],
      [PERMISSIONS.INVOICES.PROCESS, true],
      // Payments - Process Payments
      [PERMISSIONS.PAYMENTS.CREATE, true],
      [PERMISSIONS.PAYMENTS.READ, true],
      [PERMISSIONS.PAYMENTS.UPDATE, true],
      [PERMISSIONS.PAYMENTS.PROCESS, true],
      // Reports - View Financial Reports
      [PERMISSIONS.REPORTS.FINANCIAL, true],
      // Insurance
      [PERMISSIONS.INSURANCE.READ, true],
      [PERMISSIONS.INSURANCE.UPDATE, true],
      // Authorizations
      [PERMISSIONS.AUTHORIZATIONS.READ, true],
      [PERMISSIONS.AUTHORIZATIONS.UPDATE, true],
    ]),
    isSystemRole: true,
    isActive: true,
  },
  {
    name: 'Patient',
    description: 'Patient with limited self-service access to own profile and appointments',
    permissions: new Map([
      // Profile - Self-service
      [PERMISSIONS.PROFILE.READ, true],
      [PERMISSIONS.PROFILE.UPDATE, true],
      // Appointments - Schedule Appointments (self only)
      [PERMISSIONS.APPOINTMENTS.READ, true],
      [PERMISSIONS.APPOINTMENTS.CREATE, true],
      // Documents - Read own documents
      [PERMISSIONS.DOCUMENTS.READ, true],
      // Prescriptions - Read own prescriptions
      [PERMISSIONS.PRESCRIPTIONS.READ, true],
      // Lab Results - Read own lab results
      [PERMISSIONS.LAB_RESULTS.READ, true],
      // Invoices - Read own invoices
      [PERMISSIONS.INVOICES.READ, true],
      // Payments - Read own payments
      [PERMISSIONS.PAYMENTS.READ, true],
    ]),
    isSystemRole: true,
    isActive: true,
  },
  {
    name: 'Lab Tech',
    description: 'Laboratory technician with lab orders and results access',
    permissions: new Map([
      // Lab Orders
      [PERMISSIONS.LAB_ORDERS.READ, true],
      [PERMISSIONS.LAB_ORDERS.UPDATE, true],
      // Lab Results - Create, Read, Update
      [PERMISSIONS.LAB_RESULTS.CREATE, true],
      [PERMISSIONS.LAB_RESULTS.READ, true],
      [PERMISSIONS.LAB_RESULTS.UPDATE, true],
      // Patients - Read only for lab context
      [PERMISSIONS.PATIENTS.READ, true],
    ]),
    isSystemRole: true,
    isActive: true,
  },
  {
    name: 'Nurse',
    description: 'Nursing staff with patient care and vital signs access',
    permissions: new Map([
      // Patient Management
      [PERMISSIONS.PATIENTS.READ, true],
      [PERMISSIONS.PATIENTS.UPDATE, true],
      [PERMISSIONS.PATIENTS.VIEW_ALL, true],
      // Appointment Management
      [PERMISSIONS.APPOINTMENTS.READ, true],
      [PERMISSIONS.APPOINTMENTS.UPDATE, true],
      // Clinical Notes - Read and assist
      [PERMISSIONS.CLINICAL_NOTES.READ, true],
      // Vital Signs - Full access for nursing
      [PERMISSIONS.VITAL_SIGNS.CREATE, true],
      [PERMISSIONS.VITAL_SIGNS.READ, true],
      [PERMISSIONS.VITAL_SIGNS.UPDATE, true],
      [PERMISSIONS.VITAL_SIGNS.DELETE, true],
      // Documents
      [PERMISSIONS.DOCUMENTS.READ, true],
      [PERMISSIONS.DOCUMENTS.CREATE, true],
      [PERMISSIONS.DOCUMENTS.UPLOAD, true],
      // Lab Orders - Read
      [PERMISSIONS.LAB_ORDERS.READ, true],
      // Lab Results - Read
      [PERMISSIONS.LAB_RESULTS.READ, true],
      // Prescriptions - Read only
      [PERMISSIONS.PRESCRIPTIONS.READ, true],
    ]),
    isSystemRole: true,
    isActive: true,
  },
];

const seedRoles = async () => {
  try {
    await connectDB();

    for (const roleData of defaultRoles) {
      const existingRole = await RoleModel.findOne({ name: roleData.name });

      if (existingRole) {
        console.log(`Role "${roleData.name}" already exists, skipping...`);
        continue;
      }

      // Convert Map to plain object for Mongoose (Mongoose Maps don't support keys with dots)
      const roleToCreate = {
        ...roleData,
        permissions: Object.fromEntries(roleData.permissions),
      };

      await RoleModel.create(roleToCreate);
      console.log(`✓ Created role: ${roleData.name}`);
    }

    console.log('\n✅ Roles seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding roles:', error);
    process.exit(1);
  }
};

seedRoles();

