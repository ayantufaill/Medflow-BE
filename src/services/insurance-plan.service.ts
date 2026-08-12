import { prisma } from '../config/db';
import { NotFoundError } from '../utils/error.util';
import { getNextId } from '../utils/opendental-ids.util';
import { createCommlogJson, getCommlogJsonEntries } from '../utils/commlog-json.util';
import { patientInsuranceService } from './patient-insurance.service';

type CoverageTemplateMeta = {
  type: 'coverage_template';
  templateId: string;
  name: string;
  description?: string | null;
  benefits: Array<Record<string, unknown>>;
  createdBy?: string | null;
  createdAt: string;
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

export class InsurancePlanService {
  private mapBenefit(benefit: any) {
    return {
      _id: benefit.BenefitNum.toString(),
      covCatNum: benefit.CovCatNum?.toString() ?? null,
      categoryName: benefit.covcat?.Description ?? null,
      benefitType: benefit.BenefitType ?? null,
      percentage: benefit.Percent ?? null,
      monetaryAmount: benefit.MonetaryAmt ?? null,
      timePeriod: benefit.TimePeriod ?? null,
      quantityQualifier: benefit.QuantityQualifier ?? null,
      quantity: benefit.Quantity ?? null,
      coverageLevel: benefit.CoverageLevel ?? null,
      procedureCode: benefit.procedurecode?.ProcCode ?? null,
      toothRange: benefit.ToothRange ?? null,
    };
  }

  private mapPlan(plan: any) {
    return {
      _id: plan.PlanNum.toString(),
      id: plan.PlanNum.toString(),
      name: plan.GroupName ?? '',
      groupName: plan.GroupName ?? '',
      groupNumber: plan.GroupNum ?? '',
      notes: plan.PlanNote ?? null,
      
      // Flatten carrier properties
      carrier: plan.carrier?.CarrierName ?? 'Manual Entry',
      electronicId: plan.carrier?.ElectID ?? 'N/A',
      phone: plan.carrier?.Phone ?? '-',
      
      // Mapped fee schedule to feeGuide
      feeGuide: plan.FeeSched && plan.FeeSched.toString() !== '0' 
        ? `Sched ${plan.FeeSched}` 
        : 'none',

      // Placeholders/Fields for other frontend columns
      employer: plan.EmployerNum ? 'Associated Employer' : '-',
      templateName: 'Standard',
      subscribers: 0,

      insuranceCompany: plan.carrier
        ? {
            _id: plan.carrier.CarrierNum.toString(),
            name: plan.carrier.CarrierName ?? '',
            payerId: plan.carrier.ElectID ?? null,
          }
        : null,
      feeSched: plan.FeeSched?.toString() ?? null,
      allowedFeeSched: plan.AllowedFeeSched?.toString() ?? null,
      copayFeeSched: plan.CopayFeeSched?.toString() ?? null,
      filingCode: plan.FilingCode?.toString() ?? null,
      filingCodeSubtype: plan.FilingCodeSubtype?.toString() ?? null,
      planType: plan.PlanType ?? null,
      monthRenew: plan.MonthRenew ?? null,
      isActive: !(plan.IsHidden ?? 0),
      benefits: (plan.benefit || []).map((benefit: any) => this.mapBenefit(benefit)),
    };
  }

  async getInsurancePlans(page = 1, limit = 20, search = '') {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (search) {
      where.OR = [
        { GroupName: { contains: search } },
        { GroupNum: { contains: search } },
        { carrier: { CarrierName: { contains: search } } },
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.insplan.findMany({
        where,
        include: {
          carrier: true,
          benefit: {
            include: {
              covcat: true,
              procedurecode: true,
            },
          },
        },
        orderBy: { PlanNum: 'desc' },
        skip,
        take: limit,
      }),
      prisma.insplan.count({ where }),
    ]);

    return {
      plans: rows.map((row) => this.mapPlan(row)),
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async getInsurancePlanById(planId: string) {
    const plan = await prisma.insplan.findUnique({
      where: { PlanNum: BigInt(planId) },
      include: {
        carrier: true,
        benefit: {
          include: {
            covcat: true,
            procedurecode: true,
          },
        },
      },
    });
    if (!plan) {
      throw new NotFoundError('Insurance plan not found');
    }
    return this.mapPlan(plan);
  }

  async createInsurancePlan(
    data: {
      insuranceCompanyId: string;
      name: string;
      groupNumber?: string;
      notes?: string;
      feeSched?: string;
      allowedFeeSched?: string;
      copayFeeSched?: string;
      filingCode?: string;
      filingCodeSubtype?: string;
      planType?: string;
      monthRenew?: number;
      isActive?: boolean;
      benefits?: Array<{
        covCatNum?: string;
        benefitType?: number;
        percentage?: number;
        monetaryAmount?: number;
        timePeriod?: number;
        quantityQualifier?: number;
        quantity?: number;
        coverageLevel?: number;
        codeNum?: string;
        toothRange?: string;
      }>;
    }
  ) {
    const carrier = await prisma.carrier.findUnique({
      where: { CarrierNum: BigInt(data.insuranceCompanyId) },
    });
    if (!carrier) {
      throw new NotFoundError('Insurance company not found');
    }

    const planNum = await getNextId('insplan', 'PlanNum');
    const feeSched = await resolveValidFeeSchedNum(data.feeSched);
    const allowedFeeSched = await resolveValidFeeSchedNum(data.allowedFeeSched);
    const copayFeeSched = await resolveValidFeeSchedNum(data.copayFeeSched);

    await prisma.insplan.create({
      data: {
        PlanNum: planNum,
        CarrierNum: BigInt(data.insuranceCompanyId),
        GroupName: data.name,
        GroupNum: data.groupNumber ?? null,
        PlanNote: data.notes ?? null,
        FeeSched: feeSched,
        AllowedFeeSched: allowedFeeSched,
        CopayFeeSched: copayFeeSched,
        FilingCode: data.filingCode ? BigInt(data.filingCode) : null,
        FilingCodeSubtype: data.filingCodeSubtype ? BigInt(data.filingCodeSubtype) : null,
        PlanType: data.planType ?? null,
        MonthRenew: data.monthRenew ?? null,
        IsHidden: data.isActive === false ? 1 : 0,
      },
    });

    if (data.benefits && data.benefits.length > 0) {
      let nextBenefitNum = await getNextId('benefit', 'BenefitNum');
      const benefitsData = data.benefits.map((benefit) => {
        const currentBenefitNum = nextBenefitNum;
        nextBenefitNum += 1n;
        return {
          BenefitNum: currentBenefitNum,
          PlanNum: planNum,
          CovCatNum: benefit.covCatNum ? BigInt(benefit.covCatNum) : null,
          BenefitType: benefit.benefitType ?? null,
          Percent: benefit.percentage ?? null,
          MonetaryAmt: benefit.monetaryAmount ?? null,
          TimePeriod: benefit.timePeriod ?? null,
          QuantityQualifier: benefit.quantityQualifier ?? null,
          Quantity: benefit.quantity ?? null,
          CoverageLevel: benefit.coverageLevel ?? null,
          CodeNum: benefit.codeNum ? BigInt(benefit.codeNum) : null,
          ToothRange: benefit.toothRange ?? null,
          SecDateTEntry: new Date(),
        };
      });
      await prisma.benefit.createMany({ data: benefitsData });
    }

    return this.getInsurancePlanById(planNum.toString());
  }

  async updateInsurancePlan(
    planId: string,
    updates: {
      name?: string;
      groupNumber?: string;
      notes?: string;
      feeSched?: string;
      allowedFeeSched?: string;
      copayFeeSched?: string;
      filingCode?: string;
      filingCodeSubtype?: string;
      planType?: string;
      monthRenew?: number;
      isActive?: boolean;
    }
  ) {
    const existing = await prisma.insplan.findUnique({
      where: { PlanNum: BigInt(planId) },
    });
    if (!existing) {
      throw new NotFoundError('Insurance plan not found');
    }

    const feeSched = updates.feeSched !== undefined ? await resolveValidFeeSchedNum(updates.feeSched) : undefined;
    const allowedFeeSched = updates.allowedFeeSched !== undefined ? await resolveValidFeeSchedNum(updates.allowedFeeSched) : undefined;
    const copayFeeSched = updates.copayFeeSched !== undefined ? await resolveValidFeeSchedNum(updates.copayFeeSched) : undefined;

    await prisma.insplan.update({
      where: { PlanNum: BigInt(planId) },
      data: {
        GroupName: updates.name ?? undefined,
        GroupNum: updates.groupNumber ?? undefined,
        PlanNote: updates.notes ?? undefined,
        FeeSched: feeSched,
        AllowedFeeSched: allowedFeeSched,
        CopayFeeSched: copayFeeSched,
        FilingCode: updates.filingCode ? BigInt(updates.filingCode) : undefined,
        FilingCodeSubtype: updates.filingCodeSubtype ? BigInt(updates.filingCodeSubtype) : undefined,
        PlanType: updates.planType ?? undefined,
        MonthRenew: updates.monthRenew ?? undefined,
        IsHidden: updates.isActive !== undefined ? (updates.isActive ? 0 : 1) : undefined,
        SecDateTEdit: new Date(),
      },
    });

    return this.getInsurancePlanById(planId);
  }

  async getPatientCoverages(patientId: string) {
    const insurances = await patientInsuranceService.getPatientInsurances(patientId);
    return {
      coverages: insurances.map((insurance) => ({
        ...insurance,
        insurancePlan: insurance.insuranceCompanyId,
      })),
    };
  }

  async createPatientCoverage(patientId: string, data: any, userId?: string) {
    const coverage = await patientInsuranceService.createPatientInsurance(patientId, data, userId);
    return { coverage };
  }

  async getCoverageTemplates() {
    const entries = await getCommlogJsonEntries<CoverageTemplateMeta>({
      contains: '"type":"coverage_template"',
    });
    return {
      templates: entries.map(({ meta }) => ({
        _id: meta.templateId,
        name: meta.name,
        description: meta.description ?? null,
        benefits: meta.benefits ?? [],
        createdBy: meta.createdBy ?? null,
        createdAt: meta.createdAt,
      })),
    };
  }

  async createCoverageTemplate(
    data: { name: string; description?: string; benefits?: Array<Record<string, unknown>> },
    userId?: string
  ) {
    await createCommlogJson({
      userId: userId ?? null,
      payload: {
        type: 'coverage_template',
        templateId: `ct-${Date.now()}`,
        name: data.name,
        description: data.description ?? null,
        benefits: data.benefits ?? [],
        createdBy: userId ?? null,
        createdAt: new Date().toISOString(),
      } satisfies CoverageTemplateMeta,
    });
    return this.getCoverageTemplates();
  }

  async deleteInsurancePlan(planId: string) {
    const plan = await prisma.insplan.findUnique({
      where: { PlanNum: BigInt(planId) },
    });
    if (!plan) {
      throw new NotFoundError('Insurance plan not found');
    }

    // Soft-delete: OpenDental hides plans using the IsHidden flag to preserve clinical history
    await prisma.insplan.update({
      where: { PlanNum: BigInt(planId) },
      data: {
        IsHidden: 1,
        SecDateTEdit: new Date(),
      },
    });
  }

  async createBenefit(
    planId: string,
    data: {
      covCatNum?: string;
      benefitType?: number;
      percentage?: number;
      monetaryAmount?: number;
      timePeriod?: number;
      quantityQualifier?: number;
      quantity?: number;
      coverageLevel?: number;
      codeNum?: string;
      toothRange?: string;
    }
  ) {
    const plan = await prisma.insplan.findUnique({
      where: { PlanNum: BigInt(planId) },
    });
    if (!plan) {
      throw new NotFoundError('Insurance plan not found');
    }

    const benefitNum = await getNextId('benefit', 'BenefitNum');
    await prisma.benefit.create({
      data: {
        BenefitNum: benefitNum,
        PlanNum: BigInt(planId),
        CovCatNum: data.covCatNum ? BigInt(data.covCatNum) : null,
        BenefitType: data.benefitType ?? null,
        Percent: data.percentage ?? null,
        MonetaryAmt: data.monetaryAmount ?? null,
        TimePeriod: data.timePeriod ?? null,
        QuantityQualifier: data.quantityQualifier ?? null,
        Quantity: data.quantity ?? null,
        CoverageLevel: data.coverageLevel ?? null,
        CodeNum: data.codeNum ? BigInt(data.codeNum) : null,
        ToothRange: data.toothRange ?? null,
        SecDateTEntry: new Date(),
      },
    });

    return this.getInsurancePlanById(planId);
  }

  async updateBenefit(
    planId: string,
    benefitId: string,
    data: {
      covCatNum?: string;
      benefitType?: number;
      percentage?: number;
      monetaryAmount?: number;
      timePeriod?: number;
      quantityQualifier?: number;
      quantity?: number;
      coverageLevel?: number;
      codeNum?: string;
      toothRange?: string;
    }
  ) {
    const benefit = await prisma.benefit.findUnique({
      where: { BenefitNum: BigInt(benefitId) },
    });
    if (!benefit || benefit.PlanNum?.toString() !== planId) {
      throw new NotFoundError('Benefit not found for this plan');
    }

    await prisma.benefit.update({
      where: { BenefitNum: BigInt(benefitId) },
      data: {
        CovCatNum: data.covCatNum ? BigInt(data.covCatNum) : undefined,
        BenefitType: data.benefitType ?? undefined,
        Percent: data.percentage ?? undefined,
        MonetaryAmt: data.monetaryAmount ?? undefined,
        TimePeriod: data.timePeriod ?? undefined,
        QuantityQualifier: data.quantityQualifier ?? undefined,
        Quantity: data.quantity ?? undefined,
        CoverageLevel: data.coverageLevel ?? undefined,
        CodeNum: data.codeNum ? BigInt(data.codeNum) : undefined,
        ToothRange: data.toothRange ?? undefined,
        SecDateTEdit: new Date(),
      },
    });

    return this.getInsurancePlanById(planId);
  }

  async deleteBenefit(planId: string, benefitId: string) {
    const benefit = await prisma.benefit.findUnique({
      where: { BenefitNum: BigInt(benefitId) },
    });
    if (!benefit || benefit.PlanNum?.toString() !== planId) {
      throw new NotFoundError('Benefit not found for this plan');
    }

    await prisma.benefit.delete({
      where: { BenefitNum: BigInt(benefitId) },
    });
  }
}

export const insurancePlanService = new InsurancePlanService();
