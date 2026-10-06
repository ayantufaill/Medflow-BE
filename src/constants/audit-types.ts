/**
 * Numeric PermType constants for MedFlow-specific audit events.
 * Starting at 1000 to avoid collision with Open Dental's own PermType enum
 * (which occupies 0–999).
 *
 * These are written into the securitylog.PermType column by writeAudit().
 */

export const PermType = {
  // ── Role lifecycle ────────────────────────────────────────────────
  ROLE_CREATED: 1001,
  ROLE_UPDATED: 1002,
  ROLE_DELETED: 1003,
  ROLE_ASSIGNED: 1004,
  ROLE_REMOVED: 1005,

  // ── Permission changes ───────────────────────────────────────────
  PERMISSION_CHANGED: 1006,

  // ── Clinic / branch assignment ────────────────────────────────────
  CLINIC_ASSIGNED: 1010,

  // ── Data-sharing policy ───────────────────────────────────────────
  SHARING_CHANGED: 1020,

  // ── User activation ──────────────────────────────────────────────
  USER_ACTIVATED: 1030,
  USER_DEACTIVATED: 1031,

  // ── Lock-date changes ─────────────────────────────────────────────
  LOCKDATE_CHANGED: 1040,

  // ── Cross-branch PHI read audit ───────────────────────────────────
  CROSS_BRANCH_READ: 1050,

  // ── Patient record access (every read, and every refused attempt) ─
  PATIENT_RECORD_READ: 1051,
  PATIENT_ACCESS_DENIED: 1052,
} as const;

export type PermTypeValue = (typeof PermType)[keyof typeof PermType];
