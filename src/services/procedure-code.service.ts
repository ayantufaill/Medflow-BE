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
}

export const procedureCodeService = new ProcedureCodeService();