import { prisma } from '../config/db';
import { NotFoundError, ConflictError, BadRequestError } from '../utils/error.util';
import { logActivity } from '../utils/activity-logger.util';
import { getNextId } from '../utils/opendental-ids.util';
import {
  mapInsuranceTypeToOrdinal,
  mapOrdinalToInsuranceType,
  mapRelationshipFromDb,
  mapRelationshipToDb,
} from '../utils/opendental-mappers.util';
import { getPatientInsuranceMeta, setPatientInsuranceMeta, getPatientInsurancesMeta } from '../utils/opendental-auth.util';
import { claimService } from './claim.service';

const safeBigInt = (val: any): bigint => {
  if (val === undefined || val === null || val === '') return 0n;
  const str = String(val).trim();
  if (str === 'null' || str === 'undefined' || str === 'none' || str === 'None') return 0n;
  try {
    return BigInt(str);
  } catch (e) {
    return 0n;
  }
};

export class PatientInsuranceService {
  /**
   * Get all insurances for a patient
   */
  async getPatientInsurances(patientId: string, isActive?: boolean) {
    const where: any = { PatNum: BigInt(patientId) };
    if (isActive !== undefined) {
      where.IsPending = isActive ? 0 : 1;
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
        subscriberDateOfBirth: meta?.subscriberDateOfBirth ?? null,
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
        planFeeGuide: (patplan.inssub?.insplan?.FeeSched && patplan.inssub.insplan.FeeSched !== 0n)
          ? patplan.inssub.insplan.FeeSched.toString()
          : (meta?.planFeeGuide ? String(meta.planFeeGuide) : null),
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
      where.IsPending = isActive ? 0 : 1;
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
        subscriberDateOfBirth: meta?.subscriberDateOfBirth ?? null,
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
        planFeeGuide: (patplan.inssub?.insplan?.FeeSched && patplan.inssub.insplan.FeeSched !== 0n)
          ? patplan.inssub.insplan.FeeSched.toString()
          : (meta?.planFeeGuide ? String(meta.planFeeGuide) : null),
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
      subscriberDateOfBirth: insuranceMeta.subscriberDateOfBirth ?? null,
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

      // Advanced Dentistry Fields
      deductiblesGrid: insuranceMeta.deductiblesGrid ?? [],
      coverageLimits: insuranceMeta.coverageLimits ?? null,
      coverageCategoryTable: insuranceMeta.coverageCategoryTable ?? [],
      coverageBookData: insuranceMeta.coverageBookData ?? [],
      planFeeGuide: (patplan.inssub?.insplan?.FeeSched && patplan.inssub.insplan.FeeSched !== 0n)
        ? patplan.inssub.insplan.FeeSched.toString()
        : (insuranceMeta.planFeeGuide ? String(insuranceMeta.planFeeGuide) : null),
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

    // Check if patient already has all three insurance types active
    const activePatPlans = await prisma.patplan.findMany({
      where: { PatNum: BigInt(patientId), IsPending: 0 },
    });

    const activeTypes = activePatPlans.map((plan) =>
      mapOrdinalToInsuranceType(plan.Ordinal || 1)
    );
    const allTypesPresent =
      activeTypes.includes('primary') &&
      activeTypes.includes('secondary') &&
      activeTypes.includes('tertiary');

    // Check if patient already has this specific insurance type active
    const existingInsuranceOfSameType = activePatPlans.find(
      (plan) => mapOrdinalToInsuranceType(plan.Ordinal || 1) === data.insuranceType.toLowerCase()
    );

    if (allTypesPresent && !existingInsuranceOfSameType) {
      throw new ConflictError(
        'Patient already has all three insurance types (Primary, Secondary, and Tertiary). ' +
        'Please deactivate an existing insurance before adding a new one, or update an existing insurance instead.'
      );
    }

    if (existingInsuranceOfSameType) {
      // Deactivate existing insurance of same type
      await prisma.patplan.update({
        where: { PatPlanNum: existingInsuranceOfSameType.PatPlanNum },
        data: { IsPending: 1 },
      });
    }

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

    if (existingInsSub) {
      // Intercept and use existing subscriber record
      insSubNum = existingInsSub.InsSubNum;
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
        },
      });

      await prisma.inssub.create({
        data: {
          InsSubNum: insSubNum,
          PlanNum: planNum,
          Subscriber: BigInt(patientId),
          SubscriberID: data.policyNumber,
          DateEffective: data.effectiveDate,
          DateTerm: data.expirationDate ?? null,
          SubscNote: data.notes ?? null,
        },
      });
    }

    await prisma.patplan.create({
      data: {
        PatPlanNum: patPlanNum,
        PatNum: BigInt(patientId),
        Ordinal: mapInsuranceTypeToOrdinal(data.insuranceType),
        IsPending: 0,
        Relationship: mapRelationshipToDb(data.relationshipToPatient),
        InsSubNum: insSubNum,
      },
    });

    await setPatientInsuranceMeta(patPlanNum, {
      subscriberName: data.subscriberName ?? null,
      subscriberDateOfBirth: data.subscriberDateOfBirth ?? null,
      copayAmount: data.copayAmount ?? null,
      deductibleAmount: data.deductibleAmount ?? null,
      autoVerify: data.autoVerify ?? true,
      verificationStatus: data.verificationStatus ?? 'pending',
      verificationDate: data.verificationDate ?? null,

      // Advanced Dentistry Fields
      deductiblesGrid: data.deductiblesGrid ?? [],
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

    return this.getPatientInsuranceById(patPlanNum.toString());
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

    // If changing insurance type, check for conflicts
    if (updates.insuranceType) {
      const existingInsurance = await prisma.patplan.findFirst({
        where: {
          PatNum: patplan.PatNum ?? undefined,
          Ordinal: mapInsuranceTypeToOrdinal(updates.insuranceType),
          IsPending: 0,
          PatPlanNum: { not: safeBigInt(patientInsuranceId) },
        },
      });

      if (existingInsurance) {
        throw new ConflictError(
          `Patient already has an active ${updates.insuranceType} insurance`
        );
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
          DateEffective: updates.effectiveDate ?? undefined,
          DateTerm: updates.expirationDate ?? undefined,
          SubscNote: updates.notes ?? undefined,
        },
      });
    }
    if (patplan.inssub?.insplan) {
      await prisma.insplan.update({
        where: { PlanNum: patplan.inssub.insplan.PlanNum },
        data: {
          CarrierNum: updates.insuranceCompanyId ? safeBigInt(updates.insuranceCompanyId) : undefined,
          GroupNum: updates.groupNumber ?? undefined,
          GroupName: updates.groupName ?? undefined,
          PlanNote: updates.notes ?? undefined,
          FeeSched: updates.planFeeGuide !== undefined ? (updates.planFeeGuide ? safeBigInt(updates.planFeeGuide) : 0n) : undefined,
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

    await setPatientInsuranceMeta(patplan.PatPlanNum, {
      subscriberName: updates.subscriberName ?? currentMeta.subscriberName ?? null,
      subscriberDateOfBirth:
        updates.subscriberDateOfBirth ?? currentMeta.subscriberDateOfBirth ?? null,
      copayAmount: updates.copayAmount ?? currentMeta.copayAmount ?? null,
      deductibleAmount:
        updates.deductibleAmount ?? currentMeta.deductibleAmount ?? null,
      autoVerify: updates.autoVerify ?? currentMeta.autoVerify ?? true,
      verificationStatus:
        updates.verificationStatus ?? currentMeta.verificationStatus ?? 'pending',
      verificationDate: updates.verificationDate ?? currentMeta.verificationDate ?? null,

      // Advanced Dentistry Fields
      deductiblesGrid: updates.deductiblesGrid ?? currentMeta.deductiblesGrid ?? [],
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

    // Hard delete
    await prisma.patplan.delete({
      where: { PatPlanNum: BigInt(patientInsuranceId) },
    });

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
}

export const patientInsuranceService = new PatientInsuranceService();
