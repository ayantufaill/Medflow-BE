import { prisma } from '../config/db';
import { NotFoundError } from '../utils/error.util';

export class MembershipPlanService {
  private async getSetting(key: string) {
    const setting = await prisma.clinicalsystemsetting.findUnique({
      where: { Key: key },
    });
    if (!setting) return null;
    try {
      return JSON.parse(setting.Value);
    } catch {
      return setting.Value;
    }
  }

  private async saveSetting(key: string, value: any) {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    await prisma.clinicalsystemsetting.upsert({
      where: { Key: key },
      update: { Value: stringValue },
      create: { Key: key, Value: stringValue },
    });
  }

  async getMembershipPlans() {
    const data = await this.getSetting('membership_plans');
    if (!Array.isArray(data) || data.length === 0) {
      // Default membership plans matching the frontend expectation
      return [
        {
          id: '1',
          name: 'Bright Beginning',
          templateName: '',
          subscribers: 1,
          annualFee: '$550.00',
          monthlyFee: '$46.00',
        },
        {
          id: '2',
          name: 'Clean + Confident - Existing Patient',
          templateName: '',
          subscribers: 2,
          annualFee: '$800.00',
          monthlyFee: '$75.00',
        },
        {
          id: '3',
          name: 'Clean + Confident - New Patient',
          templateName: '',
          subscribers: 0,
          annualFee: '$1,050.00',
          monthlyFee: '$89.00',
        },
        {
          id: '4',
          name: 'Foundations (Perio) Program - New Patient',
          templateName: 'Foundations',
          subscribers: 3,
          annualFee: '$1,495.00',
          monthlyFee: '$133.00',
        },
        {
          id: '5',
          name: 'Foundations (Perio) Program Existing Patient',
          templateName: '',
          subscribers: 1,
          annualFee: '$1,195.00',
          monthlyFee: '$105.00',
        },
      ];
    }
    return data;
  }

  async createMembershipPlan(data: any) {
    const plans = await this.getMembershipPlans();
    const newPlan = {
      id: `mp-${Date.now()}`,
      name: data.name,
      templateName: data.saveAsTemplate ? 'Template' : (data.templateName || ''),
      subscribers: data.subscribers || 0,
      annualFee: data.annualFee.startsWith('$') ? data.annualFee : `$${data.annualFee}`,
      monthlyFee: data.monthlyFee.startsWith('$') ? data.monthlyFee : `$${data.monthlyFee}`,
      isCoPay: Boolean(data.isCoPay),
      autoRenewal: Boolean(data.autoRenewal),
      individualMax: data.individualMax || '',
      isIndividualMaxUnlimited: data.isIndividualMaxUnlimited !== false,
      familyMax: data.familyMax || '',
      isFamilyMaxUnlimited: data.isFamilyMaxUnlimited !== false,
      orthoLimit: data.orthoLimit || '',
      notes: data.notes || '',
      saveAsTemplate: Boolean(data.saveAsTemplate),
    };
    plans.push(newPlan);
    await this.saveSetting('membership_plans', plans);
    return newPlan;
  }

  async updateMembershipPlan(id: string, updates: any) {
    const plans = await this.getMembershipPlans();
    const index = plans.findIndex((p: any) => p.id === id);
    if (index === -1) {
      throw new NotFoundError('Membership plan not found');
    }
    plans[index] = {
      ...plans[index],
      ...updates,
      id, // preserve ID
    };
    await this.saveSetting('membership_plans', plans);
    return plans[index];
  }

  async deleteMembershipPlan(id: string) {
    const plans = await this.getMembershipPlans();
    const filtered = plans.filter((p: any) => p.id !== id);
    await this.saveSetting('membership_plans', filtered);
    return { success: true };
  }
}

export const membershipPlanService = new MembershipPlanService();
