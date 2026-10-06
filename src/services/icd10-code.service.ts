import { prisma } from '../config/db';
import { normalizeIcd10Code } from '../utils/icd10.util';

export class Icd10CodeService {
  async list(params: { search?: string; page?: number; limit?: number; code?: string }) {
    const page = params.page ?? 1;
    const limit = params.limit ?? 50;
    const search = params.search?.trim() ?? '';
    const where: any = { Icd10Code: { not: null } };
    if (params.code) {
      const code = normalizeIcd10Code(params.code);
      where.Icd10Code = { in: code ? [code, code.replace('.', '')] : [] };
    } else if (search) {
      const compact = search.toUpperCase().replace('.', '');
      const dotted = compact.length > 3 ? `${compact.slice(0, 3)}.${compact.slice(3)}` : compact;
      where.OR = [
        { Icd10Code: { contains: compact, mode: 'insensitive' } },
        { Icd10Code: { contains: dotted, mode: 'insensitive' } },
        { Description: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [rows, total] = await Promise.all([
      prisma.icd10.findMany({ where, orderBy: { Icd10Code: 'asc' }, skip: (page - 1) * limit, take: limit }),
      prisma.icd10.count({ where }),
    ]);
    return {
      data: rows.map(row => ({ id: row.Icd10Num.toString(), code: normalizeIcd10Code(row.Icd10Code), description: row.Description ?? '' })),
      total, page, limit,
    };
  }
}

export const icd10CodeService = new Icd10CodeService();
