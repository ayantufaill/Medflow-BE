import { Router } from 'express';
import { cobController } from '../controllers/cob.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { resolveBranchAccess } from '../middleware/branchAccess.middleware';
import { enterTenantContext } from '../middleware/tenantContext.middleware';
import { requirePhiAccess } from '../middleware/phi.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  coverageDetailValidator,
  evaluateOrderValidator,
  overrideOrderValidator,
  payerReportedCoverageValidator,
  payerTypeValidator,
  planCobFieldsValidator,
  resolveFlagValidator,
  secondaryEstimateValidator,
} from '../validators/cob.validator';

/**
 * Coordination of Benefits API.
 *
 * Permission keys are written as string LITERALS, not as PERMISSIONS.*
 * references, to match every other route file — and because
 * tests/rbac/catalog-drift.test.ts is a text scanner over these files that
 * cannot resolve a constant, so a reference here would read as an unknown
 * permission and fail the drift guard. The literals are pinned against
 * PERMISSIONS and PERMISSION_CATALOG in tests/cob-api.test.ts.
 *
 * Permission split, and why it is not uniform:
 *
 *   coverage_order.read      the whole front desk — everyone who answers
 *                            "which insurance is primary?" needs to see the
 *                            order and its reasoning
 *   coverage_order.override  changing the order away from the rules is a
 *                            billing decision, and it has to be attributable
 *   coverage_order.resolve_flag  clearing a payer mismatch unblocks billing
 *   payer_reported.write     recording what a payer said
 *   plan_master.read/edit    plan COB fields are master data: one edit
 *                            re-ranks every patient on the plan, so editing
 *                            is a billing-admin permission, not a front-desk
 *                            one
 */

const router = Router();

// A coverage order names a patient's insurers, so these endpoints carry PHI
// and are branch-scoped like patient-insurance.routes.ts. The plan-master
// endpoints under /plans are reference data and would not need it on their
// own, but they live here because they are the COB fields, and a single
// router-level guard is safer than per-route exceptions.
router.use(authenticate);
router.use(requirePhiAccess);
router.use(resolveBranchAccess);
router.use(enterTenantContext);

const canRead = requirePermission('insurance.coverage_order.read');

// ── Reference data ────────────────────────────────────────────────────────
router.get('/enums', canRead, cobController.getEnums.bind(cobController));
router.get(
  '/eligibility/providers',
  canRead,
  cobController.getEligibilityProviders.bind(cobController)
);

// ── Plan master (COB fields) ──────────────────────────────────────────────
router.get(
  '/plans',
  requirePermission('insurance.plan_master.read'),
  cobController.listPlans.bind(cobController)
);
router.get(
  '/plans/:planId',
  requirePermission('insurance.plan_master.read'),
  cobController.getPlan.bind(cobController)
);
// Read-only dry run of a COB-field change, so the edit screen can show how
// many patients it would re-rank before the admin commits. Gated on `edit`
// rather than `read`: it is only ever asked for while editing, and the count
// is a hint about billing workload.
router.get(
  '/plans/:planId/cob-impact',
  requirePermission('insurance.plan_master.edit'),
  cobController.getPlanCobImpact.bind(cobController)
);
router.patch(
  '/plans/:planId/cob',
  requirePermission('insurance.plan_master.edit'),
  validate(planCobFieldsValidator),
  cobController.updatePlanCobFields.bind(cobController)
);

// ── Carrier payer type ────────────────────────────────────────────────────
router.patch(
  '/carriers/:carrierId/payer-type',
  requirePermission('insurance.plan_master.edit'),
  validate(payerTypeValidator),
  cobController.setCarrierPayerType.bind(cobController)
);

// ── Coverage detail: the facts the rules need ─────────────────────────────
router.get(
  '/coverages/:coverageId/detail',
  canRead,
  cobController.getCoverageDetail.bind(cobController)
);
router.patch(
  '/coverages/:coverageId/detail',
  requirePermission('insurance.coverage_detail.edit'),
  validate(coverageDetailValidator),
  cobController.updateCoverageDetail.bind(cobController)
);
router.post(
  '/coverages/:coverageId/secondary-estimate',
  canRead,
  validate(secondaryEstimateValidator),
  cobController.estimateSecondary.bind(cobController)
);

// ── Coverage order ────────────────────────────────────────────────────────
router.get(
  '/patients/:patientId/coverage-order',
  canRead,
  cobController.getCurrentOrder.bind(cobController)
);
router.get(
  '/patients/:patientId/coverage-order/on-date',
  canRead,
  cobController.getOrderForDate.bind(cobController)
);
router.get(
  '/patients/:patientId/coverage-order/history',
  canRead,
  cobController.getOrderHistory.bind(cobController)
);
router.post(
  '/patients/:patientId/coverage-order/evaluate',
  canRead,
  validate(evaluateOrderValidator),
  cobController.evaluateOrder.bind(cobController)
);
router.post(
  '/patients/:patientId/coverage-order/override',
  requirePermission('insurance.coverage_order.override'),
  validate(overrideOrderValidator),
  cobController.overrideOrder.bind(cobController)
);
router.post(
  '/coverage-orders/:orderId/resolve-flag',
  requirePermission('insurance.coverage_order.resolve_flag'),
  validate(resolveFlagValidator),
  cobController.resolveFlag.bind(cobController)
);

// ── Payer-reported coverage (manual eligibility entry) ────────────────────
router.get(
  '/patients/:patientId/payer-reported-coverage',
  canRead,
  cobController.listPayerReportedCoverage.bind(cobController)
);
router.post(
  '/patients/:patientId/payer-reported-coverage',
  requirePermission('insurance.payer_reported.write'),
  validate(payerReportedCoverageValidator),
  cobController.recordPayerReportedCoverage.bind(cobController)
);

// ── Claims and invoices ───────────────────────────────────────────────────
router.get(
  '/claims/:claimId/coverage-order',
  canRead,
  cobController.getOrderForClaim.bind(cobController)
);
router.get(
  '/claims/:claimId/secondary-readiness',
  canRead,
  cobController.getSecondaryReadiness.bind(cobController)
);
router.get(
  '/claims/:claimId/primary-payment',
  canRead,
  cobController.getPrimaryPaymentDetail.bind(cobController)
);
router.get(
  '/invoices/:invoiceId/responsibility',
  canRead,
  cobController.getInvoiceResponsibility.bind(cobController)
);

export default router;
