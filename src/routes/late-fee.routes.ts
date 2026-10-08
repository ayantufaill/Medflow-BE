import { Router } from 'express';
import {
  lateFeePolicyController,
  lateFeeAcceptanceController,
  lateFeeWaiverController,
  lateFeeApplicationController,
  lateFeeJobController,
} from '../controllers/late-fee.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  createLateFeePolicyValidator,
  updateLateFeePolicyValidator,
  recordAcceptanceValidator,
  waiveLateFeeValidator,
  waiverReportValidator,
  policyTermsValidator,
  patientAcceptanceHistoryValidator,
  lateFeeApplicationsValidator,
  lateFeeSettingsValidator,
} from '../validators/late-fee.validator';

const router = Router();

router.get(
  '/clinics/:clinicId/settings',
  authenticate,
  requirePermission('billing.late_fee.view'),
  lateFeePolicyController.getSettings.bind(lateFeePolicyController)
);

router.patch(
  '/clinics/:clinicId/settings',
  authenticate,
  requirePermission('billing.late_fee.policy_manage'),
  validate(lateFeeSettingsValidator),
  lateFeePolicyController.updateSettings.bind(lateFeePolicyController)
);

router.get(
  '/applications',
  authenticate,
  requirePermission('billing.late_fee.view'),
  validate(lateFeeApplicationsValidator),
  lateFeeApplicationController.list.bind(lateFeeApplicationController)
);

router.post(
  '/run-job',
  authenticate,
  requirePermission('billing.late_fee.policy_manage'),
  lateFeeJobController.runJob.bind(lateFeeJobController)
);

router.post(
  '/clinics/:clinicId/late-fee-policy',
  authenticate,
  requirePermission('billing.late_fee.policy_manage'),
  validate(createLateFeePolicyValidator),
  lateFeePolicyController.createPolicy.bind(lateFeePolicyController)
);

router.get(
  '/clinics/:clinicId/late-fee-policy',
  authenticate,
  requirePermission('billing.late_fee.view'),
  lateFeePolicyController.getPolicy.bind(lateFeePolicyController)
);

router.get(
  '/clinics/:clinicId/late-fee-policy/:version',
  authenticate,
  requirePermission('billing.late_fee.view'),
  lateFeePolicyController.getPolicy.bind(lateFeePolicyController)
);

router.patch(
  '/clinics/:clinicId/late-fee-policy/:version',
  authenticate,
  requirePermission('billing.late_fee.policy_manage'),
  validate(updateLateFeePolicyValidator),
  lateFeePolicyController.updatePolicy.bind(lateFeePolicyController)
);

router.post(
  '/clinics/:clinicId/late-fee-policy/:version/activate',
  authenticate,
  requirePermission('billing.late_fee.policy_manage'),
  lateFeePolicyController.activatePolicy.bind(lateFeePolicyController)
);

router.get(
  '/clinics/:clinicId/late-fee-policy/:version/terms',
  authenticate,
  requirePermission('billing.late_fee.view'),
  validate(policyTermsValidator),
  lateFeePolicyController.getTerms.bind(lateFeePolicyController)
);

router.post(
  '/patients/:patientId/late-fee-acceptance',
  authenticate,
  requirePermission('billing.late_fee.policy_manage'),
  validate(recordAcceptanceValidator),
  lateFeeAcceptanceController.recordAcceptance.bind(lateFeeAcceptanceController)
);

router.get(
  '/patients/:patientId/late-fee-acceptance',
  authenticate,
  requirePermission('billing.late_fee.view'),
  validate(patientAcceptanceHistoryValidator),
  lateFeeAcceptanceController.getAcceptanceHistory.bind(lateFeeAcceptanceController)
);

router.post(
  '/late-fee/applications/:applicationId/waive',
  authenticate,
  requirePermission('billing.late_fee.waive'),
  validate(waiveLateFeeValidator),
  lateFeeWaiverController.waiveFee.bind(lateFeeWaiverController)
);

router.get(
  '/reports/late-fee-waivers',
  authenticate,
  requirePermission('billing.late_fee.view'),
  validate(waiverReportValidator),
  lateFeeWaiverController.getWaiverReport.bind(lateFeeWaiverController)
);

export default router;