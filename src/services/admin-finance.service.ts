import { prisma } from '../config/db';
import { NotFoundError } from '../utils/error.util';

export class AdminFinanceService {
  private static writeLock: Promise<any> = Promise.resolve();

  // --- DEFINITIONS (ADJUSTMENT & PAYMENT TYPES) ---
  
  async getNextDefNum(): Promise<bigint> {
    const maxDef = await prisma.definition.findFirst({
      orderBy: { DefNum: 'desc' },
    });
    return (maxDef?.DefNum ?? BigInt(0)) + BigInt(1);
  }

  async getDefinitions(category: number) {
    const list = await prisma.definition.findMany({
      where: {
        Category: category,
        IsHidden: 0,
      },
      orderBy: {
        ItemOrder: 'asc',
      },
    });

    return list.map((item) => ({
      id: item.DefNum.toString(),
      type: item.ItemName || '',
      note: item.ItemValue || '',
      isHidden: item.IsHidden === 1,
      itemOrder: item.ItemOrder ?? 0,
    }));
  }

  async createDefinition(
    category: number,
    data: { name: string; value?: string; itemOrder?: number }
  ): Promise<{ id: string; type: string; note: string; isHidden: boolean; itemOrder: number }> {
    return new Promise((resolve, reject) => {
      AdminFinanceService.writeLock = AdminFinanceService.writeLock.then(async () => {
        try {
          const defNum = await this.getNextDefNum();
          const item = await prisma.definition.create({
            data: {
              DefNum: defNum,
              Category: category,
              ItemName: data.name,
              ItemValue: data.value ?? '',
              ItemOrder: data.itemOrder ?? 0,
              IsHidden: 0,
            },
          });
          resolve({
            id: item.DefNum.toString(),
            type: item.ItemName || '',
            note: item.ItemValue || '',
            isHidden: item.IsHidden === 1,
            itemOrder: item.ItemOrder ?? 0,
          });
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  async updateDefinition(
    defNum: string,
    updates: Partial<{ name: string; value: string; isHidden: boolean; itemOrder: number }>
  ) {
    const defNumBigInt = BigInt(defNum);
    const existing = await prisma.definition.findUnique({
      where: { DefNum: defNumBigInt },
    });

    if (!existing) {
      throw new NotFoundError('Definition not found');
    }

    const updated = await prisma.definition.update({
      where: { DefNum: defNumBigInt },
      data: {
        ItemName: updates.name ?? undefined,
        ItemValue: updates.value ?? undefined,
        IsHidden: updates.isHidden !== undefined ? (updates.isHidden ? 1 : 0) : undefined,
        ItemOrder: updates.itemOrder ?? undefined,
      },
    });

    return {
      id: updated.DefNum.toString(),
      type: updated.ItemName || '',
      note: updated.ItemValue || '',
      isHidden: updated.IsHidden === 1,
      itemOrder: updated.ItemOrder ?? 0,
    };
  }

  async deleteDefinition(defNum: string) {
    const defNumBigInt = BigInt(defNum);
    const existing = await prisma.definition.findUnique({
      where: { DefNum: defNumBigInt },
    });

    if (!existing) {
      throw new NotFoundError('Definition not found');
    }

    // Soft delete by hiding the definition (standard OpenDental pattern)
    await prisma.definition.update({
      where: { DefNum: defNumBigInt },
      data: { IsHidden: 1 },
    });

    return { success: true };
  }

  // --- SERIALIZED SETTINGS (JSON SETTINGS) ---

  async getSetting(key: string) {
    const setting = await prisma.clinicalsystemsetting.findUnique({
      where: { Key: key },
    });

    if (!setting) {
      // Return defaults matching frontend expectations if setting is not yet stored
      if (key === 'billing_configuration') {
        return {
          assignmentAllBenefits: true,
          outOfNetworkByDefault: false,
          chronologicalInvoices: false,
          closeClaimsNonAssignment: true,
          closeClaimsZeroOwing: false,
          policiesForClaimsOnly: false,
        };
      }
      if (key === 'ar_automation_config') {
        return {
          enabled: false,
          skipOpenClaims: false,
          notifications: [
            { id: 1, title: '#1 Notification', template: 'AR Automation 15 Days', method: 'Email', after: '15 Days' },
            { id: 2, title: '#2 Notification', template: 'AR Automation 30 Days', method: 'Email', after: '30 Days' },
            { id: 3, title: '#3 Notification', template: 'AR Automation 45 Days', method: 'Email', after: '45 Days' },
          ],
        };
      }
      return {};
    }

    try {
      return JSON.parse(setting.Value);
    } catch {
      return { value: setting.Value };
    }
  }

  async saveSetting(key: string, value: any) {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    const setting = await prisma.clinicalsystemsetting.upsert({
      where: { Key: key },
      update: { Value: stringValue },
      create: { Key: key, Value: stringValue },
    });

    try {
      return JSON.parse(setting.Value);
    } catch {
      return { value: setting.Value };
    }
  }
}

export const adminFinanceService = new AdminFinanceService();
