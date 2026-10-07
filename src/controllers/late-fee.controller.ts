import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { LateFeeGuardrails } from '../services/late-fee-guardrails.service';
import { writeAudit } from '../services/audit.service';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/error.util';

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

  async activatePolicy(req: Request, res: Response, next: NextFunction) {
    try {
      const clinicId = BigInt(req.params.clinicId);
      const version = BigInt(req.params.version);
      const userId = BigInt(req.userId!);

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
      patientFeeAmount: Number(p.patientFeeAmount) / 100,
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

      res.status(201).json({ success: true, data: acceptance });
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
        text: `Waived late fee $${(Number(waivedAmount) / 100).toFixed(2)} on invoice ${application.invoiceId} (${reasonCode})`,
        source: 1,
      });

      res.status(201).json({ success: true, data: waiver });
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
          waivedAmount: Number(w.waivedAmount) / 100,
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

export const lateFeePolicyController = new LateFeePolicyController();
export const lateFeeAcceptanceController = new LateFeeAcceptanceController();
export const lateFeeWaiverController = new LateFeeWaiverController();