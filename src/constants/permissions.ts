/**
 * Permission Constants
 * Defines all available permissions in the system
 * Format: resource.action (e.g., 'patients.read', 'appointments.create')
 */

export const PERMISSIONS = {
  // User Management
  //user management permissions
  USERS: {
    CREATE: "users.create",
    READ: "users.read",
    UPDATE: "users.update",
    DELETE: "users.delete",
    MANAGE: "users.manage",
  },

  // Role Management
  ROLES: {
    CREATE: "roles.create",
    READ: "roles.read",
    UPDATE: "roles.update",
    DELETE: "roles.delete",
    MANAGE: "roles.manage",
  },

  // Patient Management
  PATIENTS: {
    CREATE: "patients.create",
    READ: "patients.read",
    UPDATE: "patients.update",
    DELETE: "patients.delete",
    VIEW_ALL: "patients.view_all",
  },

  // Appointment Management
  APPOINTMENTS: {
    CREATE: "appointments.create",
    READ: "appointments.read",
    UPDATE: "appointments.update",
    DELETE: "appointments.delete",
    SCHEDULE: "appointments.schedule",
    CANCEL: "appointments.cancel",
  },

  // Clinical Notes
  CLINICAL_NOTES: {
    CREATE: "clinical-notes.create",
    READ: "clinical-notes.read",
    UPDATE: "clinical-notes.update",
    DELETE: "clinical-notes.delete",
    SIGN: "clinical-notes.sign",
  },

  // Vital Signs
  VITAL_SIGNS: {
    CREATE: "vital-signs.create",
    READ: "vital-signs.read",
    UPDATE: "vital-signs.update",
    DELETE: "vital-signs.delete",
  },

  // Note Templates
  NOTE_TEMPLATES: {
    CREATE: "clinical_templates",
    READ: "note-templates.read",
    UPDATE: "clinical_templates",
    DELETE: "clinical_templates",
  },

  // Prescriptions
  PRESCRIPTIONS: {
    CREATE: "prescriptions.create",
    READ: "prescriptions.read",
    UPDATE: "prescriptions.update",
    DELETE: "prescriptions.delete",
  },

  // Billing & Invoices
  INVOICES: {
    CREATE: "invoices.create",
    READ: "invoices.read",
    UPDATE: "invoices.update",
    DELETE: "invoices.delete",
    PROCESS: "invoices.process",
  },

  // Payments
  PAYMENTS: {
    CREATE: "payments.create",
    READ: "payments.read",
    UPDATE: "payments.update",
    DELETE: "payments.delete",
    PROCESS: "payments.process",
  },

  // Lab Orders
  LAB_ORDERS: {
    CREATE: "lab-orders.create",
    READ: "lab-orders.read",
    UPDATE: "lab-orders.update",
    DELETE: "lab-orders.delete",
  },

  // Lab Results
  LAB_RESULTS: {
    CREATE: "lab-results.create",
    READ: "lab-results.read",
    UPDATE: "lab-results.update",
    DELETE: "lab-results.delete",
  },

  // Documents
  DOCUMENTS: {
    CREATE: "documents.create",
    READ: "documents.read",
    UPDATE: "documents.update",
    DELETE: "documents.delete",
    UPLOAD: "documents.upload",
  },

  // Profile (for patients)
  PROFILE: {
    READ: "profile.read",
    UPDATE: "profile.update",
  },

  // Reports
  REPORTS: {
    FINANCIAL: "reports.financial",
    CLINICAL: "reports.clinical",
    ADMINISTRATIVE: "reports.administrative",
  },

  // System Settings
  SYSTEM: {
    SETTINGS: "system.settings",
    CONFIGURE: "system.configure",
  },

  // Referrals
  REFERRALS: {
    CREATE: "referrals.create",
    READ: "referrals.read",
    UPDATE: "referrals.update",
    DELETE: "referrals.delete",
  },

  // Authorizations
  AUTHORIZATIONS: {
    CREATE: "authorizations.create",
    READ: "authorizations.read",
    UPDATE: "authorizations.update",
    DELETE: "authorizations.delete",
  },

  // Claims
  CLAIMS: {
    CREATE: "claims.create",
    READ: "claims.read",
    UPDATE: "claims.update",
    DELETE: "claims.delete",
    PROCESS: "claims.process",
  },

  // ERA / EOB
  ERA: {
    CREATE: "era.create",
    READ: "era.read",
    UPDATE: "era.update",
    DELETE: "era.delete",
    PROCESS: "era.process",
  },

  // Providers
  PROVIDERS: {
    CREATE: "providers.create",
    READ: "providers.read",
    UPDATE: "providers.update",
    DELETE: "providers.delete",
  },

  // Appointment Types
  APPOINTMENT_TYPES: {
    CREATE: "appointment-types.create",
    READ: "appointment-types.read",
    UPDATE: "appointment-types.update",
    DELETE: "appointment-types.delete",
  },

  // Recurring Appointments
  RECURRING_APPOINTMENTS: {
    CREATE: "recurring-appointments.create",
    READ: "recurring-appointments.read",
    UPDATE: "recurring-appointments.update",
    DELETE: "recurring-appointments.delete",
    GENERATE: "recurring-appointments.generate",
  },

  // Waitlist
  WAITLIST: {
    CREATE: "waitlist.create",
    READ: "waitlist.read",
    UPDATE: "waitlist.update",
    DELETE: "waitlist.delete",
    MANAGE: "waitlist.manage",
  },

  // Services
  SERVICES: {
    CREATE: "services.create",
    READ: "services.read",
    UPDATE: "services.update",
    DELETE: "services.delete",
  },

  // Insurance
  INSURANCE: {
    CREATE: "insurance.create",
    READ: "insurance.read",
    UPDATE: "insurance.update",
    DELETE: "insurance.delete",
  },
} as const;

/**
 * Get all permission values as a flat array
 */
export const getAllPermissions = (): string[] => {
  return Object.values(PERMISSIONS).flatMap((category) =>
    Object.values(category),
  );
};

/**
 * Permission categories for organization
 */
export const PERMISSION_CATEGORIES = {
  USER_MANAGEMENT: "User Management",
  ROLE_MANAGEMENT: "Role Management",
  PATIENT_MANAGEMENT: "Patient Management",
  APPOINTMENT_MANAGEMENT: "Appointment Management",
  CLINICAL: "Clinical Operations",
  BILLING: "Billing & Financial",
  LABORATORY: "Laboratory",
  DOCUMENTS: "Documents",
  REPORTS: "Reports",
  SYSTEM: "System Administration",
} as const;
