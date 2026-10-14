import { describe, it, expect } from 'vitest';
import {
  TEAM_MODULES,
  ROLE_DEFAULT_LABELS,
  applyModuleOverrides,
  moduleGateFor,
  moduleGrantFor,
  sanitizeModuleAccess,
  levelOfLabel,
  matrixKeyForRoles,
  levelFromPermissions,
  TEAM_FEATURES,
  applyFeatureOverrides,
  featureDecisionFor,
  moduleStatesFor,
  sanitizeFeatureAccess,
} from '../src/constants/team-modules';

const moduleByKey = (key: string) => TEAM_MODULES.find((m) => m.key === key)!;

describe('applyModuleOverrides', () => {
  it("'none' removes the module's read and write keys and leaves other modules alone", () => {
    const perms = new Set(['invoices.read', 'payments.create', 'patients.read']);
    applyModuleOverrides(perms, { finance: 'none' });
    expect([...perms]).toEqual(['patients.read']);
  });

  it("'view' keeps reads, adds the module's reads and drops writes", () => {
    const perms = new Set(['appointments.read', 'appointments.update']);
    applyModuleOverrides(perms, { appointments: 'view' });
    expect(perms.has('appointments.read')).toBe(true);
    expect(perms.has('appointments.update')).toBe(false);
  });

  it("'full' adds every read and write key of the module", () => {
    const perms = new Set<string>();
    applyModuleOverrides(perms, { documents: 'full' });
    for (const p of [...moduleByKey('documents').readPermissions, ...moduleByKey('documents').writePermissions]) {
      expect(perms.has(p)).toBe(true);
    }
  });
});

describe('moduleGateFor', () => {
  it("refuses every method on a module set to 'none', including nested paths", () => {
    expect(moduleGateFor('/patients/12/insurance', 'GET', { patients: 'none' })?.reason).toBe('none');
  });

  it("allows reads but refuses writes on a module set to 'view'", () => {
    expect(moduleGateFor('/waitlist', 'GET', { appointments: 'view' })).toBeNull();
    expect(moduleGateFor('/waitlist/3', 'PATCH', { appointments: 'view' })?.reason).toBe('view');
  });

  it("does not match a different route that merely shares a prefix", () => {
    expect(moduleGateFor('/patients-export', 'GET', { patients: 'none' })).toBeNull();
  });

  it('ignores full overrides and untouched modules', () => {
    expect(moduleGateFor('/invoices', 'POST', { finance: 'full' })).toBeNull();
    expect(moduleGateFor('/invoices', 'POST', {})).toBeNull();
  });
});

describe('moduleGrantFor', () => {
  it("lets 'full' through role-gated routes for reads and writes, but never DELETE", () => {
    expect(moduleGrantFor('/clinical-notes', 'GET', { clinical: 'full' })).toBe(true);
    expect(moduleGrantFor('/treatment-plans/4', 'PUT', { clinical: 'full' })).toBe(true);
    expect(moduleGrantFor('/treatment-plans/4', 'DELETE', { clinical: 'full' })).toBe(false);
  });

  it("lets 'view' through for reads only", () => {
    expect(moduleGrantFor('/note-templates', 'GET', { note_templates: 'view' })).toBe(true);
    expect(moduleGrantFor('/note-templates', 'POST', { note_templates: 'view' })).toBe(false);
  });

  it('grants nothing without an override or outside the module', () => {
    expect(moduleGrantFor('/clinical-notes', 'GET', {})).toBe(false);
    expect(moduleGrantFor('/users', 'GET', { clinical: 'full' })).toBe(false);
    expect(moduleGrantFor('/clinical-notes', 'GET', { clinical: 'none' })).toBe(false);
  });
});

describe('sanitizeModuleAccess', () => {
  it('drops unknown modules, bad levels and levels the module does not offer', () => {
    expect(sanitizeModuleAccess({ finance: 'none', nope: 'full', patients: 'admin', reports: 'view' })).toEqual({ finance: 'none' });
    expect(sanitizeModuleAccess(null)).toEqual({});
  });
});

describe('matrix', () => {
  it('has a default for every module for every role', () => {
    for (const labels of Object.values(ROLE_DEFAULT_LABELS)) {
      for (const module of TEAM_MODULES) expect(labels[module.key]).toBeTruthy();
    }
  });

  it('reads partial labels as view and starred None as none', () => {
    expect(levelOfLabel('Full, own branch')).toBe('full');
    expect(levelOfLabel('Invoices; rest view')).toBe('view');
    expect(levelOfLabel('None*')).toBe('none');
  });

  it('maps legacy role names onto the matrix', () => {
    expect(matrixKeyForRoles(['Provider'])).toBe('dentist');
    expect(matrixKeyForRoles(['front_desk'])).toBe('front_desk');
    expect(matrixKeyForRoles(['Patient'])).toBeNull();
  });

  it('derives a level from raw permissions for roles outside the matrix', () => {
    expect(levelFromPermissions(new Set(['reports.read']), moduleByKey('reports'))).toBe('full');
    expect(levelFromPermissions(new Set(['claims.read']), moduleByKey('finance'))).toBe('view');
    expect(levelFromPermissions(new Set(['*']), moduleByKey('clinical'))).toBe('full');
  });
});

describe('features', () => {
  it('every feature belongs to a known module and has a unique key', () => {
    const moduleKeys = new Set(TEAM_MODULES.map((m) => m.key));
    for (const f of TEAM_FEATURES) expect(moduleKeys.has(f.module)).toBe(true);
    expect(new Set(TEAM_FEATURES.map((f) => f.key)).size).toBe(TEAM_FEATURES.length);
  });

  it('a feature switch wins over the module level', () => {
    const perms = new Set(['patients.read', 'patients.create', 'patients.update']);
    applyModuleOverrides(perms, { patients: 'full' });
    applyFeatureOverrides(perms, { 'patients.create': false });
    expect(perms.has('patients.create')).toBe(false);
    expect(perms.has('patients.update')).toBe(true);

    const none = new Set<string>();
    applyModuleOverrides(none, { finance: 'none' });
    applyFeatureOverrides(none, { 'finance.invoices_view': true });
    expect([...none]).toEqual(['invoices.read']);
  });

  it('decides role-gated routes by method and path', () => {
    expect(featureDecisionFor('/patients', 'POST', { 'patients.create': false })).toBe('deny');
    // exact: creating a patient's insurance is not "add new patient"
    expect(featureDecisionFor('/patients/5/insurance', 'POST', { 'patients.create': false })).toBeNull();
    expect(featureDecisionFor('/patients/5', 'PUT', { 'patients.edit': true })).toBe('allow');
    expect(featureDecisionFor('/patients/5', 'GET', { 'patients.edit': true })).toBeNull();
  });

  it('switched-off wins when two features cover the same request', () => {
    expect(featureDecisionFor('/vital-signs', 'GET', { 'clinical.vitals': false, 'clinical.notes_view': true })).toBe('deny');
  });

  it("marks touched modules 'off' or 'granted' from what survives", () => {
    expect(moduleStatesFor(new Set(), { patients: 'none' }, {})).toEqual({ patients: 'off' });
    expect(moduleStatesFor(new Set(['invoices.read']), { finance: 'none' }, { 'finance.invoices_view': true })).toEqual({ finance: 'granted' });
    expect(moduleStatesFor(new Set(['patients.read']), {}, {})).toEqual({});
  });

  it('sanitizes unknown keys and non-booleans', () => {
    expect(sanitizeFeatureAccess({ 'patients.create': false, 'nope.x': true, 'patients.edit': 'yes' })).toEqual({ 'patients.create': false });
  });
});
