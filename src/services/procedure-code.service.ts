import { prisma } from '../config/db';
import { getNextId } from '../utils/opendental-ids.util';

export class ProcedureCodeService {
  async getAllProcedureCodes() {
    const defaultFeeSched = await prisma.feesched.findFirst({
      where: { IsHidden: 0 },
      orderBy: { FeeSchedNum: 'asc' },
    });
    const feeSchedNum = defaultFeeSched?.FeeSchedNum ?? BigInt(53);

    const codes = await prisma.procedurecode.findMany({
      orderBy: { ProcCode: 'asc' },
      include: {
        fee: {
          where: { FeeSched: feeSchedNum },
          take: 1
        }
      }
    });

    return codes.map((c) => ({
      _id: c.CodeNum?.toString() ?? '',
      code: c.ProcCode,
      name: c.Descript,
      abbreviation: c.AbbrDesc,
      treatArea: c.TreatArea,
      fee: c.fee?.[0]?.Amount ?? 0,
      requiresXRay: c.RequiresXRay ?? false,
      requiresConsent: c.RequiresConsent ?? false,
      requiresPerioChart: c.RequiresPerioChart ?? false,
      requiresNarrative: c.RequiresNarrative ?? false,
      requiresMedicalNecessity: c.RequiresMedicalNecessity ?? false,
      requiresToothImage: c.RequiresToothImage ?? false,
    }));
  }
  async getProcedureButtons() {
    const categories = await prisma.definition.findMany({
      where: { Category: 1 },
      orderBy: { ItemOrder: 'asc' }
    });

    const codes = await prisma.procedurecode.findMany({
      orderBy: { ProcCode: 'asc' }
    });

    return categories.map(cat => {
      const catCodes = codes.filter(c => c.ProcCat === cat.DefNum);
      return {
        _id: cat.DefNum.toString(),
        category: cat.ItemName,
        itemOrder: cat.ItemOrder,
        items: catCodes.map((c, index) => ({
          _id: c.CodeNum.toString(),
          code: c.ProcCode,
          name: c.AbbrDesc || c.Descript,
          itemOrder: index.toString()
        }))
      };
    });
  }
}

export const procedureCodeService = new ProcedureCodeService();