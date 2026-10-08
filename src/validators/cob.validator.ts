import { body, ValidationChain } from 'express-validator';
import { COB_ENUMS } from '../services/cob/facts';
import { ELIGIBILITY_SOURCES, REVIEW_FLAGS } from '../services/cob/types';

/**
 * Validators for the COB endpoints.
 *
 * The enum lists come from COB_ENUMS, the same constant the services
 * validate against and the same one the GET /cob/enums endpoint serves. One
 * source so a value the UI offers cannot be one the server rejects.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const overrideOrderValidator: ValidationChain[] = [
  body('orderedCoverageIds')
    .isArray({ min: 1 })
    .withMessage('orderedCoverageIds must be a non-empty array of coverage ids'),
  body('orderedCoverageIds.*')
    .isString()
    .withMessage('Each coverage id must be a string'),
  // A reason is required by the spec and by the point of the feature: the
  // override's only lasting value is the record of why the rules were wrong.
  body('reason')
    .isString()
    .withMessage('reason must be a string')
    .bail()
    .trim()
    .isLength({ min: 10 })
    .withMessage(
      'reason must be at least 10 characters — say what the payer or the plan document told you'
    ),
];

export const resolveFlagValidator: ValidationChain[] = [
  body('flag')
    .isIn([...REVIEW_FLAGS])
    .withMessage(`flag must be one of: ${REVIEW_FLAGS.join(', ')}`),
  body('resolutionNote')
    .isString()
    .bail()
    .trim()
    .isLength({ min: 5 })
    .withMessage('resolutionNote is required — record what you found'),
];

export const payerReportedCoverageValidator: ValidationChain[] = [
  body('source')
    .isIn([...ELIGIBILITY_SOURCES])
    .withMessage(`source must be one of: ${ELIGIBILITY_SOURCES.join(', ')}`),
  body('coverageId').optional().isString(),
  body('reportingCarrierId').optional().isString(),
  body('reportedSelfOrder')
    .optional({ nullable: true })
    .isInt({ min: 1, max: 9 })
    .withMessage('reportedSelfOrder must be a position from 1 to 9'),
  body('otherPayerReportedOrder')
    .optional({ nullable: true })
    .isInt({ min: 1, max: 9 })
    .withMessage('otherPayerReportedOrder must be a position from 1 to 9'),
  body('reportedIsActive').optional({ nullable: true }).isBoolean(),
  body('otherPayerName').optional({ nullable: true }).isString(),
  body('reportedDate')
    .optional()
    .matches(ISO_DATE)
    .withMessage('reportedDate must be YYYY-MM-DD'),
  body('note').optional({ nullable: true }).isString(),
];

export const planCobFieldsValidator: ValidationChain[] = [
  body('benefitCategory')
    .optional()
    .isIn([...COB_ENUMS.benefitCategory])
    .withMessage(`benefitCategory must be one of: ${COB_ENUMS.benefitCategory.join(', ')}`),
  body('coordinatesBenefits')
    .optional()
    .isBoolean()
    .withMessage('coordinatesBenefits must be a boolean'),
  body('cobPaymentMethod')
    .optional()
    .isIn([...COB_ENUMS.cobPaymentMethod])
    .withMessage(`cobPaymentMethod must be one of: ${COB_ENUMS.cobPaymentMethod.join(', ')}`),
  body('cobInfoSource')
    .optional()
    .isIn([...COB_ENUMS.cobInfoSource])
    .withMessage(`cobInfoSource must be one of: ${COB_ENUMS.cobInfoSource.join(', ')}`),
  body('changeNote').optional().isString(),
];

export const coverageDetailValidator: ValidationChain[] = [
  body('coverageBasis').optional({ nullable: true }).isIn([...COB_ENUMS.coverageBasis]),
  body('subscriberEmploymentStatus')
    .optional({ nullable: true })
    .isIn([...COB_ENUMS.employmentStatus]),
  body('employerSizeBand').optional({ nullable: true }).isIn([...COB_ENUMS.employerSizeBand]),
  body('medicareEntitlementReason')
    .optional({ nullable: true })
    .isIn([...COB_ENUMS.medicareEntitlementReason]),
  body('esrdEntitlementDate')
    .optional({ nullable: true })
    .matches(ISO_DATE)
    .withMessage('esrdEntitlementDate must be YYYY-MM-DD'),
  body('subscriberName').optional({ nullable: true }).isString(),
  body('subscriberBirthdate')
    .optional({ nullable: true })
    .matches(ISO_DATE)
    .withMessage('subscriberBirthdate must be YYYY-MM-DD'),
  body('custodyArrangement').optional({ nullable: true }).isIn([...COB_ENUMS.custodyArrangement]),
  body('custodyRole').optional({ nullable: true }).isIn([...COB_ENUMS.custodyRole]),
  body('courtOrderExists').optional().isBoolean(),
  body('courtOrderNamesThisCoverage').optional().isBoolean(),
  body('isTricareSupplement').optional().isBoolean(),
];

export const payerTypeValidator: ValidationChain[] = [
  body('payerType')
    .isIn([...COB_ENUMS.payerType])
    .withMessage(`payerType must be one of: ${COB_ENUMS.payerType.join(', ')}`),
];

/**
 * The estimate takes IDENTIFIERS and derives the figures server-side from the
 * plan's fee schedule, its coverage table, the deductible ledger and the
 * primary's remittance. The numeric fields below are optional staff
 * OVERRIDES — none is required, and `billedAmount` in particular is no longer
 * mandatory because it can be read off the primary's remittance.
 */
export const secondaryEstimateValidator: ValidationChain[] = [
  body('procedureCode')
    .optional({ nullable: true })
    .isString()
    .withMessage('procedureCode must be a procedure code string, e.g. D2740'),
  body('primaryClaimId').optional({ nullable: true }).isString(),
  body('billedAmount').optional().isFloat({ min: 0 }),
  body('allowedAmount').optional().isFloat({ min: 0 }),
  body('primaryPaid').optional().isFloat({ min: 0 }),
  body('primaryPatientResponsibility').optional().isFloat({ min: 0 }),
  body('secondaryCoveragePercent')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('secondaryCoveragePercent must be between 0 and 100'),
  body('secondaryDeductibleRemaining').optional().isFloat({ min: 0 }),
];

export const evaluateOrderValidator: ValidationChain[] = [
  body('dateOfService').optional().matches(ISO_DATE).withMessage('dateOfService must be YYYY-MM-DD'),
  body('effectiveFrom').optional().matches(ISO_DATE).withMessage('effectiveFrom must be YYYY-MM-DD'),
  // Naming a claim lets the server read that claim's own accident and
  // employment flags instead of trusting the two fields below.
  body('claimId').optional({ nullable: true }).isString(),
  body('injuryRelated').optional().isBoolean(),
  body('injuryType')
    .optional({ nullable: true })
    .isIn(['WORKERS_COMP', 'AUTO_LIABILITY'])
    .withMessage('injuryType must be WORKERS_COMP or AUTO_LIABILITY'),
];
