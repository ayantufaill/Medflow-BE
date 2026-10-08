import { Request, Response, NextFunction } from 'express';
import { cobService } from '../services/cob/cob.service';
import { planMasterService } from '../services/cob/plan-master.service';
import { coverageDetailService, setPayerType } from '../services/cob/coverage-detail.service';
import {
  getPrimaryPaymentDetail,
  getBalanceByResponsibleParty,
  getPrimaryRemittanceStatus,
} from '../services/cob/claim-cob.service';
import {
  listEligibilityProviders,
  getEligibilityProvider,
  manualEligibilityProvider,
} from '../services/cob/eligibility';
import { BadRequestError } from '../utils/error.util';

/** Routes are all behind `authenticate`, so req.userId is always present. */
const userNum = (req: Request): bigint => BigInt(req.userId as string);

export class CobController {
  // ── Coverage order ────────────────────────────────────────────────────

  /** Current suggested order, with explanations, flags and excluded coverages. */
  async getCurrentOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const { patientId } = req.params;
      const order = await cobService.getCurrentOrder(patientId);
      const coverages = await cobService.listCoverages(patientId);
      const submittable = await cobService.checkSubmittable(
        patientId,
        (req.query.dateOfService as string) || new Date().toISOString().slice(0, 10)
      );
      res.status(200).json({
        success: true,
        data: { order, coverages, submittable },
      });
    } catch (error) {
      next(error);
    }
  }

  /** The order in force on a date — what a claim for that date must use. */
  async getOrderForDate(req: Request, res: Response, next: NextFunction) {
    try {
      const { patientId } = req.params;
      const date = req.query.date as string;
      if (!date) throw new BadRequestError('A `date` query parameter (YYYY-MM-DD) is required');
      const order = await cobService.getOrderForDate(patientId, date);
      res.status(200).json({ success: true, data: { order, date } });
    } catch (error) {
      next(error);
    }
  }

  async getOrderHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const orders = await cobService.getOrderHistory(req.params.patientId);
      res.status(200).json({ success: true, data: { orders } });
    } catch (error) {
      next(error);
    }
  }

  /** Re-run the pipeline on demand. */
  async evaluateOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const { patientId } = req.params;
      const order = await cobService.evaluateAndSave(patientId, {
        dateOfService: req.body?.dateOfService,
        effectiveFrom: req.body?.effectiveFrom,
        triggerReason: req.body?.triggerReason || 'MANUAL_EVALUATION',
        claimContext: {
          // Preferred: name the claim and let the server read its own
          // accident/employment flags. The two explicit fields remain as a
          // staff override for a claim whose flags are known to be wrong.
          claimId: req.body?.claimId ?? null,
          injuryRelated: req.body?.injuryRelated,
          injuryType: req.body?.injuryType ?? undefined,
        },
        userNum: userNum(req),
        req,
      });
      res.status(200).json({ success: true, data: { order } });
    } catch (error) {
      next(error);
    }
  }

  /** Replace the suggested order with staff's own. Requires a reason. */
  async overrideOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const { patientId } = req.params;
      const { orderedCoverageIds, reason } = req.body || {};
      const order = await cobService.overrideOrder(
        patientId,
        orderedCoverageIds,
        reason,
        userNum(req),
        req
      );
      res.status(200).json({ success: true, data: { order } });
    } catch (error) {
      next(error);
    }
  }

  async resolveFlag(req: Request, res: Response, next: NextFunction) {
    try {
      const { orderId } = req.params;
      const { flag, resolutionNote } = req.body || {};
      const order = await cobService.resolveFlag(
        orderId,
        flag,
        resolutionNote,
        userNum(req),
        req
      );
      res.status(200).json({ success: true, data: { order } });
    } catch (error) {
      next(error);
    }
  }

  // ── Eligibility / payer-reported coverage ─────────────────────────────

  /**
   * Record what a payer said. The MANUAL provider's entry point today; the
   * 270/271 provider will post the same shape.
   */
  async recordPayerReportedCoverage(req: Request, res: Response, next: NextFunction) {
    try {
      const { patientId } = req.params;
      const body = req.body || {};

      // Normalize through the provider so the manual path and a future EDI
      // path converge on one shape before anything is stored.
      const normalized = manualEligibilityProvider.fromStaffEntry({
        active: body.reportedIsActive,
        reportedSelfOrder: body.reportedSelfOrder,
        reportedDate: body.reportedDate || new Date().toISOString().slice(0, 10),
        source: body.source,
        note: body.note,
        raw: body.raw,
      });

      const result = await cobService.recordPayerReportedCoverage(
        {
          patientId,
          coverageId: body.coverageId,
          reportingCarrierId: body.reportingCarrierId,
          reportedSelfOrder: normalized.reportedSelfOrder,
          reportedIsActive: normalized.active,
          otherPayerName: body.otherPayerName,
          otherPayerCarrierId: body.otherPayerCarrierId,
          otherPayerReportedOrder: body.otherPayerReportedOrder,
          reportedDate: normalized.reportedDate,
          source: normalized.source,
          note: normalized.note,
          raw: normalized.raw,
        },
        userNum(req),
        req
      );
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async listPayerReportedCoverage(req: Request, res: Response, next: NextFunction) {
    try {
      const reports = await cobService.listPayerReportedCoverage(req.params.patientId);
      res.status(200).json({ success: true, data: { reports } });
    } catch (error) {
      next(error);
    }
  }

  /** Which eligibility providers exist, and can they be queried automatically. */
  async getEligibilityProviders(_req: Request, res: Response, next: NextFunction) {
    try {
      const providers = listEligibilityProviders().map((p) => ({
        name: p.name,
        isAutomated: p.isAutomated,
      }));
      res.status(200).json({
        success: true,
        data: { providers, active: getEligibilityProvider().name },
      });
    } catch (error) {
      next(error);
    }
  }

  // ── Coverage detail (the facts the rules need) ─────────────────────────

  async getCoverageDetail(req: Request, res: Response, next: NextFunction) {
    try {
      const detail = await coverageDetailService.get(req.params.coverageId);
      res.status(200).json({ success: true, data: { detail } });
    } catch (error) {
      next(error);
    }
  }

  async updateCoverageDetail(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await coverageDetailService.upsert(
        req.params.coverageId,
        req.body || {},
        userNum(req),
        { req }
      );
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async setCarrierPayerType(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await setPayerType(
        req.params.carrierId,
        req.body?.payerType,
        userNum(req),
        req
      );
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // ── Plan master ───────────────────────────────────────────────────────

  async listPlans(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await planMasterService.listPlans({
        search: req.query.search as string,
        carrierId: req.query.carrierId as string,
        benefitCategory: req.query.benefitCategory as string,
        cobPaymentMethod: req.query.cobPaymentMethod as string,
        unconfirmedOnly: req.query.unconfirmedOnly === 'true',
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 25,
      });
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getPlan(req: Request, res: Response, next: NextFunction) {
    try {
      const plan = await planMasterService.getPlan(req.params.planId);
      res.status(200).json({ success: true, data: { plan } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Dry run: how many patients a COB-field change would re-rank.
   *
   * Read-only, so the admin UI can show the blast radius before the save
   * rather than reporting it afterwards.
   */
  async getPlanCobImpact(req: Request, res: Response, next: NextFunction) {
    try {
      const impact = await planMasterService.previewCobChangeImpact(req.params.planId);
      res.status(200).json({ success: true, data: impact });
    } catch (error) {
      next(error);
    }
  }

  /** PATCH the COB fields. Versioned, and re-ranks patients with open claims. */
  async updatePlanCobFields(req: Request, res: Response, next: NextFunction) {
    try {
      const { changeNote, ...fields } = req.body || {};
      const result = await planMasterService.updateCobFields(
        req.params.planId,
        fields,
        userNum(req),
        { changeNote, req }
      );
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // ── Estimates, claims, balances ────────────────────────────────────────

  /**
   * Secondary payment estimate. Returns a RANGE when the method is UNKNOWN.
   *
   * The caller sends IDENTIFIERS, not figures: `procedureCode` to price
   * against the plan's own fee schedule and coverage table, and
   * `primaryClaimId` to read the primary's adjudication from its remittance.
   *
   * The numeric fields are optional staff OVERRIDES and are forwarded only
   * when actually present — `Number(x) || 0` would have turned every omitted
   * field into an explicit zero, which the service cannot tell apart from
   * "staff really did enter 0" and which previously made an unresolved
   * benefit percentage read as "this plan pays nothing".
   */
  async estimateSecondary(req: Request, res: Response, next: NextFunction) {
    const body = req.body || {};
    const numeric = (value: unknown): number | undefined =>
      value === undefined || value === null || value === '' ? undefined : Number(value);

    try {
      const result = await cobService.estimateSecondary(req.params.coverageId, {
        procedureCode: body.procedureCode ?? null,
        primaryClaimId: body.primaryClaimId ?? null,
        billedAmount: numeric(body.billedAmount),
        allowedAmount: numeric(body.allowedAmount),
        primaryPaid: numeric(body.primaryPaid),
        primaryPatientResponsibility: numeric(body.primaryPatientResponsibility),
        secondaryCoveragePercent: numeric(body.secondaryCoveragePercent),
        secondaryDeductibleRemaining: numeric(body.secondaryDeductibleRemaining),
      });
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * The order that applies to one claim, including its own injury flags.
   * Read-only — nothing is persisted.
   */
  async getOrderForClaim(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await cobService.getOrderForClaim(req.params.claimId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /** Can a secondary be created yet, and what would it carry? */
  async getSecondaryReadiness(req: Request, res: Response, next: NextFunction) {
    try {
      const status = await getPrimaryRemittanceStatus(BigInt(req.params.claimId));
      res.status(200).json({ success: true, data: status });
    } catch (error) {
      next(error);
    }
  }

  /** The primary adjudication a secondary claim is carrying. */
  async getPrimaryPaymentDetail(req: Request, res: Response, next: NextFunction) {
    try {
      const detail = await getPrimaryPaymentDetail(BigInt(req.params.claimId));
      res.status(200).json({ success: true, data: { primaryPayment: detail } });
    } catch (error) {
      next(error);
    }
  }

  /** Invoice balance split by responsible party, with contractual adjustments. */
  async getInvoiceResponsibility(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await getBalanceByResponsibleParty(BigInt(req.params.invoiceId));
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /** Enum values for the UI, so the client cannot drift from the server. */
  async getEnums(_req: Request, res: Response, next: NextFunction) {
    try {
      res.status(200).json({ success: true, data: cobService.getEnums() });
    } catch (error) {
      next(error);
    }
  }
}

export const cobController = new CobController();
