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

  // ── Coordination of Benefits ──────────────────────────────────────
  // Every COB decision is auditable because every one of them can change
  // which payer is billed, and a payer dispute six months later is settled
  // by showing what we decided, when, and on what facts.
  COB_ORDER_SUGGESTED: 1060,
  COB_ORDER_OVERRIDDEN: 1061,
  COB_FLAG_RAISED: 1062,
  COB_FLAG_RESOLVED: 1063,
  COB_VERIFIED: 1064,
  COB_PAYER_REPORTED: 1065,
  COB_PLAN_FIELD_CHANGED: 1066,
  COB_DENIAL: 1067,
  COB_COVERAGE_DETAIL_CHANGED: 1068,
  COB_SUBMISSION_BLOCKED: 1069,
  // A card image is PHI (member ID, subscriber name), so adding and removing
  // one is audited the same way every other COB write is.
  COB_COVERAGE_CARD_UPLOADED: 1070,
  COB_COVERAGE_CARD_DELETED: 1071,
  // A plan request is how a plan enters the master list, and the plan's COB
  // fields rank every patient on it — so who asked and who resolved it is
  // part of the same trail.
  COB_PLAN_REQUESTED: 1072,
  COB_PLAN_REQUEST_RESOLVED: 1073,
} as const;

export type PermTypeValue = (typeof PermType)[keyof typeof PermType];
