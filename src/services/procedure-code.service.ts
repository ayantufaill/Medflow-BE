import { prisma } from '../config/db';

export class ProcedureCodeService {
  async getAllProcedureCodes() {
    const codes = await prisma.procedurecode.findMany({
      orderBy: { ProcCode: 'asc' },
    });

    return codes.map((c) => ({
      _id: c.CodeNum?.toString() ?? '',
      code: c.ProcCode,
      name: c.Descript,
      abbreviation: c.AbbrDesc,
      treatArea: c.TreatArea,
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