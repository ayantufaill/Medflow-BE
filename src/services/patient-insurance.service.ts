import { prisma } from '../config/db';
import { NotFoundError, ConflictError, BadRequestError } from '../utils/error.util';
import { logActivity } from '../utils/activity-logger.util';
import { getNextId } from '../utils/opendental-ids.util';
import {
  formatDateOnly,
  mapInsuranceTypeToOrdinal,
  mapOrdinalToInsuranceType,
  mapRelationshipFromDb,
  mapRelationshipToDb,
} from '../utils/opendental-mappers.util';
import { getPatientInsuranceMeta, setPatientInsuranceMeta, getPatientInsurancesMeta } from '../utils/opendental-auth.util';
import { claimService } from './claim.service';
import { normalizeDeductibleRows, normalizeDeductibleGrid, deriveDeductibleAmount, resolveDeductibleTier } from './deductible.service';

const safeBigInt = (val: any): bigint => {
  if (typeof val === 'bigint') return val;
  if (typeof val === 'number') return BigInt(val);
  if (typeof val === 'string' && /^\d+$/.test(val)) return BigInt(val);
  return BigInt(0);
};

const toDbDate = (val?: Date | string | null): Date | null | undefined => {
  if (val === undefined) return undefined;
  if (val === null || val === '') return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return new Date(`${trimmed}T00:00:00.000Z`);
    }
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
};

const resolveValidFeeSchedNum = async (val: any): Promise<bigint | null> => {
  if (val === undefined || val === null || val === '') return null;
  const str = String(val).trim();
  if (str === 'null' || str === 'undefined' || str === 'none' || str === 'None' || str === '0') return null;
  let parsed: bigint;
  try {
    parsed = BigInt(str);
  } catch (e) {
    return null;
  }
  if (parsed === 0n) return null;
  const exists = await prisma.feesched.findUnique({
    where: { FeeSchedNum: parsed },
  });
  return exists ? parsed : null;
};

/**
 * Given a resolved fee schedule value and a coverage type string, returns
 * the correct FeeSched, AllowedFeeSched, and PlanType values to write on insplan.
 *
 * PPO plans (coverageType contains 'ppo'):
 *   - AllowedFeeSched = feeSchedVal  (drives automatic write-off in invoice service)
 *   - FeeSched        = null         (falls back to practice UCR for billed charge)
 *   - PlanType        = 'p'
 *
 * Capitation / Medicaid plans:
 *   - FeeSched        = feeSchedVal
 *   - AllowedFeeSched = null
 *   - PlanType        = 'c'
 *
 * All other plans (standard):
 *   - FeeSched        = feeSchedVal
 *   - AllowedFeeSched = null
 *   - PlanType        = ''
 */
function resolveFeeSchedFields(
  feeSchedVal: bigint | null,
  coverageType: string | undefined | null
): { FeeSched: bigint | null; AllowedFeeSched: bigint | null; PlanType: string } {
  const type = (coverageType ?? '').toLowerCase().trim();
  const isPPO = type.includes('ppo');
  const isCapitation = type.includes('capitation') || type.includes('medicaid');

  if (isPPO) {
    return { FeeSched: null, AllowedFeeSched: feeSchedVal, PlanType: 'p' };
  }
  if (isCapitation) {
    return { FeeSched: feeSchedVal, AllowedFeeSched: null, PlanType: 'c' };
  }
  return { FeeSched: feeSchedVal, AllowedFeeSched: null, PlanType: '' };
}

/**
 * Plan-year index for a date, anchored on the plan's renewal month.
 * With a July renewal, Jan-Jun 2026 still belongs to plan year 2025.
 */
const planYearOf = (date: Date, renewalMonth: number): number =>
  date.getFullYear() - (date.getMonth() + 1 < renewalMonth ? 1 : 0);

const parseMetaDate = (value: unknown): Date | null => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
};

export class PatientInsuranceService {
  /**
   * Apply a signed delta to each deductible row's `metAmount`.
   *
   * `metAmount` is what carries deductible state between separate claims, so
   * without this a second claim re-applies a deductible the patient already
   * satisfied. Deltas are signed: claim finalization reserves the estimated
   * amount, ERA posting reconciles it to the payer's actual amount, and
   * write-off reversal backs it out.
   *
   * Non-lifetime rows roll over when the date falls in a new plan year.
   */
  async applyDeductibleMetAmountDelta(
    patPlanNum: bigint,
    deltaByRow: Record<string, number>,
    appliedOn?: string | Date,
  ): Promise<void> {
    if (!patPlanNum || !deltaByRow || Object.keys(deltaByRow).length === 0) return;

    const meta: any = (await getPatientInsuranceMeta(patPlanNum)) || {};
    const grid = meta.deductiblesGrid;
    if (!Array.isArray(grid) || grid.length === 0) return;

    const rows = normalizeDeductibleRows(grid);
    if (rows.length === 0) return;

    const onDate = appliedOn ? parseMetaDate(appliedOn) ?? new Date() : new Date();
    const renewalMonth = Number(meta.renewalMonth) || 1;
    const onPlanYear = planYearOf(onDate, renewalMonth);
    const isoDate = onDate.toISOString().split('T')[0];

    const byKey = new Map(rows.map((row) => [row.typeKey, row]));
    let changed = false;

    for (const [key, rawDelta] of Object.entries(deltaByRow)) {
      const row = byKey.get(key);
      if (!row) continue;

      // Annual rows start fresh once the date lands in a new plan year.
      let metAmount = row.metAmount;
      if (!row.lifetime) {
        const metDate = parseMetaDate(row.metDate);
        if (metDate && planYearOf(metDate, renewalMonth) !== onPlanYear) {
          metAmount = 0;
        }
      }

      const limit = Math.max(row.individual, row.family);
      const next = limit > 0
        ? Math.min(limit, Math.max(0, metAmount + rawDelta))
        : Math.max(0, metAmount + rawDelta);

      if (next !== row.metAmount) changed = true;
      row.metAmount = next;
      if (next > 0 && !row.metDate) row.metDate = isoDate;
    }

    if (!changed) return;

    await setPatientInsuranceMeta(patPlanNum, {
      ...meta,
      deductiblesGrid: rows.map((row) => ({
        type: row.type,
        typeKey: row.typeKey,
        lifetime: row.lifetime,
        standard: row.standard,
        individual: row.individual,
        family: row.family,
        metAmount: row.metAmount,
        metDate: row.metDate,
      })),
    });
  }

  /**
   * Get all insurances for a patient
   */
  async getPatientInsurances(patientId: string, isActive?: boolean) {
    const where: any = { PatNum: BigInt(patientId) };
    if (isActive !== undefined) {
      if (isActive) {
        where.OR = [{ IsPending: 0 }, { IsPending: null }];
      } else {
        where.IsPending = 1;
      }
    }

    const patPlans = await prisma.patplan.findMany({
      where,
      include: {
        inssub: {
          include: {
            insplan: {
              include: {
                carrier: true,
              },
            },
          },
        },
      },
      orderBy: { Ordinal: 'asc' },
    });

    const patPlanNums = patPlans.map((p) => p.PatPlanNum);
    const metaMapData = await getPatientInsurancesMeta(patPlanNums);
    const metaMap = {
      get: (id: string) => metaMapData[id] || {}
    };

    const insSubNums = patPlans
      .map((p) => p.InsSubNum)
      .filter((num): num is bigint => num !== null && num !== undefined && num !== 0n);

    const sharingPlans = insSubNums.length > 0
      ? await prisma.patplan.findMany({
          where: { InsSubNum: { in: insSubNums } },
          include: {
            patient: {
              select: {
                FName: true,
                LName: true,
                PatNum: true,
              },
            },
          },
        })
      : [];

    const membersBySubNum = new Map<string, string[]>();
    for (const plan of sharingPlans) {
      if (!plan.InsSubNum || !plan.patient) continue;
      const subKey = plan.InsSubNum.toString();
      const name = [plan.patient.FName, plan.patient.LName].filter(Boolean).join(' ');
      if (!membersBySubNum.has(subKey)) {
        membersBySubNum.set(subKey, []);
      }
      membersBySubNum.get(subKey)!.push(name);
    }

    return patPlans.map((patplan) => {
      const meta = metaMap.get(patplan.PatPlanNum.toString());
      const subKey = patplan.InsSubNum ? patplan.InsSubNum.toString() : '';
      const members = subKey ? (membersBySubNum.get(subKey) ?? []) : [];
      const isFamilyPlan = members.length > 1;

      return {
        _id: patplan.PatPlanNum.toString(),
        patientId,
        insuranceCompanyId: patplan.inssub?.insplan?.carrier
          ? {
              _id: patplan.inssub.insplan.carrier.CarrierNum.toString(),
              name: patplan.inssub.insplan.carrier.CarrierName ?? '',
              payerId: patplan.inssub.insplan.carrier.ElectID ?? null,
            }
          : null,
        policyNumber: patplan.inssub?.SubscriberID ?? '',
        groupNumber: patplan.inssub?.insplan?.GroupNum ?? null,
        groupName: patplan.inssub?.insplan?.GroupName ?? null,
        subscriberName: meta?.subscriberName ?? '',
        subscriberDateOfBirth: formatDateOnly(meta?.subscriberDateOfBirth),
        relationshipToPatient: mapRelationshipFromDb(patplan.Relationship),
        insuranceType: mapOrdinalToInsuranceType(patplan.Ordinal),
        effectiveDate: patplan.inssub?.DateEffective ?? null,
        expirationDate: patplan.inssub?.DateTerm ?? null,
        copayAmount: meta?.copayAmount ?? null,
        deductibleAmount: meta?.deductibleAmount ?? null,
        autoVerify: meta?.autoVerify ?? true,
        verificationStatus: meta?.verificationStatus ?? 'pending',
        verificationDate: meta?.verificationDate ?? null,
        isActive: patplan.IsPending ? false : true,
        notes: patplan.inssub?.SubscNote ?? null,

        // Family Coverage Fields
        isFamilyPlan,
        members,
        patientsCovered: Math.max(members.length, 1),

        // Advanced Dentistry Fields
        deductiblesGrid: meta?.deductiblesGrid ?? [],
        coverageLimits: meta?.coverageLimits ?? null,
        coverageCategoryTable: meta?.coverageCategoryTable ?? [],
        coverageBookData: meta?.coverageBookData ?? [],
        planFeeGuide: (() => {
          const fsched = patplan.inssub?.insplan?.FeeSched;
          const allowed = patplan.inssub?.insplan?.AllowedFeeSched;
          const dbVal = (allowed && allowed !== 0n)
            ? allowed.toString()
            : (fsched && fsched !== 0n) ? fsched.toString() : null;
          return dbVal ?? (meta?.planFeeGuide ? String(meta.planFeeGuide) : null);
        })(),
        coverageType: meta?.coverageType ?? null,
        subscriberSsn: meta?.subscriberSsn ?? null,
        renewalMonth: meta?.renewalMonth ?? null,
        assignmentOfBenefits: meta?.assignmentOfBenefits ?? null,
        honorWriteOff: meta?.honorWriteOff ?? null,
        providersPlanFeeGuides: meta?.providersPlanFeeGuides ?? [],
        policyNotes: meta?.policyNotes ?? null,
        eligibilityPolicyNotes: meta?.eligibilityPolicyNotes ?? null,
        insurancePlanNotes: meta?.insurancePlanNotes ?? null,
        healthPlan: meta?.healthPlan ?? null,
        paymentPlan: meta?.paymentPlan ?? null,
      };
    });
  }

  /**
   * Get all insurances across all patients in the clinic
   */
  async getAllPatientInsurances(isActive?: boolean) {
    const where: any = {};
    if (isActive !== undefined) {
      if (isActive) {
        where.OR = [{ IsPending: 0 }, { IsPending: null }];
      } else {
        where.IsPending = 1;
      }
    }

    const patPlans = await prisma.patplan.findMany({
      where,
      include: {
        patient: {
          select: {
            PatNum: true,
            FName: true,
            LName: true,
          }
        },
        inssub: {
          include: {
            insplan: {
              include: {
                carrier: true,
              },
            },
          },
        },
      },
      orderBy: { Ordinal: 'asc' },
    });

    const patPlanNums = patPlans.map((p) => p.PatPlanNum);
    const metaMapData = await getPatientInsurancesMeta(patPlanNums);
    const metaMap = {
      get: (id: string) => metaMapData[id] || {}
    };

    const insSubNums = patPlans
      .map((p) => p.InsSubNum)
      .filter((num): num is bigint => num !== null && num !== undefined && num !== 0n);

    const sharingPlans = insSubNums.length > 0
      ? await prisma.patplan.findMany({
          where: { InsSubNum: { in: insSubNums } },
          include: {
            patient: {
              select: {
                FName: true,
                LName: true,
                PatNum: true,
              },
            },
          },
        })
      : [];

    const membersBySubNum = new Map<string, string[]>();
    for (const plan of sharingPlans) {
      if (!plan.InsSubNum || !plan.patient) continue;
      const subKey = plan.InsSubNum.toString();
      const name = [plan.patient.FName, plan.patient.LName].filter(Boolean).join(' ');
      if (!membersBySubNum.has(subKey)) {
        membersBySubNum.set(subKey, []);
      }
      membersBySubNum.get(subKey)!.push(name);
    }

    return patPlans.map((patplan) => {
      const meta = metaMap.get(patplan.PatPlanNum.toString());
      const subKey = patplan.InsSubNum ? patplan.InsSubNum.toString() : '';
      const members = subKey ? (membersBySubNum.get(subKey) ?? []) : [];
      const isFamilyPlan = members.length > 1;

      return {
        _id: patplan.PatPlanNum.toString(),
        patientId: patplan.PatNum?.toString() ?? '',
        patientName: patplan.patient ? `${patplan.patient.FName ?? ''} ${patplan.patient.LName ?? ''}`.trim() : '',
        insuranceCompanyId: patplan.inssub?.insplan?.carrier
          ? {
              _id: patplan.inssub.insplan.carrier.CarrierNum.toString(),
              name: patplan.inssub.insplan.carrier.CarrierName ?? '',
              payerId: patplan.inssub.insplan.carrier.ElectID ?? null,
            }
          : null,
        policyNumber: patplan.inssub?.SubscriberID ?? '',
        groupNumber: patplan.inssub?.insplan?.GroupNum ?? null,
        groupName: patplan.inssub?.insplan?.GroupName ?? null,
        subscriberName: meta?.subscriberName ?? '',
        subscriberDateOfBirth: formatDateOnly(meta?.subscriberDateOfBirth),
        relationshipToPatient: mapRelationshipFromDb(patplan.Relationship),
        insuranceType: mapOrdinalToInsuranceType(patplan.Ordinal),
        effectiveDate: patplan.inssub?.DateEffective ?? null,
        expirationDate: patplan.inssub?.DateTerm ?? null,
        copayAmount: meta?.copayAmount ?? null,
        deductibleAmount: meta?.deductibleAmount ?? null,
        autoVerify: meta?.autoVerify ?? true,
        verificationStatus: meta?.verificationStatus ?? 'pending',
        verificationDate: meta?.verificationDate ?? null,
        isActive: patplan.IsPending ? false : true,
        notes: patplan.inssub?.SubscNote ?? null,

        // Family Coverage Fields
        isFamilyPlan,
        members,

        // Advanced Dentistry Fields
        deductiblesGrid: meta?.deductiblesGrid ?? [],
        coverageLimits: meta?.coverageLimits ?? null,
        coverageCategoryTable: meta?.coverageCategoryTable ?? [],
        coverageBookData: meta?.coverageBookData ?? [],
        planFeeGuide: (() => {
          const fsched = patplan.inssub?.insplan?.FeeSched;
          const allowed = patplan.inssub?.insplan?.AllowedFeeSched;
          const dbVal = (allowed && allowed !== 0n)
            ? allowed.toString()
            : (fsched && fsched !== 0n) ? fsched.toString() : null;
          return dbVal ?? (meta?.planFeeGuide ? String(meta.planFeeGuide) : null);
        })(),
        coverageType: meta?.coverageType ?? null,
        subscriberSsn: meta?.subscriberSsn ?? null,
        renewalMonth: meta?.renewalMonth ?? null,
        assignmentOfBenefits: meta?.assignmentOfBenefits ?? null,
        honorWriteOff: meta?.honorWriteOff ?? null,
        providersPlanFeeGuides: meta?.providersPlanFeeGuides ?? [],
        policyNotes: meta?.policyNotes ?? null,
        eligibilityPolicyNotes: meta?.eligibilityPolicyNotes ?? null,
        insurancePlanNotes: meta?.insurancePlanNotes ?? null,
        healthPlan: meta?.healthPlan ?? null,
        paymentPlan: meta?.paymentPlan ?? null,
      };
    });
  }

  /**
   * Get patient insurance by ID
   */
  async getPatientInsuranceById(patientInsuranceId: string) {
    const patplan = await prisma.patplan.findUnique({
      where: { PatPlanNum: BigInt(patientInsuranceId) },
      include: {
        inssub: {
          include: {
            insplan: {
              include: {
                carrier: true,
              },
            },
          },
        },
      },
    });

    if (!patplan) {
      throw new NotFoundError('Patient insurance not found');
    }

    const insuranceMeta = await getPatientInsuranceMeta(patplan.PatPlanNum);

    // Fetch family members if there's an InsSubNum
    let members: string[] = [];
    if (patplan.InsSubNum && patplan.InsSubNum !== 0n) {
      const familyPlans = await prisma.patplan.findMany({
        where: { InsSubNum: patplan.InsSubNum },
        include: {
          patient: {
            select: {
              FName: true,
              LName: true,
            },
          },
        },
      });
      members = familyPlans
        .map((p) => [p.patient?.FName, p.patient?.LName].filter(Boolean).join(' '))
        .filter(Boolean);
    }
    const isFamilyPlan = members.length > 1;

    return {
      _id: patplan.PatPlanNum.toString(),
      patientId: patplan.PatNum?.toString() ?? '',
      insuranceCompanyId: patplan.inssub?.insplan?.carrier
        ? {
            _id: patplan.inssub.insplan.carrier.CarrierNum.toString(),
            name: patplan.inssub.insplan.carrier.CarrierName ?? '',
            payerId: patplan.inssub.insplan.carrier.ElectID ?? null,
          }
        : null,
      policyNumber: patplan.inssub?.SubscriberID ?? '',
      groupNumber: patplan.inssub?.insplan?.GroupNum ?? null,
      groupName: patplan.inssub?.insplan?.GroupName ?? null,
      subscriberName: insuranceMeta.subscriberName ?? '',
      subscriberDateOfBirth: formatDateOnly(insuranceMeta.subscriberDateOfBirth),
      relationshipToPatient: mapRelationshipFromDb(patplan.Relationship),
      insuranceType: mapOrdinalToInsuranceType(patplan.Ordinal),
      effectiveDate: patplan.inssub?.DateEffective ?? null,
      expirationDate: patplan.inssub?.DateTerm ?? null,
      copayAmount: insuranceMeta.copayAmount ?? null,
      deductibleAmount: insuranceMeta.deductibleAmount ?? null,
      autoVerify: insuranceMeta.autoVerify ?? true,
      verificationStatus: insuranceMeta.verificationStatus ?? 'pending',
      verificationDate: insuranceMeta.verificationDate ?? null,
      isActive: patplan.IsPending ? false : true,
      notes: patplan.inssub?.SubscNote ?? null,

      // Family Coverage Fields
      isFamilyPlan,
      members,
      patientsCovered: Math.max(members.length, 1),

      // Advanced Dentistry Fields
      deductiblesGrid: insuranceMeta.deductiblesGrid ?? [],
      coverageLimits: insuranceMeta.coverageLimits ?? null,
      coverageCategoryTable: insuranceMeta.coverageCategoryTable ?? [],
      coverageBookData: insuranceMeta.coverageBookData ?? [],
      planFeeGuide: (() => {
        const fsched = patplan.inssub?.insplan?.FeeSched;
        const allowed = patplan.inssub?.insplan?.AllowedFeeSched;
        const dbVal = (allowed && allowed !== 0n)
          ? allowed.toString()
          : (fsched && fsched !== 0n) ? fsched.toString() : null;
        return dbVal ?? (insuranceMeta.planFeeGuide ? String(insuranceMeta.planFeeGuide) : null);
      })(),
      coverageType: insuranceMeta.coverageType ?? null,
      subscriberSsn: insuranceMeta.subscriberSsn ?? null,
      renewalMonth: insuranceMeta.renewalMonth ?? null,
      assignmentOfBenefits: insuranceMeta.assignmentOfBenefits ?? null,
      honorWriteOff: insuranceMeta.honorWriteOff ?? null,
      providersPlanFeeGuides: insuranceMeta.providersPlanFeeGuides ?? [],
      policyNotes: insuranceMeta.policyNotes ?? null,
      eligibilityPolicyNotes: insuranceMeta.eligibilityPolicyNotes ?? null,
      insurancePlanNotes: insuranceMeta.insurancePlanNotes ?? null,
      healthPlan: insuranceMeta.healthPlan ?? null,
      paymentPlan: insuranceMeta.paymentPlan ?? null,
    };
  }

  /**
   * Create patient insurance
   */
  async createPatientInsurance(
    patientId: string,
    data: {
      insuranceCompanyId: string;
      payerId?: string;
      policyNumber: string;
      groupNumber?: string;
      groupName?: string;
      subscriberName: string;
      subscriberDateOfBirth: Date;
      relationshipToPatient: string;
      insuranceType: string;
      effectiveDate: Date;
      expirationDate?: Date;
      copayAmount?: number;
      deductibleAmount?: number;
      autoVerify?: boolean;
      verificationStatus?: string;
      verificationDate?: Date;
      notes?: string;

      // Advanced Dentistry Fields
      deductiblesGrid?: Array<any>;
      coverageLimits?: any;
      coverageCategoryTable?: Array<any>;
      coverageBookData?: Array<any>;
      planFeeGuide?: string;
      coverageType?: string;
      subscriberSsn?: string;
      renewalMonth?: number;
      assignmentOfBenefits?: string;
      honorWriteOff?: boolean;
      providersPlanFeeGuides?: Array<any>;
      policyNotes?: string;
      eligibilityPolicyNotes?: string;
      insurancePlanNotes?: string;
      healthPlan?: any;
      paymentPlan?: any;
    },
    createdBy?: string
  ) {
    // Verify patient exists
    const patient = await prisma.patient.findUnique({
      where: { PatNum: BigInt(patientId) },
    });
    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    // Verify insurance company exists
    const insuranceCompany = await prisma.carrier.findUnique({
      where: { CarrierNum: BigInt(data.insuranceCompanyId) },
    });
    if (!insuranceCompany) {
      throw new NotFoundError('Insurance company not found');
    }

    // Calculate maxOrdinal for existing active plans and assign next available ordinal
    const activePatPlans = await prisma.patplan.findMany({
      where: {
        PatNum: BigInt(patientId),
        OR: [{ IsPending: 0 }, { IsPending: null }],
      },
      select: { Ordinal: true },
    });
    const maxOrdinal = activePatPlans.reduce((max, plan) => Math.max(max, plan.Ordinal || 0), 0);
    const nextOrdinal = maxOrdinal + 1;

    const patPlanNum = await getNextId('patplan', 'PatPlanNum');

    if (data.payerId !== undefined) {
      try {
        await prisma.carrier.update({
          where: { CarrierNum: BigInt(data.insuranceCompanyId) },
          data: { ElectID: data.payerId || null },
        });
      } catch (err: any) {
        if (err.code === 'P2002') {
          throw new BadRequestError('The Payer ID provided is already in use by another insurance carrier.');
        }
        throw err;
      }
    }

    // Smart Link: Check if a policy with exact Policy Number and Insurance Company exists
    const existingInsSub = await prisma.inssub.findFirst({
      where: {
        SubscriberID: data.policyNumber,
        insplan: {
          CarrierNum: BigInt(data.insuranceCompanyId),
        },
      },
    });

    let insSubNum: bigint;

    // Resolve fee schedule fields once — used in both the new-plan and Smart Link paths
    const feeSchedVal = await resolveValidFeeSchedNum(data.planFeeGuide);
    const feeSchedFields = resolveFeeSchedFields(feeSchedVal, data.coverageType);

    if (existingInsSub) {
      // Smart Link: reuse existing subscriber record but patch the shared insplan
      // with the correct PPO/standard fee schedule fields so write-offs work correctly.
      insSubNum = existingInsSub.InsSubNum;
      if (existingInsSub.PlanNum) {
        await prisma.insplan.update({
          where: { PlanNum: existingInsSub.PlanNum },
          data: {
            FeeSched: feeSchedFields.FeeSched ?? undefined,
            AllowedFeeSched: feeSchedFields.AllowedFeeSched ?? undefined,
            PlanType: feeSchedFields.PlanType,
          },
        });
      }
    } else {
      const planNum = await getNextId('insplan', 'PlanNum');
      insSubNum = await getNextId('inssub', 'InsSubNum');

      await prisma.insplan.create({
        data: {
          PlanNum: planNum,
          CarrierNum: BigInt(data.insuranceCompanyId),
          GroupNum: data.groupNumber ?? null,
          GroupName: data.groupName ?? null,
          PlanNote: data.notes ?? null,
          IsHidden: 0,
          FeeSched: feeSchedFields.FeeSched,
          AllowedFeeSched: feeSchedFields.AllowedFeeSched,
          PlanType: feeSchedFields.PlanType,
        },
      });

      await prisma.inssub.create({
        data: {
          InsSubNum: insSubNum,
          PlanNum: planNum,
          Subscriber: BigInt(patientId),
          SubscriberID: data.policyNumber,
          DateEffective: toDbDate(data.effectiveDate) ?? null,
          DateTerm: toDbDate(data.expirationDate) ?? null,
          SubscNote: data.notes ?? null,
        },
      });
    }

    await prisma.patplan.create({
      data: {
        PatPlanNum: patPlanNum,
        PatNum: BigInt(patientId),
        Ordinal: nextOrdinal,
        IsPending: 0,
        Relationship: mapRelationshipToDb(data.relationshipToPatient),
        InsSubNum: insSubNum,
      },
    });

    // Normalize the grid server-side: derive `typeKey` so the deductible engine
    // can resolve rows without trusting the client-only `isCodeRow` flag, and
    // derive the legacy scalar from the Standard row rather than row[0]
    // (which silently became 0 whenever the first row was blank).
    const normalizedGrid = normalizeDeductibleGrid(data.deductiblesGrid);
    const deductibleTier = resolveDeductibleTier({
      relationship: data.relationshipToPatient,
      patientsCovered: (data as any).patientsCovered,
    });

    await setPatientInsuranceMeta(patPlanNum, {
      subscriberName: data.subscriberName ?? null,
      subscriberDateOfBirth: formatDateOnly(data.subscriberDateOfBirth),
      copayAmount: data.copayAmount ?? null,
      deductibleAmount: deriveDeductibleAmount(normalizedGrid, deductibleTier),
      autoVerify: data.autoVerify ?? true,
      verificationStatus: data.verificationStatus ?? 'pending',
      verificationDate: data.verificationDate ?? null,

      // Advanced Dentistry Fields
      deductiblesGrid: normalizedGrid,
      coverageLimits: data.coverageLimits ?? null,
      coverageCategoryTable: data.coverageCategoryTable ?? [],
      coverageBookData: data.coverageBookData ?? [],
      planFeeGuide: data.planFeeGuide ?? null,
      coverageType: data.coverageType ?? null,
      subscriberSsn: data.subscriberSsn ?? null,
      renewalMonth: data.renewalMonth ?? null,
      assignmentOfBenefits: data.assignmentOfBenefits ?? null,
      honorWriteOff: data.honorWriteOff ?? null,
      providersPlanFeeGuides: data.providersPlanFeeGuides ?? [],
      policyNotes: data.policyNotes ?? null,
      eligibilityPolicyNotes: data.eligibilityPolicyNotes ?? null,
      insurancePlanNotes: data.insurancePlanNotes ?? null,
      healthPlan: data.healthPlan ?? null,
      paymentPlan: data.paymentPlan ?? null,
    });

    // Log activity
    if (createdBy) {
      await logActivity(
        createdBy,
        'created',
        'patient_insurance',
        patPlanNum.toString(),
        undefined,
        { patientId, insuranceType: data.insuranceType, policyNumber: data.policyNumber },
        undefined,
        undefined,
        'low'
      );
    }

    // Generate draft claims asynchronously for unbilled invoices using the newly added insurance
    Promise.resolve().then(async () => {
      try {
        await claimService.generateUnsentClaimsForPatient(
          patientId,
          data.insuranceCompanyId,
          data.insuranceType,
          createdBy
        );
      } catch (err) {
        console.error('Failed to generate unsent claims for patient after insurance creation:', err);
      }
    });

    // Recalculate open invoices asynchronously to reflect any new secondary portions
    Promise.resolve().then(async () => {
      try {
        const { invoiceService } = await import('./invoice.service');
        const openInvoices = await prisma.statement.findMany({
          where: { PatNum: BigInt(patientId), IsInvoice: 1, BalTotal: { gt: 0 } },
          select: { StatementNum: true }
        });
        for (const inv of openInvoices) {
          await invoiceService.recalculateInvoice(inv.StatementNum.toString()).catch(() => {});
        }
      } catch (err) {
        console.error('Failed to recalculate invoices after insurance creation:', err);
      }
    });

    this.reEvaluateCoverageOrder(patientId, 'COVERAGE_ADDED', createdBy);

    return this.getPatientInsuranceById(patPlanNum.toString());
  }


  /**
   * Re-runs the coordination-of-benefits pipeline after a coverage change.
   *
   * WHY THIS IS FIRE-AND-FORGET
   * ---------------------------
   * Adding a coverage must not fail because the COB pipeline hit bad data on
   * some other coverage the patient holds. The order going stale is visible
   * and fixable from the COB screen; a front desk unable to save an insurance
   * card is not. The other async blocks in this file (claim generation,
   * invoice recalculation) are detached for the same reason.
   *
   * The pipeline keeps a staff override if one exists and raises
   * COVERAGE_CHANGED, so a human decision is never silently discarded here.
   */
  private reEvaluateCoverageOrder(
    patientId: string,
    triggerReason: string,
    userId?: string
  ): void {
    Promise.resolve().then(async () => {
      try {
        const { cobService } = await import('./cob/cob.service');
        await cobService.evaluateAndSave(patientId, {
          triggerReason,
          userNum: userId ? BigInt(userId) : null,
          // Record the suggestion, but do NOT touch patplan.Ordinal. This
          // runs detached, so it can complete after a staff reorder and would
          // silently revert the order a human just set. Ordinal stays owned by
          // this service's own create/reorder/resequence paths.
          writeOrdinals: false,
        });
      } catch (err) {
        console.error(
          `Failed to re-evaluate COB coverage order for patient ${patientId} (${triggerReason}):`,
          err
        );
      }
    });
  }

  /**
   * Update patient insurance
   */
  async updatePatientInsurance(
    patientId: string,
    patientInsuranceId: string,
    updates: {
      insuranceCompanyId?: string;
      payerId?: string;
      policyNumber?: string;
      groupNumber?: string;
      groupName?: string;
      subscriberName?: string;
      subscriberDateOfBirth?: Date;
      relationshipToPatient?: string;
      insuranceType?: string;
      effectiveDate?: Date;
      expirationDate?: Date;
      copayAmount?: number;
      deductibleAmount?: number;
      isActive?: boolean;
      autoVerify?: boolean;
      verificationStatus?: string;
      verificationDate?: Date;
      notes?: string;

      // Advanced Dentistry Fields
      deductiblesGrid?: Array<any>;
      coverageLimits?: any;
      coverageCategoryTable?: Array<any>;
      coverageBookData?: Array<any>;
      planFeeGuide?: string;
      coverageType?: string;
      subscriberSsn?: string;
      renewalMonth?: number;
      assignmentOfBenefits?: string;
      honorWriteOff?: boolean;
      providersPlanFeeGuides?: Array<any>;
      policyNotes?: string;
      eligibilityPolicyNotes?: string;
      insurancePlanNotes?: string;
      healthPlan?: any;
      paymentPlan?: any;
    },
    updatedBy?: string
  ) {
    const patplan = await prisma.patplan.findUnique({
      where: { PatPlanNum: BigInt(patientInsuranceId) },
      include: { inssub: { include: { insplan: true } } },
    });
    if (!patplan) {
      throw new NotFoundError('Patient insurance not found');
    }
    if (patplan.PatNum?.toString() !== patientId) {
  throw new NotFoundError('Insurance record does not belong to this patient');
}

    if (updates.insuranceCompanyId) {
      const insuranceCompany = await prisma.carrier.findUnique({
        where: { CarrierNum: BigInt(updates.insuranceCompanyId) },
      });
      if (!insuranceCompany) {
        throw new NotFoundError('Insurance company not found');
      }
    }


    const oldValues = {
      policyNumber: patplan.inssub?.SubscriberID,
      insuranceType: mapOrdinalToInsuranceType(patplan.Ordinal),
      isActive: patplan.IsPending ? false : true,
    };
    const currentMeta = await getPatientInsuranceMeta(patplan.PatPlanNum);

    if (patplan.inssub) {
      await prisma.inssub.update({
        where: { InsSubNum: patplan.inssub.InsSubNum },
        data: {
          SubscriberID: updates.policyNumber ?? undefined,
          DateEffective: toDbDate(updates.effectiveDate),
          DateTerm: toDbDate(updates.expirationDate),
          SubscNote: updates.notes ?? undefined,
        },
      });
    }
    if (patplan.inssub?.insplan) {
      // Determine whether fee-schedule-related fields need to be updated.
      // We recalculate whenever the caller changes either planFeeGuide OR coverageType,
      // because changing the coverage type alone should re-route an existing fee schedule.
      let updatedFeeSchedFields:
        | { FeeSched: bigint | null; AllowedFeeSched: bigint | null; PlanType: string }
        | undefined;

      if (updates.planFeeGuide !== undefined || updates.coverageType !== undefined) {
        const effectiveCoverageType = updates.coverageType ?? currentMeta.coverageType;
        const rawFeeGuide =
          updates.planFeeGuide !== undefined
            ? updates.planFeeGuide
            : currentMeta.planFeeGuide;
        const feeSchedVal = await resolveValidFeeSchedNum(rawFeeGuide);
        updatedFeeSchedFields = resolveFeeSchedFields(feeSchedVal, effectiveCoverageType);
      }

      await prisma.insplan.update({
        where: { PlanNum: patplan.inssub.insplan.PlanNum },
        data: {
          CarrierNum: updates.insuranceCompanyId ? safeBigInt(updates.insuranceCompanyId) : undefined,
          GroupNum: updates.groupNumber ?? undefined,
          GroupName: updates.groupName ?? undefined,
          PlanNote: updates.notes ?? undefined,
          // Only spread fee schedule fields when the caller changed planFeeGuide or coverageType
          ...(updatedFeeSchedFields !== undefined
            ? {
                FeeSched: updatedFeeSchedFields.FeeSched,
                AllowedFeeSched: updatedFeeSchedFields.AllowedFeeSched,
                PlanType: updatedFeeSchedFields.PlanType,
              }
            : {}),
        },
      });
    }

    if (updates.payerId !== undefined) {
      const carrierId = updates.insuranceCompanyId ? safeBigInt(updates.insuranceCompanyId) : patplan.inssub?.insplan?.CarrierNum;
      if (carrierId) {
        try {
          await prisma.carrier.update({
            where: { CarrierNum: carrierId },
            data: { ElectID: updates.payerId || null },
          });
        } catch (err: any) {
          if (err.code === 'P2002') {
            throw new BadRequestError('The Payer ID provided is already in use by another insurance carrier.');
          }
          throw err;
        }
      }
    }
    await prisma.patplan.update({
      where: { PatPlanNum: safeBigInt(patientInsuranceId) },
      data: {
        Ordinal: updates.insuranceType ? mapInsuranceTypeToOrdinal(updates.insuranceType) : undefined,
        IsPending: updates.isActive !== undefined ? (updates.isActive ? 0 : 1) : undefined,
        Relationship:
          updates.relationshipToPatient !== undefined
            ? mapRelationshipToDb(updates.relationshipToPatient)
            : undefined,
      },
    });

    if (updates.isActive !== undefined) {
      await this.resequenceActiveInsurances(patientId);
    }

    // Derive typeKey / amounts server-side and recompute the legacy scalar from
    // the Standard row. Preserves `metAmount` for rows the client did not send.
    const updatedGrid = normalizeDeductibleGrid(
      updates.deductiblesGrid ?? currentMeta.deductiblesGrid ?? [],
    );
    const preservedMet = new Map(
      normalizeDeductibleRows(currentMeta.deductiblesGrid).map((r) => [r.typeKey, r]),
    );
    for (const row of updatedGrid) {
      const prev = preservedMet.get(row.typeKey);
      if (prev && (row.metAmount ?? 0) === 0 && (prev.metAmount ?? 0) > 0) {
        row.metAmount = prev.metAmount;
        row.metDate = prev.metDate;
      }
    }
    const updateTier = resolveDeductibleTier({
      relationship: updates.relationshipToPatient,
      patientsCovered: (updates as any).patientsCovered,
    });

    await setPatientInsuranceMeta(patplan.PatPlanNum, {
      subscriberName: updates.subscriberName ?? currentMeta.subscriberName ?? null,
      subscriberDateOfBirth:
        updates.subscriberDateOfBirth !== undefined
          ? formatDateOnly(updates.subscriberDateOfBirth)
          : formatDateOnly(currentMeta.subscriberDateOfBirth),
      copayAmount: updates.copayAmount ?? currentMeta.copayAmount ?? null,
      deductibleAmount: deriveDeductibleAmount(updatedGrid, updateTier),
      autoVerify: updates.autoVerify ?? currentMeta.autoVerify ?? true,
      verificationStatus:
        updates.verificationStatus ?? currentMeta.verificationStatus ?? 'pending',
      verificationDate: updates.verificationDate ?? currentMeta.verificationDate ?? null,

      // Advanced Dentistry Fields
      deductiblesGrid: updatedGrid,
      coverageLimits: updates.coverageLimits ?? currentMeta.coverageLimits ?? null,
      coverageCategoryTable: updates.coverageCategoryTable ?? currentMeta.coverageCategoryTable ?? [],
      coverageBookData: updates.coverageBookData ?? currentMeta.coverageBookData ?? [],
      planFeeGuide: updates.planFeeGuide ?? currentMeta.planFeeGuide ?? null,
      coverageType: updates.coverageType ?? currentMeta.coverageType ?? null,
      subscriberSsn: updates.subscriberSsn ?? currentMeta.subscriberSsn ?? null,
      renewalMonth: updates.renewalMonth ?? currentMeta.renewalMonth ?? null,
      assignmentOfBenefits: updates.assignmentOfBenefits ?? currentMeta.assignmentOfBenefits ?? null,
      honorWriteOff: updates.honorWriteOff ?? currentMeta.honorWriteOff ?? null,
      providersPlanFeeGuides: updates.providersPlanFeeGuides ?? currentMeta.providersPlanFeeGuides ?? [],
      policyNotes: updates.policyNotes ?? currentMeta.policyNotes ?? null,
      eligibilityPolicyNotes: updates.eligibilityPolicyNotes ?? currentMeta.eligibilityPolicyNotes ?? null,
      insurancePlanNotes: updates.insurancePlanNotes ?? currentMeta.insurancePlanNotes ?? null,
      healthPlan: updates.healthPlan ?? currentMeta.healthPlan ?? null,
      paymentPlan: updates.paymentPlan ?? currentMeta.paymentPlan ?? null,
    });

    // Log activity
    if (updatedBy) {
      await logActivity(
        updatedBy,
        'updated',
        'patient_insurance',
        patientInsuranceId,
        oldValues,
        updates,
        undefined,
        undefined,
        'low'
      );
    }

    this.reEvaluateCoverageOrder(patientId, 'COVERAGE_EDITED', updatedBy);

    return this.getPatientInsuranceById(patientInsuranceId);
  }

  /**
   * Delete patient insurance (soft delete)
   */
  async deletePatientInsurance(patientId: string,patientInsuranceId: string, deletedBy?: string) {
    const patplan = await prisma.patplan.findUnique({
      where: { PatPlanNum: BigInt(patientInsuranceId) },
    });
    if (!patplan) {
      throw new NotFoundError('Patient insurance not found');
    }
    if (patplan.PatNum?.toString() !== patientId) {
    throw new NotFoundError('Insurance record does not belong to this patient');
  }

    // COB facts for this coverage go with it.
    //
    // cob_coverage_detail is keyed by PatPlanNum and, following the
    // app-native convention in this schema (patient_branch_grant,
    // access_audit), carries no foreign key — so nothing in the database
    // removes it when the patplan row is hard-deleted below. Left behind, it
    // would be inherited by any future patplan that reuses the number, and
    // the rule engine would silently read another patient's employer size,
    // Medicare entitlement reason or custody arrangement.
    //
    // Coverage ORDERS are deliberately NOT deleted: they are the versioned,
    // audited record of what we decided and billed, and they have to outlive
    // the coverage. Their positions simply point at a patplan that is gone,
    // which is what a historical record of a terminated policy looks like.
    await prisma.cob_coverage_detail.deleteMany({
      where: { patplan_num: BigInt(patientInsuranceId) },
    });

    // Hard delete
    await prisma.patplan.delete({
      where: { PatPlanNum: BigInt(patientInsuranceId) },
    });

    // Auto-resequence remaining active coverages
    await this.resequenceActiveInsurances(patientId);

    // Log activity
    if (deletedBy) {
      await logActivity(
        deletedBy,
        'deleted',
        'patient_insurance',
        patientInsuranceId,
        { patientId: patplan.PatNum?.toString() }, // before
        null,                 // after (deleted)
        undefined,
        undefined,
        'medium'
      );
    }

    this.reEvaluateCoverageOrder(patientId, 'COVERAGE_TERMINATED', deletedBy);

    return { message: 'Patient insurance deleted successfully' };
  }
  /**
 * Set a specific insurance as primary using a transaction
 */
async setPrimaryInsurance(patientId: string, patientInsuranceId: string) {
  // Verify the insurance record exists and belongs to this patient
  const patplan = await prisma.patplan.findUnique({
    where: { PatPlanNum: BigInt(patientInsuranceId) },
  });

  if (!patplan) {
    throw new NotFoundError('Patient insurance not found');
  }

  if (patplan.PatNum?.toString() !== patientId) {
    throw new NotFoundError('Insurance record does not belong to this patient');
  }

  // Atomic transaction — set all to non-primary, then set target to primary
  await prisma.$transaction(async (tx) => {
    // Step 1 — set all patient insurances to non-primary (Ordinal >= 2)
    const allPatPlans = await tx.patplan.findMany({
      where: { PatNum: BigInt(patientId) },
    });

    for (const plan of allPatPlans) {
      const currentOrdinal = plan.Ordinal ?? 1;
      // If it's currently primary (ordinal 1), bump it to secondary (ordinal 2)
      if (currentOrdinal === 1 && plan.PatPlanNum !== BigInt(patientInsuranceId)) {
        await tx.patplan.update({
          where: { PatPlanNum: plan.PatPlanNum },
          data: { Ordinal: 2 },
        });
      }
    }

    // Step 2 — set the target insurance as primary (Ordinal = 1)
    await tx.patplan.update({
      where: { PatPlanNum: BigInt(patientInsuranceId) },
      data: { Ordinal: 1 },
    });
  });

  return this.getPatientInsuranceById(patientInsuranceId);
}

  /**
   * Reorder patient insurances atomically
   */
  async reorderInsurances(patientId: string, orderedInsuranceIds: string[]) {
    const bigIntIds = orderedInsuranceIds.map((id) => BigInt(id));
    const patplans = await prisma.patplan.findMany({
      where: {
        PatPlanNum: { in: bigIntIds },
        PatNum: BigInt(patientId),
      },
    });

    if (patplans.length !== orderedInsuranceIds.length) {
      throw new NotFoundError(
        'One or more insurance records not found or do not belong to this patient'
      );
    }

    await prisma.$transaction(async (tx) => {
      // Step A: Set to temporary high ordinals to prevent constraint errors
      for (let i = 0; i < patplans.length; i++) {
        await tx.patplan.update({
          where: { PatPlanNum: patplans[i].PatPlanNum },
          data: { Ordinal: 10 + i },
        });
      }

      // Step B: Set to final ordinals based on the payload order (1, 2, 3...)
      for (let i = 0; i < orderedInsuranceIds.length; i++) {
        const id = BigInt(orderedInsuranceIds[i]);
        await tx.patplan.update({
          where: { PatPlanNum: id },
          data: { Ordinal: i + 1 },
        });
      }
    });

    return this.getPatientInsurances(patientId);
  }

  /**
   * Recalculate ordinal sequence for active coverages to close any gaps (1, 2, 3...)
   */
  private async resequenceActiveInsurances(patientId: string) {
    const activePlans = await prisma.patplan.findMany({
      where: {
        PatNum: BigInt(patientId),
        OR: [{ IsPending: 0 }, { IsPending: null }],
      },
      orderBy: { Ordinal: 'asc' },
    });

    if (activePlans.length === 0) return;

    await prisma.$transaction(async (tx) => {
      // Step A: Shift to temporary high ordinals to prevent constraint conflicts
      for (let i = 0; i < activePlans.length; i++) {
        await tx.patplan.update({
          where: { PatPlanNum: activePlans[i].PatPlanNum },
          data: { Ordinal: 1000 + i },
        });
      }
      // Step B: Set final sequential ordinals starting from 1
      for (let i = 0; i < activePlans.length; i++) {
        await tx.patplan.update({
          where: { PatPlanNum: activePlans[i].PatPlanNum },
          data: { Ordinal: i + 1 },
        });
      }
    });
  }
}

export const patientInsuranceService = new PatientInsuranceService();
