import { prisma } from '../config/db';
import { NotFoundError } from '../utils/error.util';

export class ClinicalManagementService {
  // --- PRODUCTS ---
  async getProducts() {
    const categories = await prisma.clinicalproductcategory.findMany({
      where: { IsActive: true },
      include: {
        choices: {
          where: { IsActive: true },
        },
      },
    });

    return categories.map((cat) => ({
      id: cat.CategoryId.toString(),
      name: cat.Name,
      section: cat.Section,
      choices: cat.choices.map((choice) => ({
        id: choice.ChoiceId.toString(),
        name: choice.Name,
        isDefault: choice.IsDefault,
        quickList: choice.QuickList,
        isRecommended: choice.IsRecommended,
        price: choice.Price.toString(),
        code: choice.Code,
      })),
    }));
  }

  async createProductCategory(name: string, section: string) {
    const category = await prisma.clinicalproductcategory.create({
      data: { Name: name, Section: section },
    });
    return {
      id: category.CategoryId.toString(),
      name: category.Name,
      section: category.Section,
      choices: [],
    };
  }

  async createProductChoice(
    categoryId: string,
    data: {
      name: string;
      isDefault?: boolean;
      quickList?: boolean;
      isRecommended?: boolean;
      price?: number | string;
      code?: string;
    }
  ) {
    const catId = BigInt(categoryId);
    const category = await prisma.clinicalproductcategory.findUnique({
      where: { CategoryId: catId },
    });
    if (!category) {
      throw new NotFoundError('Product category not found');
    }

    const priceVal = data.price !== undefined ? parseFloat(data.price.toString()) : 0.0;

    return await prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        // Clear default status for other choices under this category
        await tx.clinicalproductchoice.updateMany({
          where: { CategoryId: catId },
          data: { IsDefault: false },
        });
      }

      const choice = await tx.clinicalproductchoice.create({
        data: {
          CategoryId: catId,
          Name: data.name,
          IsDefault: data.isDefault ?? false,
          QuickList: data.quickList ?? false,
          IsRecommended: data.isRecommended ?? false,
          Price: priceVal,
          Code: data.code ?? '',
        },
      });

      return {
        id: choice.ChoiceId.toString(),
        name: choice.Name,
        isDefault: choice.IsDefault,
        quickList: choice.QuickList,
        isRecommended: choice.IsRecommended,
        price: choice.Price.toString(),
        code: choice.Code,
      };
    });
  }

  async updateProductChoice(
    choiceId: string,
    updates: Partial<{
      name: string;
      isDefault: boolean;
      quickList: boolean;
      isRecommended: boolean;
      price: number | string;
      code: string;
    }>
  ) {
    const choiceBigInt = BigInt(choiceId);
    const existing = await prisma.clinicalproductchoice.findUnique({
      where: { ChoiceId: choiceBigInt },
    });
    if (!existing) {
      throw new NotFoundError('Product choice not found');
    }

    const priceVal =
      updates.price !== undefined ? parseFloat(updates.price.toString()) : undefined;

    return await prisma.$transaction(async (tx) => {
      if (updates.isDefault) {
        // Clear other defaults in this category
        await tx.clinicalproductchoice.updateMany({
          where: { CategoryId: existing.CategoryId },
          data: { IsDefault: false },
        });
      }

      const choice = await tx.clinicalproductchoice.update({
        where: { ChoiceId: choiceBigInt },
        data: {
          Name: updates.name ?? undefined,
          IsDefault: updates.isDefault ?? undefined,
          QuickList: updates.quickList ?? undefined,
          IsRecommended: updates.isRecommended ?? undefined,
          Price: priceVal ?? undefined,
          Code: updates.code ?? undefined,
        },
      });

      return {
        id: choice.ChoiceId.toString(),
        name: choice.Name,
        isDefault: choice.IsDefault,
        quickList: choice.QuickList,
        isRecommended: choice.IsRecommended,
        price: choice.Price.toString(),
        code: choice.Code,
      };
    });
  }

  async deactivateProductCategory(categoryId: string) {
    await prisma.clinicalproductcategory.update({
      where: { CategoryId: BigInt(categoryId) },
      data: { IsActive: false },
    });
    return { success: true };
  }

  async deactivateProductChoice(choiceId: string) {
    await prisma.clinicalproductchoice.update({
      where: { ChoiceId: BigInt(choiceId) },
      data: { IsActive: false },
    });
    return { success: true };
  }

  // --- CHECKLISTS ---
  async getChecklists() {
    const categories = await prisma.clinicalchecklistcategory.findMany({
      where: { IsActive: true },
      include: {
        checklists: {
          where: { IsActive: true },
          include: {
            items: {
              where: { IsActive: true },
            },
          },
        },
      },
    });

    const res: Record<string, any[]> = {};
    categories.forEach((cat) => {
      res[cat.Name] = cat.checklists.map((cl) => ({
        id: cl.ChecklistId.toString(),
        name: cl.Name,
        shortName: cl.ShortName,
        isTreatment: cl.IsTreatment,
        isHygiene: cl.IsHygiene,
        iconId: cl.IconId,
        items: cl.items.map((item) => ({
          id: parseInt(item.ItemId.toString()),
          text: item.Text,
          choices: JSON.parse(item.Choices || '[]'),
          products: JSON.parse(item.Products || '[]'),
        })),
      }));
    });
    return res;
  }

  async createChecklistCategory(name: string) {
    const category = await prisma.clinicalchecklistcategory.create({
      data: { Name: name },
    });
    return { id: category.CategoryId.toString(), name: category.Name };
  }

  async createChecklist(
    categoryName: string,
    data: {
      name: string;
      shortName: string;
      isTreatment?: boolean;
      isHygiene?: boolean;
      iconId?: string;
    }
  ) {
    return await prisma.$transaction(async (tx) => {
      let category = await tx.clinicalchecklistcategory.findFirst({
        where: { Name: categoryName, IsActive: true },
      });

      if (!category) {
        category = await tx.clinicalchecklistcategory.create({
          data: { Name: categoryName },
        });
      }

      const checklist = await tx.clinicalchecklist.create({
        data: {
          CategoryId: category.CategoryId,
          Name: data.name,
          ShortName: data.shortName,
          IsTreatment: data.isTreatment ?? true,
          IsHygiene: data.isHygiene ?? false,
          IconId: data.iconId ?? 'tooth-prep',
        },
      });

      return {
        id: checklist.ChecklistId.toString(),
        name: checklist.Name,
        shortName: checklist.ShortName,
        isTreatment: checklist.IsTreatment,
        isHygiene: checklist.IsHygiene,
        iconId: checklist.IconId,
        items: [],
      };
    });
  }

  async createChecklistItem(
    checklistId: string,
    data: {
      text: string;
      choices?: string[];
      products?: string[];
    }
  ) {
    const clId = BigInt(checklistId);
    const item = await prisma.clinicalchecklistitem.create({
      data: {
        ChecklistId: clId,
        Text: data.text,
        Choices: JSON.stringify(data.choices ?? []),
        Products: JSON.stringify(data.products ?? []),
      },
    });

    return {
      id: parseInt(item.ItemId.toString()),
      text: item.Text,
      choices: JSON.parse(item.Choices),
      products: JSON.parse(item.Products),
    };
  }

  async addChoiceToChecklistItem(itemId: string, choice: string) {
    const itemBigInt = BigInt(itemId);
    const existing = await prisma.clinicalchecklistitem.findUnique({
      where: { ItemId: itemBigInt },
    });
    if (!existing) {
      throw new NotFoundError('Checklist item not found');
    }

    const choices: string[] = JSON.parse(existing.Choices || '[]');
    choices.push(choice);

    await prisma.clinicalchecklistitem.update({
      where: { ItemId: itemBigInt },
      data: { Choices: JSON.stringify(choices) },
    });

    return { success: true, choices };
  }

  async addProductToChecklistItem(itemId: string, product: string) {
    const itemBigInt = BigInt(itemId);
    const existing = await prisma.clinicalchecklistitem.findUnique({
      where: { ItemId: itemBigInt },
    });
    if (!existing) {
      throw new NotFoundError('Checklist item not found');
    }

    const products: string[] = JSON.parse(existing.Products || '[]');
    products.push(product);

    await prisma.clinicalchecklistitem.update({
      where: { ItemId: itemBigInt },
      data: { Products: JSON.stringify(products) },
    });

    return { success: true, products };
  }

  async updateChecklist(
    checklistId: string,
    updates: Partial<{
      name: string;
      shortName: string;
      isTreatment: boolean;
      isHygiene: boolean;
      iconId: string;
    }>
  ) {
    const clId = BigInt(checklistId);
    const updated = await prisma.clinicalchecklist.update({
      where: { ChecklistId: clId },
      data: {
        Name: updates.name ?? undefined,
        ShortName: updates.shortName ?? undefined,
        IsTreatment: updates.isTreatment ?? undefined,
        IsHygiene: updates.isHygiene ?? undefined,
        IconId: updates.iconId ?? undefined,
      },
    });

    return {
      id: updated.ChecklistId.toString(),
      name: updated.Name,
      shortName: updated.ShortName,
      isTreatment: updated.IsTreatment,
      isHygiene: updated.IsHygiene,
      iconId: updated.IconId,
    };
  }

  async deleteChecklist(checklistId: string) {
    await prisma.clinicalchecklist.update({
      where: { ChecklistId: BigInt(checklistId) },
      data: { IsActive: false },
    });
    return { success: true };
  }

  async deleteChecklistItem(itemId: string) {
    await prisma.clinicalchecklistitem.update({
      where: { ItemId: BigInt(itemId) },
      data: { IsActive: false },
    });
    return { success: true };
  }

  // --- PRESCRIPTION TEMPLATES ---
  async getPrescriptionTemplates() {
    const templates = await prisma.prescriptiontemplate.findMany({
      where: { IsActive: true },
    });
    return templates.map((t) => ({
      id: t.TemplateId.toString(),
      name: t.Name,
      drug: t.Drug,
      sig: t.Sig,
      disp: t.Disp,
      refills: t.Refills,
    }));
  }

  async createPrescriptionTemplate(data: {
    name: string;
    drug: string;
    sig: string;
    disp: string;
    refills: string;
  }) {
    const template = await prisma.prescriptiontemplate.create({
      data: {
        Name: data.name,
        Drug: data.drug,
        Sig: data.sig,
        Disp: data.disp,
        Refills: data.refills,
      },
    });
    return {
      id: template.TemplateId.toString(),
      name: template.Name,
      drug: template.Drug,
      sig: template.Sig,
      disp: template.Disp,
      refills: template.Refills,
    };
  }

  async updatePrescriptionTemplate(
    templateId: string,
    updates: Partial<{
      name: string;
      drug: string;
      sig: string;
      disp: string;
      refills: string;
    }>
  ) {
    const updated = await prisma.prescriptiontemplate.update({
      where: { TemplateId: BigInt(templateId) },
      data: {
        Name: updates.name ?? undefined,
        Drug: updates.drug ?? undefined,
        Sig: updates.sig ?? undefined,
        Disp: updates.disp ?? undefined,
        Refills: updates.refills ?? undefined,
      },
    });
    return {
      id: updated.TemplateId.toString(),
      name: updated.Name,
      drug: updated.Drug,
      sig: updated.Sig,
      disp: updated.Disp,
      refills: updated.Refills,
    };
  }

  async deletePrescriptionTemplate(templateId: string) {
    await prisma.prescriptiontemplate.update({
      where: { TemplateId: BigInt(templateId) },
      data: { IsActive: false },
    });
    return { success: true };
  }

  // --- SYSTEM SETTINGS ---
  async getSystemSettings() {
    const settings = await prisma.clinicalsystemsetting.findMany();
    const result: Record<string, string> = {};
    settings.forEach((s) => {
      result[s.Key] = s.Value;
    });
    return result;
  }

  async updateSystemSetting(key: string, value: string) {
    const setting = await prisma.clinicalsystemsetting.upsert({
      where: { Key: key },
      update: { Value: value },
      create: { Key: key, Value: value },
    });
    return { key: setting.Key, value: setting.Value };
  }

  // --- RECARE CONFIG ---
  async getRecareConfig() {
    const config = await prisma.clinicalrecareconfig.findFirst();
    if (!config) {
      return { intervalMonths: 6, autoReminder: true };
    }
    return {
      id: config.ConfigId.toString(),
      intervalMonths: config.IntervalMonths,
      autoReminder: config.AutoReminder,
    };
  }

  async updateRecareConfig(data: { intervalMonths?: number; autoReminder?: boolean }) {
    const config = await prisma.clinicalrecareconfig.findFirst();
    if (config) {
      const updated = await prisma.clinicalrecareconfig.update({
        where: { ConfigId: config.ConfigId },
        data: {
          IntervalMonths: data.intervalMonths ?? undefined,
          AutoReminder: data.autoReminder ?? undefined,
        },
      });
      return {
        id: updated.ConfigId.toString(),
        intervalMonths: updated.IntervalMonths,
        autoReminder: updated.AutoReminder,
      };
    } else {
      const created = await prisma.clinicalrecareconfig.create({
        data: {
          IntervalMonths: data.intervalMonths ?? 6,
          AutoReminder: data.autoReminder ?? true,
        },
      });
      return {
        id: created.ConfigId.toString(),
        intervalMonths: created.IntervalMonths,
        autoReminder: created.AutoReminder,
      };
    }
  }

  // --- TREATMENT PLAN PRESENTATION ---
  async getTreatmentPlanPresentationConfig() {
    const config = await prisma.treatmentplanpresentationconfig.findFirst();
    if (!config) {
      return { showHeader: true, showFooter: true, themeColor: '#1a3a6b' };
    }
    return {
      id: config.ConfigId.toString(),
      showHeader: config.ShowHeader,
      showFooter: config.ShowFooter,
      themeColor: config.ThemeColor,
    };
  }

  async updateTreatmentPlanPresentationConfig(data: {
    showHeader?: boolean;
    showFooter?: boolean;
    themeColor?: string;
  }) {
    const config = await prisma.treatmentplanpresentationconfig.findFirst();
    if (config) {
      const updated = await prisma.treatmentplanpresentationconfig.update({
        where: { ConfigId: config.ConfigId },
        data: {
          ShowHeader: data.showHeader ?? undefined,
          ShowFooter: data.showFooter ?? undefined,
          ThemeColor: data.themeColor ?? undefined,
        },
      });
      return {
        id: updated.ConfigId.toString(),
        showHeader: updated.ShowHeader,
        showFooter: updated.ShowFooter,
        themeColor: updated.ThemeColor,
      };
    } else {
      const created = await prisma.treatmentplanpresentationconfig.create({
        data: {
          ShowHeader: data.showHeader ?? true,
          ShowFooter: data.showFooter ?? true,
          ThemeColor: data.themeColor ?? '#1a3a6b',
        },
      });
      return {
        id: created.ConfigId.toString(),
        showHeader: created.ShowHeader,
        showFooter: created.ShowFooter,
        themeColor: created.ThemeColor,
      };
    }
  }

  // --- INFORMED CONSENT ---
  async getInformedConsents() {
    const templates = await prisma.informedconsenttemplate.findMany({
      where: { IsActive: true },
    });
    return templates.map((t) => ({
      id: t.TemplateId.toString(),
      name: t.Name,
      content: t.Content,
    }));
  }

  async createInformedConsent(name: string, content: string) {
    const template = await prisma.informedconsenttemplate.create({
      data: { Name: name, Content: content },
    });
    return {
      id: template.TemplateId.toString(),
      name: template.Name,
      content: template.Content,
    };
  }

  async updateInformedConsent(templateId: string, updates: Partial<{ name: string; content: string }>) {
    const updated = await prisma.informedconsenttemplate.update({
      where: { TemplateId: BigInt(templateId) },
      data: { Name: updates.name ?? undefined, Content: updates.content ?? undefined },
    });
    return {
      id: updated.TemplateId.toString(),
      name: updated.Name,
      content: updated.Content,
    };
  }

  async deleteInformedConsent(templateId: string) {
    await prisma.informedconsenttemplate.update({
      where: { TemplateId: BigInt(templateId) },
      data: { IsActive: false },
    });
    return { success: true };
  }

  // --- PRE/POST-OPS ---
  async getPrePostOps() {
    const templates = await prisma.prepostopinstructiontemplate.findMany({
      where: { IsActive: true },
    });
    return templates.map((t) => ({
      id: t.TemplateId.toString(),
      name: t.Name,
      type: t.Type,
      content: t.Content,
    }));
  }

  async createPrePostOp(name: string, type: string, content: string) {
    const template = await prisma.prepostopinstructiontemplate.create({
      data: { Name: name, Type: type, Content: content },
    });
    return {
      id: template.TemplateId.toString(),
      name: template.Name,
      type: template.Type,
      content: template.Content,
    };
  }

  async updatePrePostOp(
    templateId: string,
    updates: Partial<{ name: string; type: string; content: string }>
  ) {
    const updated = await prisma.prepostopinstructiontemplate.update({
      where: { TemplateId: BigInt(templateId) },
      data: {
        Name: updates.name ?? undefined,
        Type: updates.type ?? undefined,
        Content: updates.content ?? undefined,
      },
    });
    return {
      id: updated.TemplateId.toString(),
      name: updated.Name,
      type: updated.Type,
      content: updated.Content,
    };
  }

  async deletePrePostOp(templateId: string) {
    await prisma.prepostopinstructiontemplate.update({
      where: { TemplateId: BigInt(templateId) },
      data: { IsActive: false },
    });
    return { success: true };
  }
}

export const clinicalManagementService = new ClinicalManagementService();
