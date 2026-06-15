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

    if (category === 1) {
      // Category 1: Adjustments
      const setting = await this.getSetting('adjustment_definitions_metadata');
      const meta = typeof setting === 'object' ? setting : {};
      return list.map((item) => {
        const itemId = item.DefNum.toString();
        const itemMeta = meta[itemId] || {};
        return {
          id: itemId,
          type: item.ItemName || '',
          note: itemMeta.note || item.ItemValue || '',
          isHidden: item.IsHidden === 1,
          itemOrder: item.ItemOrder ?? 0,
          amount: itemMeta.amount || '',
          percent: itemMeta.percent || '',
        };
      });
    }

    if (category === 4) {
      // Category 4: Payment Types
      const setting = await this.getSetting('payment_types_metadata');
      const meta = typeof setting === 'object' ? setting : {};
      return list.map((item) => {
        const itemId = item.DefNum.toString();
        
        // Try parsing JSON from ItemValue first
        let parsedVal: any = {};
        try {
          if (item.ItemValue && item.ItemValue.trim().startsWith('{')) {
            parsedVal = JSON.parse(item.ItemValue);
          }
        } catch (e) {
          // ignore parsing error, fallback to legacy
        }

        const itemMeta = meta[itemId] || {};
        
        return {
          id: itemId,
          type: item.ItemName || '',
          note: parsedVal.note ?? itemMeta.note ?? item.ItemValue ?? '',
          isHidden: item.IsHidden === 1,
          itemOrder: item.ItemOrder ?? 0,
          depositSlip: parsedVal.depositSlip !== undefined ? Boolean(parsedVal.depositSlip) : Boolean(itemMeta.depositSlip),
          openEdge: parsedVal.openEdge !== undefined ? Boolean(parsedVal.openEdge) : Boolean(itemMeta.openEdge),
          prosperipay: parsedVal.prosperipay !== undefined ? Boolean(parsedVal.prosperipay) : Boolean(itemMeta.prosperipay),
          smilepay: parsedVal.smilepay !== undefined ? Boolean(parsedVal.smilepay) : Boolean(itemMeta.smilepay),
        };
      });
    }

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
    data: {
      name: string;
      value?: string;
      itemOrder?: number;
      amount?: string;
      percent?: string;
      note?: string;
      depositSlip?: boolean;
      openEdge?: boolean;
      prosperipay?: boolean;
      smilepay?: boolean;
    }
  ): Promise<any> {
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
          const idStr = item.DefNum.toString();

          if (category === 1) {
            const currentSetting = await this.getSetting('adjustment_definitions_metadata');
            const meta = typeof currentSetting === 'object' ? currentSetting : {};
            meta[idStr] = {
              amount: data.amount ?? '',
              percent: data.percent ?? '',
              note: data.note ?? '',
            };
            await this.saveSetting('adjustment_definitions_metadata', meta);

            resolve({
              id: idStr,
              type: item.ItemName || '',
              note: data.note ?? (item.ItemValue || ''),
              isHidden: item.IsHidden === 1,
              itemOrder: item.ItemOrder ?? 0,
              amount: data.amount ?? '',
              percent: data.percent ?? '',
            });
            return;
          }

          if (category === 4) {
            // Serialize Payment Type metadata properties directly to ItemValue JSON string
            const serializedValue = JSON.stringify({
              depositSlip: Boolean(data.depositSlip),
              openEdge: Boolean(data.openEdge),
              prosperipay: Boolean(data.prosperipay),
              smilepay: Boolean(data.smilepay),
              note: data.note ?? '',
            });

            // Update item to store the serialized JSON in ItemValue column
            const updatedItem = await prisma.definition.update({
              where: { DefNum: defNum },
              data: { ItemValue: serializedValue },
            });

            const currentSetting = await this.getSetting('payment_types_metadata');
            const meta = typeof currentSetting === 'object' ? currentSetting : {};
            meta[idStr] = {
              depositSlip: Boolean(data.depositSlip),
              openEdge: Boolean(data.openEdge),
              prosperipay: Boolean(data.prosperipay),
              smilepay: Boolean(data.smilepay),
              note: data.note ?? '',
            };
            await this.saveSetting('payment_types_metadata', meta);

            resolve({
              id: idStr,
              type: updatedItem.ItemName || '',
              note: data.note ?? '',
              isHidden: updatedItem.IsHidden === 1,
              itemOrder: updatedItem.ItemOrder ?? 0,
              depositSlip: Boolean(data.depositSlip),
              openEdge: Boolean(data.openEdge),
              prosperipay: Boolean(data.prosperipay),
              smilepay: Boolean(data.smilepay),
            });
            return;
          }

          resolve({
            id: idStr,
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
    updates: Partial<{
      name: string;
      value: string;
      isHidden: boolean;
      itemOrder: number;
      amount: string;
      percent: string;
      note: string;
      depositSlip: boolean;
      openEdge: boolean;
      prosperipay: boolean;
      smilepay: boolean;
    }>
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

    const idStr = updated.DefNum.toString();

    if (existing.Category === 1) {
      const currentSetting = await this.getSetting('adjustment_definitions_metadata');
      const meta = typeof currentSetting === 'object' ? currentSetting : {};
      meta[idStr] = {
        amount: updates.amount !== undefined ? updates.amount : (meta[idStr]?.amount ?? ''),
        percent: updates.percent !== undefined ? updates.percent : (meta[idStr]?.percent ?? ''),
        note: updates.note !== undefined ? updates.note : (meta[idStr]?.note ?? ''),
      };
      await this.saveSetting('adjustment_definitions_metadata', meta);

      return {
        id: idStr,
        type: updated.ItemName || '',
        note: meta[idStr].note || updated.ItemValue || '',
        isHidden: updated.IsHidden === 1,
        itemOrder: updated.ItemOrder ?? 0,
        amount: meta[idStr].amount,
        percent: meta[idStr].percent,
      };
    }

    if (existing.Category === 4) {
      const currentSetting = await this.getSetting('payment_types_metadata');
      const meta = typeof currentSetting === 'object' ? currentSetting : {};
      
      const newDepositSlip = updates.depositSlip !== undefined ? Boolean(updates.depositSlip) : Boolean(meta[idStr]?.depositSlip);
      const newOpenEdge = updates.openEdge !== undefined ? Boolean(updates.openEdge) : Boolean(meta[idStr]?.openEdge);
      const newProsperipay = updates.prosperipay !== undefined ? Boolean(updates.prosperipay) : Boolean(meta[idStr]?.prosperipay);
      const newSmilepay = updates.smilepay !== undefined ? Boolean(updates.smilepay) : Boolean(meta[idStr]?.smilepay);
      const newNote = updates.note !== undefined ? updates.note : (meta[idStr]?.note ?? '');

      const serializedValue = JSON.stringify({
        depositSlip: newDepositSlip,
        openEdge: newOpenEdge,
        prosperipay: newProsperipay,
        smilepay: newSmilepay,
        note: newNote,
      });

      // Update definition record ItemValue with new serialized JSON value
      const finalUpdated = await prisma.definition.update({
        where: { DefNum: defNumBigInt },
        data: { ItemValue: serializedValue },
      });

      meta[idStr] = {
        depositSlip: newDepositSlip,
        openEdge: newOpenEdge,
        prosperipay: newProsperipay,
        smilepay: newSmilepay,
        note: newNote,
      };
      await this.saveSetting('payment_types_metadata', meta);

      return {
        id: idStr,
        type: finalUpdated.ItemName || '',
        note: newNote,
        isHidden: finalUpdated.IsHidden === 1,
        itemOrder: finalUpdated.ItemOrder ?? 0,
        depositSlip: newDepositSlip,
        openEdge: newOpenEdge,
        prosperipay: newProsperipay,
        smilepay: newSmilepay,
      };
    }

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
      if (key === 'payment_types_defaults') {
        return {
          patient: 'Master Card',
          insurance: 'Master Card',
          family: '',
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

  // --- STATEMENT PRINT-OUT FORMS ---
  async getStatementForms() {
    const data = await this.getSetting('statement_printout_forms');
    if (!Array.isArray(data) || data.length === 0) {
      // Default statement form
      return [
        {
          id: '1',
          name: 'Simple Statement',
          isDefault: true,
          sections: {
            header: true,
            transaction: true,
            balances: true,
            aging: true,
            summary: true,
            appointments: true,
            disclaimer: true,
          },
        },
      ];
    }
    return data;
  }

  async createStatementForm(data: any) {
    const forms = await this.getStatementForms();
    const newForm = {
      id: `sf-${Date.now()}`,
      name: data.name || 'New Statement Form',
      isDefault: data.isDefault || false,
      sections: data.sections || {
        header: true,
        transaction: true,
        balances: true,
        aging: true,
        summary: true,
        appointments: true,
        disclaimer: true,
      },
    };
    if (newForm.isDefault) {
      forms.forEach((f: any) => (f.isDefault = false));
    }
    forms.push(newForm);
    await this.saveSetting('statement_printout_forms', forms);
    return newForm;
  }

  async updateStatementForm(id: string, updates: any) {
    const forms = await this.getStatementForms();
    const index = forms.findIndex((f: any) => f.id === id);
    if (index === -1) {
      throw new NotFoundError('Statement form not found');
    }
    if (updates.isDefault) {
      forms.forEach((f: any) => (f.isDefault = false));
    }
    forms[index] = {
      ...forms[index],
      ...updates,
      id, // ensure ID is preserved
    };
    await this.saveSetting('statement_printout_forms', forms);
    return forms[index];
  }

  async deleteStatementForm(id: string) {
    const forms = await this.getStatementForms();
    const filtered = forms.filter((f: any) => f.id !== id);
    await this.saveSetting('statement_printout_forms', filtered);
    return { success: true };
  }

  // --- COVERAGE BOOK SHORTCUTS ---
  async getCoverageBookShortcuts() {
    const data = await this.getSetting('coverage_book_shortcuts');
    if (!Array.isArray(data) || data.length === 0) {
      // Return the default coverage book shortcuts to prevent empty pages
      return [
        {
          id: 1,
          name: 'Preventive',
          groups: [
            {
              id: 101,
              name: 'Exam',
              deliveryPattern: '2/1 year(s)',
              codes: [
                { code: 'D0120', desc: 'periodic oral evaluation - established patient' },
                { code: 'D0150', desc: 'comprehensive oral evaluation - new or established patient' },
              ],
            },
          ],
        },
      ];
    }
    return data;
  }

  async createCoverageBookShortcut(data: any) {
    const list = await this.getCoverageBookShortcuts();
    const newShortcut = {
      id: data.id || Date.now(),
      name: data.name,
      groups: data.groups || [],
    };
    list.push(newShortcut);
    await this.saveSetting('coverage_book_shortcuts', list);
    return newShortcut;
  }

  async updateCoverageBookShortcut(id: number | string, updates: any) {
    const list = await this.getCoverageBookShortcuts();
    const index = list.findIndex((item: any) => item.id.toString() === id.toString());
    if (index === -1) {
      throw new NotFoundError('Coverage shortcut not found');
    }
    list[index] = {
      ...list[index],
      ...updates,
      id: list[index].id, // preserve ID
    };
    await this.saveSetting('coverage_book_shortcuts', list);
    return list[index];
  }

  async deleteCoverageBookShortcut(id: number | string) {
    const list = await this.getCoverageBookShortcuts();
    const filtered = list.filter((item: any) => item.id.toString() !== id.toString());
    await this.saveSetting('coverage_book_shortcuts', filtered);
    return { success: true };
  }
}

export const adminFinanceService = new AdminFinanceService();
