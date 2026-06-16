import { prisma } from '../config/db';

export class ProcedureCodeService {
  async getAllProcedureCodes() {
    const codes = await prisma.procedurecode.findMany({
      orderBy: { ProcCode: 'asc' },
    });

    return codes.map((c) => ({
      _id: c.CodeNum.toString(),
      code: c.ProcCode,
      name: c.Descript,
      abbreviation: c.AbbrDesc,
    }));
  }
}

export const procedureCodeService = new ProcedureCodeService();