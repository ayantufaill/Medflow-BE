import { prisma } from '../config/db';
import { NotFoundError, ConflictError } from '../utils/error.util';
import { logActivity } from '../utils/activity-logger.util';
import { getNextId } from '../utils/opendental-ids.util';
import {
  mapInsuranceTypeToOrdinal,
  mapOrdinalToInsuranceType,
  mapRelationshipFromDb,
  mapRelationshipToDb,
} from '../utils/opendental-mappers.util';
import { getPatientInsuranceMeta, setPatientInsuranceMeta } from '../utils/opendental-auth.util';

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

    const metaMap = new Map(
      await Promise.all(
        patPlans.map(async (patplan) => [patplan.PatPlanNum.toString(), await getPatientInsuranceMeta(patplan.PatPlanNum)] as const)
      )
    );

    return patPlans.map((patplan) => ({
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
      subscriberName: patplan.inssub?.insplan?.GroupName ?? '',
      subscriberDateOfBirth:
        metaMap.get(patplan.PatPlanNum.toString())?.subscriberDateOfBirth ?? null,
      relationshipToPatient: mapRelationshipFromDb(patplan.Relationship),
      insuranceType: mapOrdinalToInsuranceType(patplan.Ordinal),
      effectiveDate: patplan.inssub?.DateEffective ?? null,
      expirationDate: patplan.inssub?.DateTerm ?? null,
      copayAmount: metaMap.get(patplan.PatPlanNum.toString())?.copayAmount ?? null,
      deductibleAmount:
        metaMap.get(patplan.PatPlanNum.toString())?.deductibleAmount ?? null,
      autoVerify: metaMap.get(patplan.PatPlanNum.toString())?.autoVerify ?? true,
      verificationStatus:
        metaMap.get(patplan.PatPlanNum.toString())?.verificationStatus ?? 'pending',
      verificationDate:
        metaMap.get(patplan.PatPlanNum.toString())?.verificationDate ?? null,
      isActive: patplan.IsPending ? false : true,
      notes: patplan.inssub?.SubscNote ?? null,
    }));
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
      subscriberName: patplan.inssub?.insplan?.GroupName ?? '',
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
    };
  }

  /**
   * Create patient insurance
   */
  async createPatientInsurance(
    patientId: string,
    data: {
      insuranceCompanyId: string;
      policyNumber: string;
      groupNumber?: string;
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

    const planNum = await getNextId('insplan', 'PlanNum');
    const insSubNum = await getNextId('inssub', 'InsSubNum');
    const patPlanNum = await getNextId('patplan', 'PatPlanNum');

    await prisma.insplan.create({
      data: {
        PlanNum: planNum,
        CarrierNum: BigInt(data.insuranceCompanyId),
        GroupNum: data.groupNumber ?? null,
        GroupName: data.subscriberName ?? null,
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
      subscriberDateOfBirth: data.subscriberDateOfBirth ?? null,
      copayAmount: data.copayAmount ?? null,
      deductibleAmount: data.deductibleAmount ?? null,
      autoVerify: data.autoVerify ?? true,
      verificationStatus: data.verificationStatus ?? 'pending',
      verificationDate: data.verificationDate ?? null,
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

    return this.getPatientInsuranceById(patPlanNum.toString());
  }

  /**
   * Update patient insurance
   */
  async updatePatientInsurance(
    patientInsuranceId: string,
    updates: {
      policyNumber?: string;
      groupNumber?: string;
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

    // If changing insurance type, check for conflicts
    if (updates.insuranceType) {
      const existingInsurance = await prisma.patplan.findFirst({
        where: {
          PatNum: patplan.PatNum ?? undefined,
          Ordinal: mapInsuranceTypeToOrdinal(updates.insuranceType),
          IsPending: 0,
          PatPlanNum: { not: BigInt(patientInsuranceId) },
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
          GroupNum: updates.groupNumber ?? undefined,
          GroupName: updates.subscriberName ?? undefined,
          PlanNote: updates.notes ?? undefined,
        },
      });
    }
    await prisma.patplan.update({
      where: { PatPlanNum: BigInt(patientInsuranceId) },
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
      subscriberDateOfBirth:
        updates.subscriberDateOfBirth ?? currentMeta.subscriberDateOfBirth ?? null,
      copayAmount: updates.copayAmount ?? currentMeta.copayAmount ?? null,
      deductibleAmount:
        updates.deductibleAmount ?? currentMeta.deductibleAmount ?? null,
      autoVerify: updates.autoVerify ?? currentMeta.autoVerify ?? true,
      verificationStatus:
        updates.verificationStatus ?? currentMeta.verificationStatus ?? 'pending',
      verificationDate: updates.verificationDate ?? currentMeta.verificationDate ?? null,
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
  async deletePatientInsurance(patientInsuranceId: string, deletedBy?: string) {
    const patplan = await prisma.patplan.findUnique({
      where: { PatPlanNum: BigInt(patientInsuranceId) },
    });
    if (!patplan) {
      throw new NotFoundError('Patient insurance not found');
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

}

export const patientInsuranceService = new PatientInsuranceService();
