import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { LateFeeGuardrails } from '../services/late-fee-guardrails.service';
import { lateFeeScheduler } from '../services/late-fee-scheduler.service';
import { writeAudit } from '../services/audit.service';
import { BadRequestError, NotFoundError } from '../utils/error.util';

export class LateFeePolicyController {
  async getPolicy(req: Request, res: Response, next: NextFunction) {
    try {
      const clinicId = BigInt(req.params.clinicId);
      const version = req.params.version ? BigInt(req.params.version) : null;

      if (version) {
        const policy = await prisma.lateFeePolicy.findUnique({
          where: { id: version },
        });
        if (!policy || policy.clinicId !== clinicId) {
          throw new NotFoundError('Policy not found');
        }
        return res.status(200).json({ success: true, data: this.formatPolicy(policy) });
      }

      const policies = await prisma.lateFeePolicy.findMany({
        where: { clinicId },
        orderBy: { version: 'desc' },
      });

      const active = policies.find(p => p.isActive);
      return res.status(200).json({
        success: true,
        data: {
          active: active ? this.formatPolicy(active) : null,
          history: policies.map(this.formatPolicy),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async createPolicy(req: Request, res: Response, next: NextFunction) {
    try {
      const clinicId = BigInt(req.body.clinicId);
      const userId = BigInt(req.userId!);

      const existingActive = await prisma.lateFeePolicy.findFirst({
        where: { clinicId, isActive: true },
      });

      const maxVersion = await prisma.lateFeePolicy.aggregate({
        where: { clinicId },
        _max: { version: true },
      });
      const nextVersion = (maxVersion._max.version ?? 0) + 1;

      const policy = await prisma.lateFeePolicy.create({
        data: {
          clinicId,
          version: nextVersion,
          isActive: true,
          termsText: req.body.termsText,
          gracePeriodDays: req.body.gracePeriodDays ?? 15,
          paymentTermsDays: req.body.paymentTermsDays ?? 30,
          feeType: req.body.feeType,
          patientFeeAmount: req.body.patientFeeAmount ?? 0,
          corporateFeePct: req.body.corporateFeePct ?? 0,
          capPct: req.body.capPct ?? 10,
          enabled: req.body.enabled ?? false,
          createdBy: userId,
        },
      });

      if (existingActive) {
        await prisma.lateFeePolicy.update({
          where: { id: existingActive.id },
          data: { isActive: false },
        });
      }

      await writeAudit({
        userNum: userId,
        permType: 999,
        clinicNum: clinicId,
        text: `Created late fee policy v${nextVersion} for clinic ${clinicId}`,
        source: 1,
      });

      res.status(201).json({ success: true, data: this.formatPolicy(policy) });
    } catch (error) {
      next(error);
    }
  }

  async updatePolicy(req: Request, res: Response, next: NextFunction) {
    try {
      const clinicId = BigInt(req.params.clinicId);
      const sourceVersion = BigInt(req.params.version);
      const userId = BigInt(req.userId!);

      // Create a new version based on the source version (immutable policy)
      const sourcePolicy = await prisma.lateFeePolicy.findUnique({
        where: { id: sourceVersion },
      });
      if (!sourcePolicy || sourcePolicy.clinicId !== clinicId) {
        throw new NotFoundError('Policy not found');
      }

      const maxVersion = await prisma.lateFeePolicy.aggregate({
        where: { clinicId },
        _max: { version: true },
      });
      const newVersion = (maxVersion._max.version ?? 0) + 1;

      const newPolicy = await prisma.lateFeePolicy.create({
        data: {
          clinicId,
          version: newVersion,
          isActive: true,
          termsText: req.body.termsText ?? sourcePolicy.termsText,
          gracePeriodDays: req.body.gracePeriodDays ?? sourcePolicy.gracePeriodDays,
          paymentTermsDays: req.body.paymentTermsDays ?? sourcePolicy.paymentTermsDays,
          feeType: req.body.feeType ?? sourcePolicy.feeType,
          patientFeeAmount: req.body.patientFeeAmount ?? sourcePolicy.patientFeeAmount,
          corporateFeePct: req.body.corporateFeePct ?? sourcePolicy.corporateFeePct,
          capPct: req.body.capPct ?? sourcePolicy.capPct,
          enabled: req.body.enabled ?? sourcePolicy.enabled,
          createdBy: userId,
        },
      });

      // Deactivate all active policies for this clinic except the new one
      await prisma.lateFeePolicy.updateMany({
        where: {
          clinicId,
          isActive: true,
          id: { not: newPolicy.id },
        },
        data: { isActive: false },
      });

      await writeAudit({
        userNum: userId,
        permType: 999,
        clinicNum: clinicId,
        text: `Created late fee policy v${newVersion} (based on v${sourceVersion}) for clinic ${clinicId}`,
        source: 1,
      });

      res.status(201).json({ success: true, data: this.formatPolicy(newPolicy) });
    } catch (error) {
      next(error);
    }
  }

  async activatePolicy(req: Request, res: Response, next: NextFunction) {
    try {
      const clinicId = BigInt(req.params.clinicId);
      const version = BigInt(req.params.version);
      const userId = BigInt(req.userId!);

      const policy = await prisma.lateFeePolicy.findUnique({ where: { id: version } });
      if (!policy || policy.clinicId !== clinicId) {
        throw new NotFoundError('Policy not found');
      }

      await prisma.$transaction(async (tx) => {
        await tx.lateFeePolicy.updateMany({
          where: { clinicId, isActive: true },
          data: { isActive: false },
        });
        await tx.lateFeePolicy.update({
          where: { id: version },
          data: { isActive: true },
        });
      });

      await writeAudit({
        userNum: userId,
        permType: 999,
        clinicNum: clinicId,
        text: `Activated late fee policy v${version}`,
        source: 1,
      });

      res.status(200).json({ success: true, message: 'Policy activated' });
    } catch (error) {
      next(error);
    }
  }



  async getTerms(req: Request, res: Response, next: NextFunction) {
    try {
      const version = BigInt(req.params.version);
      const policy = await prisma.lateFeePolicy.findUnique({ where: { id: version } });
      if (!policy) throw new NotFoundError('Policy not found');

      res.status(200).json({ success: true, data: { termsText: policy.termsText, version: policy.version } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /late-fee/clinics/:clinicId/settings — the per-clinic program switch
   * the scheduler gates on (clinic.features.lateFee.enabled).
   */
  async getSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const clinicId = BigInt(req.params.clinicId);
      const clinic = await prisma.clinic.findUnique({
        where: { ClinicNum: clinicId },
        select: { features: true },
      });
      if (!clinic) throw new NotFoundError('Clinic not found');

      const lateFee = ((clinic.features as Record<string, any>) ?? {}).lateFee as Record<string, any> | undefined;
      res.status(200).json({ success: true, data: { enabled: lateFee?.enabled === true, features: clinic.features ?? {} } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /late-fee/clinics/:clinicId/settings — flip clinic.features.lateFee.enabled.
   * A policy still has to exist and be active+enabled for the job to charge;
   * this switch is the master gate that stops all charging.
   */
  async updateSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const clinicId = BigInt(req.params.clinicId);
      const enabled = req.body.enabled === true;
      const userId = BigInt(req.userId!);

      const clinic = await prisma.clinic.findUnique({
        where: { ClinicNum: clinicId },
        select: { features: true },
      });
      if (!clinic) throw new NotFoundError('Clinic not found');

      const features = {
        ...((clinic.features as Record<string, any>) ?? {}),
        lateFee: { enabled },
      };
      const updated = await prisma.clinic.update({
        where: { ClinicNum: clinicId },
        data: { features: features as any },
        select: { features: true },
      });

      await writeAudit({
        userNum: userId,
        permType: 999,
        clinicNum: clinicId,
        text: `Late fees ${enabled ? 'enabled' : 'disabled'} for clinic ${clinicId}`,
        source: 1,
      });

      const lateFee = ((updated.features as Record<string, any>) ?? {}).lateFee as Record<string, any> | undefined;
      res.status(200).json({
        success: true,
        data: { enabled: lateFee?.enabled === true, features: updated.features ?? {} },
      });
    } catch (error) {
      next(error);
    }
  }

  private formatPolicy(p: any) {
    return {
      id: p.id.toString(),
      clinicId: p.clinicId.toString(),
      version: p.version,
      isActive: p.isActive,
      termsText: p.termsText,
      gracePeriodDays: p.gracePeriodDays,
      paymentTermsDays: p.paymentTermsDays,
      feeType: p.feeType,
      patientFeeAmount: Number(p.patientFeeAmount),
      corporateFeePct: Number(p.corporateFeePct),
      capPct: Number(p.capPct),
      enabled: p.enabled,
      createdAt: p.createdAt,
      createdBy: p.createdBy?.toString(),
    };
  }
}

export class LateFeeAcceptanceController {
  async recordAcceptance(req: Request, res: Response, next: NextFunction) {
    try {
      const { policyVersionId, patientId, corporateClientId, channel, acceptedBy } = req.body;
      const userId = BigInt(req.userId!);

      if (!patientId && !corporateClientId) {
        throw new BadRequestError('Either patientId or corporateClientId is required');
      }

      const policy = await prisma.lateFeePolicy.findUnique({ where: { id: BigInt(policyVersionId) } });
      if (!policy) throw new NotFoundError('Policy not found');

      const acceptance = await prisma.lateFeePolicyAcceptance.create({
        data: {
          policyId: BigInt(policyVersionId),
          patientId: patientId ? BigInt(patientId) : null,
          corporateClientId: corporateClientId ? BigInt(corporateClientId) : null,
          channel,
          acceptedBy: acceptedBy ? BigInt(acceptedBy) : null,
        },
      });

      await writeAudit({
        userNum: userId,
        permType: 999,
        patNum: patientId ? BigInt(patientId) : null,
        clinicNum: policy.clinicId,
        text: `Recorded late fee policy acceptance v${policy.version} via ${channel} for ${patientId ? 'patient' : 'corporate'} ${patientId ?? corporateClientId}`,
        source: 1,
      });

      res.status(201).json({
        success: true,
        data: {
          id: acceptance.id.toString(),
          policyId: acceptance.policyId.toString(),
          policyVersion: policy.version,
          patientId: acceptance.patientId?.toString() ?? null,
          corporateClientId: acceptance.corporateClientId?.toString() ?? null,
          channel: acceptance.channel,
          acceptedBy: acceptance.acceptedBy?.toString() ?? null,
          acceptedAt: acceptance.acceptedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getAcceptanceHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const patientId = BigInt(req.params.patientId);
      const acceptances = await prisma.lateFeePolicyAcceptance.findMany({
        where: { patientId },
        include: { policy: true },
        orderBy: { acceptedAt: 'desc' },
      });

      res.status(200).json({
        success: true,
        data: acceptances.map(a => ({
          id: a.id.toString(),
          policyVersion: a.policy.version,
          policyTerms: a.policy.termsText,
          acceptedAt: a.acceptedAt,
          channel: a.channel,
          acceptedBy: a.acceptedBy?.toString(),
        })),
      });
    } catch (error) {
      next(error);
    }
  }
}

export class LateFeeWaiverController {
  async waiveFee(req: Request, res: Response, next: NextFunction) {
    try {
      const applicationId = BigInt(req.params.applicationId);
      const { waivedAmount, reasonCode, reasonNote } = req.body;
      const userId = BigInt(req.userId!);

      const application = await prisma.lateFeeApplication.findUnique({
        where: { id: applicationId },
        include: { waivers: true },
      });
      if (!application) throw new NotFoundError('Late fee application not found');
      if (application.status !== 'applied') {
        throw new BadRequestError('Can only waive applied fees');
      }

      const totalWaived = application.waivers.reduce((sum, w) => sum + Number(w.waivedAmount), 0);
      if (Number(waivedAmount) + totalWaived > Number(application.feeAmount)) {
        throw new BadRequestError('Waiver amount exceeds fee amount');
      }

      const newTotalWaived = totalWaived + Number(waivedAmount);
      const feeAmount = Number(application.feeAmount);

      // Create the waiver record
      const waiver = await prisma.lateFeeWaiver.create({
        data: {
          applicationId,
          waivedAmount,
          reasonCode,
          reasonNote: reasonCode === 'OTHER' ? reasonNote : null,
          waivedBy: userId,
        },
      });

      // Determine new status: only fully waived when totalWaived >= feeAmount
      let newStatus: 'applied' | 'waived' = 'applied';
      if (newTotalWaived >= feeAmount) {
        newStatus = 'waived';
      }

      await prisma.lateFeeApplication.update({
        where: { id: applicationId },
        data: { status: newStatus },
      });

      await writeAudit({
        userNum: userId,
        permType: 999,
        patNum: application.patientId,
        clinicNum: application.clinicId,
        text: `Waived late fee $${Number(waivedAmount).toFixed(2)} on invoice ${application.invoiceId} (${reasonCode})`,
        source: 1,
      });

      res.status(201).json({
        success: true,
        data: {
          id: waiver.id.toString(),
          applicationId: waiver.applicationId.toString(),
          waivedAmount: Number(waiver.waivedAmount),
          reasonCode: waiver.reasonCode,
          reasonNote: waiver.reasonNote,
          waivedBy: waiver.waivedBy.toString(),
          waivedAt: waiver.waivedAt,
          newStatus,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getWaiverReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { staffId, from, to, reasonCode, page = 1, limit = 50 } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const where: any = {};
      if (staffId) where.waivedBy = BigInt(staffId as string);
      if (from) where.waivedAt = { ...where.waivedAt, gte: new Date(from as string) };
      if (to) where.waivedAt = { ...where.waivedAt, lte: new Date(to as string) };
      if (reasonCode) where.reasonCode = reasonCode;

      const [waivers, total] = await Promise.all([
        prisma.lateFeeWaiver.findMany({
          where,
          include: { application: { include: { policy: true } } },
          orderBy: { waivedAt: 'desc' },
          skip,
          take: Number(limit),
        }),
        prisma.lateFeeWaiver.count({ where }),
      ]);

      res.status(200).json({
        success: true,
        data: waivers.map(w => ({
          id: w.id.toString(),
          applicationId: w.applicationId.toString(),
          invoiceId: w.application.invoiceId.toString(),
          waivedAmount: Number(w.waivedAmount),
          reasonCode: w.reasonCode,
          reasonNote: w.reasonNote,
          waivedBy: w.waivedBy.toString(),
          waivedAt: w.waivedAt,
          policyVersion: w.application.policy.version,
        })),
        meta: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
      });
    } catch (error) {
      next(error);
    }
  }
}

/**
 * GET /late-fee/applications — list late-fee applications with patient names
 * and waiver state. Backs the admin "Late Fee Waivers" screen.
 */
export class LateFeeApplicationController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { patientId, clinicId, status, page = 1, limit = 50 } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const where: any = {};
      if (patientId) where.patientId = BigInt(patientId as string);
      if (clinicId) where.clinicId = BigInt(clinicId as string);
      if (status) where.status = status;

      const [applications, total] = await Promise.all([
        prisma.lateFeeApplication.findMany({
          where,
          include: {
            policy: { select: { version: true, termsText: true } },
            waivers: true,
          },
          orderBy: { appliedAt: 'desc' },
          skip,
          take: Number(limit),
        }),
        prisma.lateFeeApplication.count({ where }),
      ]);

      const patientIds = [...new Set(applications.map(a => a.patientId))];
      const patients = patientIds.length
        ? await prisma.patient.findMany({
            where: { PatNum: { in: patientIds } },
            select: { PatNum: true, FName: true, LName: true },
          })
        : [];
      const patientMap = new Map(patients.map(p => [p.PatNum, p]));

      res.status(200).json({
        success: true,
        data: applications.map(a => {
          const patient = patientMap.get(a.patientId);
          const totalWaived = a.waivers.reduce((sum, w) => sum + Number(w.waivedAmount), 0);
          return {
            id: a.id.toString(),
            invoiceId: a.invoiceId.toString(),
            policyId: a.policyId.toString(),
            patientId: a.patientId.toString(),
            clinicId: a.clinicId.toString(),
            patientName: patient ? `${patient.FName} ${patient.LName}`.trim() : null,
            feeAmount: Number(a.feeAmount),
            baseAmount: Number(a.baseAmount),
            feeType: a.feeType,
            status: a.status,
            skipReason: a.skipReason,
            appliedAt: a.appliedAt,
            periodStart: a.periodStart,
            periodEnd: a.periodEnd,
            originalInvoiceAmount: Number(a.originalInvoiceAmount),
            cumulativeFees: Number(a.cumulativeFees),
            policyVersion: a.policy?.version ?? null,
            policyTerms: a.policy?.termsText ?? null,
            totalWaived,
            waivers: a.waivers.map(w => ({
              id: w.id.toString(),
              waivedAmount: Number(w.waivedAmount),
              reasonCode: w.reasonCode,
              reasonNote: w.reasonNote,
              waivedBy: w.waivedBy.toString(),
              waivedAt: w.waivedAt,
            })),
          };
        }),
        meta: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
      });
    } catch (error) {
      next(error);
    }
  }
}

/**
 * POST /late-fee/run-job — manually trigger the daily late-fee job (admin /
 * testing). Same code path as the cron, same result shape.
 */
export class LateFeeJobController {
  async runJob(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = BigInt(req.userId!);
      const result = await lateFeeScheduler.runDailyJob(new Date());

      await writeAudit({
        userNum: userId,
        permType: 999,
        text: `Manually ran late-fee job: ${result.totalFeesApplied} applied, ${result.totalFeesSkipped} skipped, ${result.errors.length} errors`,
        source: 1,
      });

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

export const lateFeePolicyController = new LateFeePolicyController();
export const lateFeeAcceptanceController = new LateFeeAcceptanceController();
export const lateFeeWaiverController = new LateFeeWaiverController();
export const lateFeeApplicationController = new LateFeeApplicationController();
export const lateFeeJobController = new LateFeeJobController();