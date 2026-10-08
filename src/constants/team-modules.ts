/**
 * Team module access — the screens a group_admin / branch_admin may switch
 * on, off or to read-only for an individual member of their team, on top of
 * what that member's role grants.
 *
 * The rows and the per-role defaults mirror the client's screen access matrix
 * (Admin settings, Audit trail and Patient portal are left out on purpose:
 * they are admin-only or patient-only and never handed to staff one by one).
 *
 * An override is enforced two ways, because the routes behind these screens
 * are gated two ways:
 *  - permission-gated routes: AccessContextService adds/removes the module's
 *    read and write keys (applyModuleOverrides);
 *  - role-gated routes (e.g. /patients, /note-templates, /waitlist):
 *    `authenticate` refuses the module's URL prefixes outright for 'none',
 *    and refuses writes for 'view' (moduleGateFor).
 * A grant ('view'/'full' beyond the role) is honoured by role-gated routes too:
 * requireRoles / requireGroups let the request through (moduleGrantFor),
 * except DELETE, which stays with the roles built for it.
 */

export type ModuleLevel = 'none' | 'view' | 'full';

export const MODULE_LEVELS: ModuleLevel[] = ['none', 'view', 'full'];

const LEVEL_RANK: Record<ModuleLevel, number> = { none: 0, view: 1, full: 2 };

export interface TeamModule {
  key: string;
  label: string;
  description: string;
  /** Levels an admin can pick. Reports has no read-only variant. */
  levels: ModuleLevel[];
  /** API mount paths (as in routes/index.ts) that belong to this screen. */
  routePrefixes: string[];
  readPermissions: string[];
  writePermissions: string[];
}

export const TEAM_MODULES: TeamModule[] = [
  {
    key: 'reports',
    label: 'Reports and KPI dashboard',
    description: 'Practice reports, dashboards and KPIs',
    levels: ['none', 'full'],
    routePrefixes: ['/reports', '/kpis'],
    readPermissions: ['reports.read', 'reports.access'],
    writePermissions: [],
  },
  {
    key: 'note_templates',
    label: 'Note templates',
    description: 'Clinical note templates',
    levels: ['none', 'view', 'full'],
    routePrefixes: ['/note-templates'],
    readPermissions: ['note-templates.read'],
    writePermissions: ['clinical_templates'],
  },
  {
    key: 'patients',
    label: 'Patients',
    description: 'Patient profiles, demographics and history',
    levels: ['none', 'view', 'full'],
    routePrefixes: ['/patients'],
    readPermissions: ['patients.read', 'patients.read_basic'],
    writePermissions: ['patients.create', 'patients.update'],
  },
  {
    key: 'appointments',
    label: 'Appointments and schedule',
    description: 'Schedule, bookings, waitlist and recurring appointments',
    levels: ['none', 'view', 'full'],
    routePrefixes: ['/appointments', '/recurring-appointments', '/waitlist', '/schedule-blocks'],
    readPermissions: ['appointments.read'],
    writePermissions: ['appointments.create', 'appointments.update', 'appointments.schedule', 'appointments.cancel'],
  },
  {
    key: 'clinical',
    label: 'Clinical: notes, treatment plans, perio',
    description: 'Clinical notes, treatment plans, exams, vitals and prescriptions',
    levels: ['none', 'view', 'full'],
    routePrefixes: ['/clinical-notes', '/treatment-plans', '/clinical-exams', '/progress-notes', '/vital-signs', '/rx'],
    readPermissions: ['clinical-notes.read', 'treatment-plans.read', 'vital-signs.read', 'prescriptions.read'],
    writePermissions: [
      'clinical-notes.create', 'clinical-notes.update', 'clinical-notes.sign',
      'treatment-plans.create', 'treatment-plans.update', 'treatment-plans.sign',
      'vital-signs.create', 'vital-signs.update',
      'prescriptions.create', 'prescriptions.update',
    ],
  },
  {
    key: 'finance',
    label: 'Finance: invoices, payments, claims, ERA',
    description: 'Invoices, payments, adjustments, deposits, claims and ERA',
    levels: ['none', 'view', 'full'],
    routePrefixes: ['/invoices', '/payments', '/claims', '/era', '/adjustments', '/deposits', '/payment-plans', '/finance-dashboard'],
    readPermissions: [
      'invoices.read', 'payments.read', 'claims.read', 'era.read',
      'adjustments.read', 'deposits.read', 'payment-plans.read',
    ],
    writePermissions: [
      'invoices.create', 'invoices.update', 'invoices.process',
      'payments.create', 'payments.update', 'payments.process',
      'claims.create', 'claims.update', 'claims.process',
      'era.create', 'era.update', 'era.process',
      'adjustments.create', 'adjustments.update',
      'deposits.create', 'deposits.update',
      'payment-plans.create', 'payment-plans.update',
    ],
  },
  {
    // Insurance companies, plans and services are lookups other screens
    // (coverage, treatment plans) load too, so only the screen's own routes
    // are URL-gated; the keys below still cover the permission-gated parts.
    key: 'insurance',
    label: 'Insurance, services, authorizations',
    description: 'Coverage, authorizations and plan coordination',
    levels: ['none', 'view', 'full'],
    routePrefixes: ['/authorizations', '/cob'],
    readPermissions: ['insurance.read', 'authorizations.read', 'insurance.coverage_order.read'],
    writePermissions: ['insurance.create', 'insurance.update', 'authorizations.create', 'authorizations.update'],
  },
  {
    key: 'documents',
    label: 'Documents and allergies',
    description: 'Patient documents, uploads and allergies',
    levels: ['none', 'view', 'full'],
    routePrefixes: ['/documents', '/allergies'],
    readPermissions: ['documents.read'],
    writePermissions: ['documents.create', 'documents.update', 'documents.upload'],
  },
];

export const TEAM_MODULE_KEYS = TEAM_MODULES.map((m) => m.key);

/**
 * Each role's default per module, worded as in the screen access matrix.
 * Keyed by new-model role key; legacy role names resolve through
 * LEGACY_ROLE_TO_MATRIX_KEY.
 */
export const ROLE_DEFAULT_LABELS: Record<string, Record<string, string>> = {
  group_admin: {
    reports: 'Full, all branches', note_templates: 'Full', patients: 'Full, all branches', appointments: 'Full',
    clinical: 'View', finance: 'Full', insurance: 'Full', documents: 'Full',
  },
  branch_admin: {
    reports: 'Full, own branch', note_templates: 'Full', patients: 'Full, own branch', appointments: 'Full',
    clinical: 'View', finance: 'Invoices; rest view', insurance: 'Full', documents: 'Full',
  },
  dentist: {
    reports: 'None', note_templates: 'Full', patients: 'View', appointments: 'View, update',
    clinical: 'Full, can sign', finance: 'None', insurance: 'View', documents: 'Full',
  },
  hygienist: {
    reports: 'None', note_templates: 'None', patients: 'View', appointments: 'View, update',
    clinical: 'Full, no plan sign', finance: 'None', insurance: 'View', documents: 'Full',
  },
  dental_assistant: {
    reports: 'None', note_templates: 'None', patients: 'View', appointments: 'View',
    clinical: 'Write notes', finance: 'Balance only', insurance: 'View', documents: 'Full',
  },
  front_desk: {
    reports: 'Full', note_templates: 'None', patients: 'Full', appointments: 'Full',
    clinical: 'None', finance: 'View', insurance: 'View', documents: 'Full',
  },
  billing: {
    reports: 'Full', note_templates: 'None', patients: 'Full', appointments: 'View',
    clinical: 'None', finance: 'Full', insurance: 'Full', documents: 'Full',
  },
  lab: {
    reports: 'None', note_templates: 'None', patients: 'None', appointments: 'View',
    clinical: 'None', finance: 'None', insurance: 'View', documents: 'View',
  },
};

export const LEGACY_ROLE_TO_MATRIX_KEY: Record<string, string> = {
  'Group Admin': 'group_admin',
  'Branch Admin': 'branch_admin',
  Provider: 'dentist',
  Doctor: 'dentist',
  Hygienist: 'hygienist',
  Assistant: 'dental_assistant',
  'Dental Assistant': 'dental_assistant',
  'Clinical Staff': 'dental_assistant',
  'Front Desk': 'front_desk',
  Receptionist: 'front_desk',
  Biller: 'billing',
  'Billing Staff': 'billing',
  Lab: 'lab',
  'Lab Technician': 'lab',
};

export const matrixKeyForRoles = (roleNames: string[]): string | null => {
  for (const name of roleNames) {
    if (ROLE_DEFAULT_LABELS[name]) return name;
  }
  for (const name of roleNames) {
    const key = LEGACY_ROLE_TO_MATRIX_KEY[name];
    if (key) return key;
  }
  return null;
};

/** 'Full, own branch' → full, 'None*' → none, anything partial → view. */
export const levelOfLabel = (label: string): ModuleLevel => {
  if (label.startsWith('Full')) return 'full';
  if (label.startsWith('None')) return 'none';
  return 'view';
};

export const isLevelWithin = (level: ModuleLevel, ceiling: ModuleLevel): boolean => LEVEL_RANK[level] <= LEVEL_RANK[ceiling];

export const isModuleLevel = (value: unknown): value is ModuleLevel =>
  typeof value === 'string' && (MODULE_LEVELS as string[]).includes(value);

/** What a raw permission set amounts to for one module (used for roles outside the matrix). */
export const levelFromPermissions = (permissions: Set<string>, module: TeamModule): ModuleLevel => {
  if (permissions.has('*')) return 'full';
  const hasRead = module.readPermissions.some((p) => permissions.has(p));
  const hasWrite = module.writePermissions.some((p) => permissions.has(p));
  if (hasWrite || (hasRead && module.writePermissions.length === 0)) return 'full';
  return hasRead ? 'view' : 'none';
};

/** Keep only known modules with a level that module offers. */
export const sanitizeModuleAccess = (raw: unknown): Record<string, ModuleLevel> => {
  const clean: Record<string, ModuleLevel> = {};
  if (!raw || typeof raw !== 'object') return clean;
  for (const module of TEAM_MODULES) {
    const level = (raw as Record<string, unknown>)[module.key];
    if (isModuleLevel(level) && module.levels.includes(level)) clean[module.key] = level;
  }
  return clean;
};

/** Mutates `permissions` so it reflects the member's per-module overrides. */
export const applyModuleOverrides = (permissions: Set<string>, moduleAccess: Record<string, ModuleLevel>): void => {
  for (const module of TEAM_MODULES) {
    const level = moduleAccess[module.key];
    if (!level) continue;
    if (level === 'none') {
      for (const p of [...module.readPermissions, ...module.writePermissions]) permissions.delete(p);
    } else if (level === 'view') {
      for (const p of module.writePermissions) permissions.delete(p);
      for (const p of module.readPermissions) permissions.add(p);
    } else {
      for (const p of [...module.readPermissions, ...module.writePermissions]) permissions.add(p);
    }
  }
};

const READ_ONLY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * True when the member's override grants this request even though their role
 * would not: 'full' covers reads and writes, 'view' covers reads. DELETE is
 * never granted this way — removing records stays with the roles built for it.
 * Used by requireRoles / requireGroups, so role-gated routes honour a grant.
 */
export const moduleGrantFor = (path: string, method: string, moduleAccess: Record<string, ModuleLevel>): boolean => {
  const verb = method.toUpperCase();
  if (verb === 'DELETE') return false;
  for (const module of TEAM_MODULES) {
    const level = moduleAccess[module.key];
    if (level !== 'full' && level !== 'view') continue;
    if (!module.routePrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) continue;
    return level === 'full' || READ_ONLY_METHODS.has(verb);
  }
  return false;
};

/**
 * The module a request falls under, and whether the member's override refuses
 * it. `path` is the API path without the /api prefix, e.g. '/patients/12'.
 */
export const moduleGateFor = (
  path: string,
  method: string,
  moduleAccess: Record<string, ModuleLevel>
): { module: TeamModule; reason: 'none' | 'view' } | null => {
  for (const module of TEAM_MODULES) {
    const level = moduleAccess[module.key];
    if (!level || level === 'full') continue;
    const matches = module.routePrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
    if (!matches) continue;
    if (level === 'none') return { module, reason: 'none' };
    if (!READ_ONLY_METHODS.has(method.toUpperCase())) return { module, reason: 'view' };
  }
  return null;
};

// ─── Features: the narrower switches inside each module ─────────────────────
//
// A module's level (none/view/full) sets the baseline; a feature override is
// more specific and wins over it. Each feature names the permission keys it
// stands for and, where the routes behind it check role names instead of
// permissions, the routes it opens or closes (method + path prefix).

export type FeatureKind = 'read' | 'write';

export interface FeatureRoute {
  methods: string[];
  /** Matches the prefix and anything under it, unless `exact`. */
  prefixes: string[];
  exact?: boolean;
}

export interface TeamFeature {
  key: string;
  module: string;
  label: string;
  kind: FeatureKind;
  permissions: string[];
  routes: FeatureRoute[];
}

const READS = ['GET', 'HEAD'];
const WRITES = ['POST', 'PUT', 'PATCH'];
const CREATE = ['POST'];
const EDIT = ['PUT', 'PATCH'];

const feature = (module: string, key: string, label: string, kind: FeatureKind, permissions: string[], routes: FeatureRoute[] = []): TeamFeature =>
  ({ key: `${module}.${key}`, module, label, kind, permissions, routes });

export const TEAM_FEATURES: TeamFeature[] = [
  feature('reports', 'view', 'View reports and KPI dashboard', 'read', ['reports.read', 'reports.access'], [{ methods: READS, prefixes: ['/reports', '/kpis'] }]),
  feature('reports', 'financial', 'Financial reports', 'read', ['reports.financial']),

  feature('note_templates', 'view', 'Use note templates', 'read', ['note-templates.read'], [{ methods: READS, prefixes: ['/note-templates'] }]),
  feature('note_templates', 'manage', 'Create and edit note templates', 'write', ['clinical_templates'], [{ methods: WRITES, prefixes: ['/note-templates'] }]),

  feature('patients', 'view', 'View patients', 'read', ['patients.read', 'patients.read_basic'], [{ methods: READS, prefixes: ['/patients'] }]),
  feature('patients', 'create', 'Add new patients', 'write', ['patients.create'], [{ methods: CREATE, prefixes: ['/patients'], exact: true }]),
  feature('patients', 'edit', 'Edit patient details', 'write', ['patients.update'], [{ methods: EDIT, prefixes: ['/patients'] }]),
  feature('patients', 'ssn', 'See full SSN', 'read', ['patient.ssn.view']),

  feature('appointments', 'view', 'View schedule', 'read', ['appointments.read'], [{ methods: READS, prefixes: ['/appointments', '/recurring-appointments', '/waitlist', '/schedule-blocks'] }]),
  feature('appointments', 'book', 'Book appointments', 'write', ['appointments.create', 'appointments.schedule'], [{ methods: CREATE, prefixes: ['/appointments', '/recurring-appointments', '/waitlist'] }]),
  feature('appointments', 'edit', 'Reschedule and edit appointments', 'write', ['appointments.update'], [{ methods: EDIT, prefixes: ['/appointments', '/recurring-appointments', '/waitlist', '/schedule-blocks'] }]),
  feature('appointments', 'cancel', 'Cancel appointments', 'write', ['appointments.cancel']),

  feature('clinical', 'notes_view', 'View clinical notes', 'read', ['clinical-notes.read'], [{ methods: READS, prefixes: ['/clinical-notes', '/progress-notes'] }]),
  feature('clinical', 'notes_write', 'Write clinical notes', 'write', ['clinical-notes.create', 'clinical-notes.update'], [{ methods: WRITES, prefixes: ['/clinical-notes', '/progress-notes'] }]),
  feature('clinical', 'notes_sign', 'Sign clinical notes', 'write', ['clinical-notes.sign']),
  feature('clinical', 'plans_view', 'View treatment plans', 'read', ['treatment-plans.read'], [{ methods: READS, prefixes: ['/treatment-plans'] }]),
  feature('clinical', 'plans_write', 'Create and edit treatment plans', 'write', ['treatment-plans.create', 'treatment-plans.update'], [{ methods: WRITES, prefixes: ['/treatment-plans'] }]),
  feature('clinical', 'plans_sign', 'Sign treatment plans', 'write', ['treatment-plans.sign']),
  feature('clinical', 'vitals', 'Record vital signs', 'write', ['vital-signs.read', 'vital-signs.create', 'vital-signs.update'], [{ methods: [...READS, ...WRITES], prefixes: ['/vital-signs'] }]),
  feature('clinical', 'rx', 'Write prescriptions', 'write', ['prescriptions.read', 'prescriptions.create', 'prescriptions.update'], [{ methods: [...READS, ...WRITES], prefixes: ['/rx'] }]),

  feature('finance', 'invoices_view', 'View invoices and balances', 'read', ['invoices.read'], [{ methods: READS, prefixes: ['/invoices'] }]),
  feature('finance', 'invoices_write', 'Create and edit invoices', 'write', ['invoices.create', 'invoices.update', 'invoices.process'], [{ methods: WRITES, prefixes: ['/invoices'] }]),
  feature('finance', 'payments_view', 'View payments', 'read', ['payments.read'], [{ methods: READS, prefixes: ['/payments'] }]),
  feature('finance', 'payments_write', 'Take and edit payments', 'write', ['payments.create', 'payments.update', 'payments.process'], [{ methods: WRITES, prefixes: ['/payments'] }]),
  feature('finance', 'adjustments', 'Adjustments', 'write', ['adjustments.read', 'adjustments.create', 'adjustments.update'], [{ methods: [...READS, ...WRITES], prefixes: ['/adjustments'] }]),
  feature('finance', 'claims_view', 'View claims and ERA', 'read', ['claims.read', 'era.read'], [{ methods: READS, prefixes: ['/claims', '/era'] }]),
  feature('finance', 'claims_write', 'Create, send and post claims and ERA', 'write', ['claims.create', 'claims.update', 'claims.process', 'era.create', 'era.update', 'era.process'], [{ methods: WRITES, prefixes: ['/claims', '/era'] }]),
  feature('finance', 'deposits', 'Deposits and payment plans', 'write', ['deposits.read', 'deposits.create', 'deposits.update', 'payment-plans.read', 'payment-plans.create', 'payment-plans.update'], [{ methods: [...READS, ...WRITES], prefixes: ['/deposits', '/payment-plans'] }]),

  feature('insurance', 'view', 'View coverage', 'read', ['insurance.read', 'insurance.coverage_order.read']),
  feature('insurance', 'edit', 'Edit coverage', 'write', ['insurance.create', 'insurance.update']),
  feature('insurance', 'auth_view', 'View authorizations', 'read', ['authorizations.read'], [{ methods: READS, prefixes: ['/authorizations'] }]),
  feature('insurance', 'auth_write', 'Create and edit authorizations', 'write', ['authorizations.create', 'authorizations.update'], [{ methods: WRITES, prefixes: ['/authorizations'] }]),
  feature('insurance', 'cob_override', 'Change payer order (COB)', 'write', ['insurance.coverage_order.override', 'insurance.coverage_order.resolve_flag']),

  feature('documents', 'view', 'View documents', 'read', ['documents.read'], [{ methods: READS, prefixes: ['/documents'] }]),
  feature('documents', 'upload', 'Upload documents', 'write', ['documents.create', 'documents.upload'], [{ methods: CREATE, prefixes: ['/documents'] }]),
  feature('documents', 'edit', 'Edit documents', 'write', ['documents.update'], [{ methods: EDIT, prefixes: ['/documents'] }]),
];

export const featuresOf = (moduleKey: string): TeamFeature[] => TEAM_FEATURES.filter((f) => f.module === moduleKey);

/** Keep only known features with a boolean value. */
export const sanitizeFeatureAccess = (raw: unknown): Record<string, boolean> => {
  const clean: Record<string, boolean> = {};
  if (!raw || typeof raw !== 'object') return clean;
  for (const f of TEAM_FEATURES) {
    const value = (raw as Record<string, unknown>)[f.key];
    if (typeof value === 'boolean') clean[f.key] = value;
  }
  return clean;
};

/** Mutates `permissions`: applied after module overrides, so a feature switch wins. */
export const applyFeatureOverrides = (permissions: Set<string>, featureAccess: Record<string, boolean>): void => {
  for (const f of TEAM_FEATURES) {
    const on = featureAccess[f.key];
    if (on === undefined) continue;
    for (const p of f.permissions) {
      if (on) permissions.add(p);
      else permissions.delete(p);
    }
  }
};

const routeMatches = (route: FeatureRoute, path: string, method: string): boolean =>
  route.methods.includes(method.toUpperCase()) &&
  route.prefixes.some((prefix) => path === prefix || (!route.exact && path.startsWith(`${prefix}/`)));

/**
 * What the member's feature switches say about this request: 'deny' when a
 * switched-off feature covers it, 'allow' when a switched-on one does, null
 * when no switch applies (fall back to the module level / role). Off wins.
 */
export const featureDecisionFor = (path: string, method: string, featureAccess: Record<string, boolean>): 'allow' | 'deny' | null => {
  let decision: 'allow' | 'deny' | null = null;
  for (const f of TEAM_FEATURES) {
    const on = featureAccess[f.key];
    if (on === undefined || !f.routes.some((r) => routeMatches(r, path, method))) continue;
    if (!on) return 'deny';
    decision = 'allow';
  }
  return decision;
};

/**
 * For modules the member has any override on: 'off' when nothing readable in
 * the module survives, otherwise 'granted'. The frontend hides 'off' modules
 * and opens 'granted' ones regardless of role.
 */
export const moduleStatesFor = (
  permissions: Set<string>,
  moduleAccess: Record<string, ModuleLevel>,
  featureAccess: Record<string, boolean>
): Record<string, 'off' | 'granted'> => {
  const states: Record<string, 'off' | 'granted'> = {};
  for (const module of TEAM_MODULES) {
    const features = featuresOf(module.key);
    const touched = moduleAccess[module.key] !== undefined || features.some((f) => featureAccess[f.key] !== undefined);
    if (!touched) continue;
    const readable = features.some((f) => f.permissions.some((p) => permissions.has(p)));
    states[module.key] = readable ? 'granted' : 'off';
  }
  return states;
};
